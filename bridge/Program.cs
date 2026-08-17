using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using Microsoft.Win32;
using Newtonsoft.Json;

namespace SiemensTiaBridge
{
    /// <summary>
    /// Minimal self-hosted HTTP bridge exposing TIA Portal Openness over a local
    /// REST API, so the (cross-platform) Automation Studio server/UI can drive a
    /// live TIA Portal session without itself being .NET/Windows-only.
    ///
    /// Run on the Windows engineering workstation that has TIA Portal + Openness
    /// installed and licensed. Point Settings → Siemens → Bridge URL at this
    /// process's listening address (default http://localhost:5180).
    /// </summary>
    public static class Program
    {
        private static TiaOpennessService _tia;
        private static TiaOpennessService Tia => _tia ??= new TiaOpennessService();

        // Directories discovered from registry — used by the assembly resolver so that
        // Siemens DLLs are loaded from their installation paths (not from bin\).
        // V21+ requires Private/CopyLocal=false; loading from bin\ causes
        // OpennessLocationProvider to refuse connection with a FileLoadException.
        private static readonly List<string> _siemensSearchDirs = new List<string>();

        private static Assembly OnResolveAssembly(object sender, ResolveEventArgs e)
        {
            var simpleName = new AssemblyName(e.Name).Name;
            if (!simpleName.StartsWith("Siemens.", StringComparison.OrdinalIgnoreCase))
                return null;

            foreach (var dir in _siemensSearchDirs)
            {
                var path = Path.Combine(dir, simpleName + ".dll");
                if (File.Exists(path))
                {
                    try { return Assembly.LoadFrom(path); } catch { }
                }
            }
            return null;
        }

        private static void DiscoverSiemensDirs()
        {
            // Walk HKLM\SOFTWARE\Siemens\Automation\Openness\*\PublicAPI\*\net48
            // to find where Siemens.Engineering.Base.dll lives, then derive sibling dirs.
            try
            {
                using (var openness = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Siemens\Automation\Openness"))
                {
                    if (openness == null) return;
                    foreach (var ver in openness.GetSubKeyNames())
                    {
                        using (var pubApi = openness.OpenSubKey(ver + @"\PublicAPI"))
                        {
                            if (pubApi == null) continue;
                            foreach (var apiVer in pubApi.GetSubKeyNames())
                            {
                                using (var net48 = pubApi.OpenSubKey(apiVer + @"\net48"))
                                {
                                    if (net48 == null) continue;
                                    foreach (var valueName in net48.GetValueNames())
                                    {
                                        var dllPath = net48.GetValue(valueName) as string;
                                        if (string.IsNullOrEmpty(dllPath) || !File.Exists(dllPath)) continue;

                                        // Add the PublicAPI\VXX\net48 folder
                                        var apiDir = Path.GetDirectoryName(dllPath);
                                        AddDir(apiDir);

                                        // Derive the TIA Portal root (4 levels up from net48)
                                        // e.g. C:\...\Portal V21\PublicAPI\V21\net48 → C:\...\Portal V21
                                        var root = apiDir;
                                        for (int i = 0; i < 3; i++)
                                            root = Path.GetDirectoryName(root) ?? root;

                                        // Add Bin\PublicAPI and Bin\PublicAPI\Client
                                        AddDir(Path.Combine(root, "Bin", "PublicAPI"));
                                        AddDir(Path.Combine(root, "Bin", "PublicAPI", "Client"));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch { /* registry unavailable — resolver returns null, .NET falls back */ }
        }

        private static void AddDir(string dir)
        {
            if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir) && !_siemensSearchDirs.Contains(dir))
                _siemensSearchDirs.Add(dir);
        }

        public static void Main(string[] args)
        {
            // Register resolver BEFORE any Siemens type is touched so that the runtime
            // loads the assemblies from their installation paths, not from bin\.
            DiscoverSiemensDirs();
            AppDomain.CurrentDomain.AssemblyResolve += OnResolveAssembly;

            int port = 5180;
            if (args.Length > 0 && int.TryParse(args[0], out var parsed)) port = parsed;

            var listener = new HttpListener();
            listener.Prefixes.Add($"http://+:{port}/");
            listener.Start();
            Console.WriteLine($"SiemensTiaBridge listening on all interfaces, port {port}");
            Console.WriteLine("Press Ctrl+C to stop.");

            Console.CancelKeyPress += (s, e) =>
            {
                listener.Stop();
                _tia?.Dispose();
            };

            while (listener.IsListening)
            {
                HttpListenerContext ctx;
                try
                {
                    ctx = listener.GetContext();
                }
                catch (HttpListenerException)
                {
                    break; // listener stopped
                }

                ThreadPool.QueueUserWorkItem(_ => HandleRequest(ctx));
            }
        }

        private static void HandleRequest(HttpListenerContext ctx)
        {
            var request = ctx.Request;
            var response = ctx.Response;
            response.AddHeader("Access-Control-Allow-Origin", "*");

            try
            {
                switch ($"{request.HttpMethod} {request.Url.AbsolutePath}")
                {
                    case "GET /api/health":
                        WriteJson(response, 200, new
                        {
                            status = "ok",
                            projectOpen = _tia?.IsProjectOpen ?? false,
                            openProjectName = _tia?.OpenProjectName,
                        });
                        break;

                    case "POST /api/project/open":
                        {
                            var body = ReadJsonBody<OpenProjectRequest>(request);
                            var name = Tia.OpenProject(body.ProjectPath, body.WithUi);
                            WriteJson(response, 200, new { success = true, projectName = name });
                        }
                        break;

                    case "POST /api/project/close":
                        Tia.CloseProject();
                        WriteJson(response, 200, new { success = true });
                        break;

                    case "GET /api/fb/list":
                        {
                            var result = Tia.ListFunctionBlocks();
                            WriteJson(response, 200, new { success = true, functionBlocks = result.FunctionBlocks, skipped = result.Skipped });
                        }
                        break;

                    case "GET /api/block/export":
                        {
                            var blockName = request.QueryString["blockName"];
                            if (string.IsNullOrWhiteSpace(blockName))
                            {
                                WriteJson(response, 400, new { error = "blockName query param required" });
                                break;
                            }
                            var xml = Tia.ExportBlockXml(blockName);
                            response.StatusCode = 200;
                            response.ContentType = "application/xml";
                            var bytes = Encoding.UTF8.GetBytes(xml);
                            response.ContentLength64 = bytes.Length;
                            response.OutputStream.Write(bytes, 0, bytes.Length);
                        }
                        break;

                    case "POST /api/instances/create":
                        {
                            var body = ReadJsonBody<CreateInstancesRequest>(request);
                            var instances = body.Instances ?? new System.Collections.Generic.List<InstanceInfo>();
                            var result = Tia.CreateInstances(body.FbName, instances, body.TargetFolder, body.FcName, body.FcNumber, body.TiaVersion, body.FcLanguage);
                            WriteJson(response, 200, new { success = true, created = result.Created, skipped = result.Skipped, fcCreated = result.FcCreated });
                        }
                        break;

                    default:
                        WriteJson(response, 404, new { error = "Not found" });
                        break;
                }
            }
            catch (Exception ex)
            {
                var sb = new StringBuilder();
                var current = ex;
                while (current != null)
                {
                    sb.AppendLine($"{current.GetType().Name}: {current.Message}");
                    current = current.InnerException;
                }
                WriteJson(response, 500, new { error = sb.ToString().Trim() });
            }
            finally
            {
                response.Close();
            }
        }

        private static T ReadJsonBody<T>(HttpListenerRequest request)
        {
            using (var reader = new StreamReader(request.InputStream, Encoding.UTF8))
            {
                var text = reader.ReadToEnd();
                return JsonConvert.DeserializeObject<T>(text);
            }
        }

        private static void WriteJson(HttpListenerResponse response, int statusCode, object payload)
        {
            response.StatusCode = statusCode;
            response.ContentType = "application/json";
            var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(payload));
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
        }

        private class CreateInstancesRequest
        {
            public string FbName { get; set; }
            public System.Collections.Generic.List<InstanceInfo> Instances { get; set; }
            public string TargetFolder { get; set; }
            public string FcName { get; set; }
            public int? FcNumber { get; set; }
            public string TiaVersion { get; set; }
            public string FcLanguage { get; set; }
        }

        private class OpenProjectRequest
        {
            public string ProjectPath { get; set; }
            public bool WithUi { get; set; }
        }
    }
}
