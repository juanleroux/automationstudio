using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
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

        public static void Main(string[] args)
        {
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
                            var result = Tia.CreateInstances(body.FbName, instances, body.TargetFolder, body.FcName, body.FcNumber, body.TiaVersion);
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
        }

        private class OpenProjectRequest
        {
            public string ProjectPath { get; set; }
            public bool WithUi { get; set; }
        }
    }
}
