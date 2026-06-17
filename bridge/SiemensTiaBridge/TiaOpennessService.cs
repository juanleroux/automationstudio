using System;
using System.Collections.Generic;
using System.IO;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;

namespace SiemensTiaBridge
{
    public class TiaOpennessService : IDisposable
    {
        private TiaPortal _tia;
        private Project _project;

        public bool IsProjectOpen => _project != null;
        public string OpenProjectName => _project?.Name;

        public string OpenProject(string projectPath, bool withUi)
        {
            if (string.IsNullOrWhiteSpace(projectPath))
                throw new ArgumentException("projectPath is required");
            if (!File.Exists(projectPath))
                throw new FileNotFoundException("TIA project file not found", projectPath);

            CloseProject();
            _tia = new TiaPortal(withUi ? TiaPortalMode.WithUserInterface : TiaPortalMode.WithoutUserInterface);
            _project = _tia.Projects.Open(new FileInfo(projectPath));
            return _project.Name;
        }

        public FbListResult ListFunctionBlocks()
        {
            if (_project == null)
                throw new InvalidOperationException("No project open");

            var results = new List<FbInfo>();
            var skipped = new List<string>();

            foreach (var device in _project.Devices)
            {
                foreach (var item in device.DeviceItems)
                {
                    var container = item.GetService<SoftwareContainer>();
                    if (container?.Software is PlcSoftware plcSw)
                        CollectFbs(plcSw.BlockGroup, results, skipped);
                }
            }

            return new FbListResult { FunctionBlocks = results, Skipped = skipped };
        }

        private static void CollectFbs(PlcBlockGroup group, List<FbInfo> results, List<string> skipped)
        {
            foreach (var block in group.Blocks)
            {
                if (block is FB fb)
                {
                    try
                    {
                        results.Add(BuildFbInfo(fb));
                    }
                    catch (Exception ex)
                    {
                        skipped.Add($"{fb.Name}: {ex.Message}");
                    }
                }
            }
            foreach (var sub in group.Groups)
                CollectFbs(sub, results, skipped);
        }

        private static FbInfo BuildFbInfo(FB fb)
        {
            var info = new FbInfo
            {
                Name = fb.Name,
                Number = fb.Number,
                Parameters = new List<FbParameter>(),
            };

            // Export block to a temp XML file and parse the interface sections.
            // This is more version-stable than accessing fb.Interface directly.
            var tmpFile = new FileInfo(Path.Combine(Path.GetTempPath(), $"{fb.Name}_{Guid.NewGuid()}.xml"));
            try
            {
                fb.Export(tmpFile, ExportOptions.None);

                var doc = new XmlDocument();
                doc.Load(tmpFile.FullName);

                foreach (XmlElement section in doc.GetElementsByTagName("Section"))
                {
                    var sectionName = section.GetAttribute("Name") ?? "";
                    string usage;
                    switch (sectionName.ToUpperInvariant())
                    {
                        case "INPUT":  usage = "input";  break;
                        case "INOUT":  usage = "inOut";  break;
                        case "OUTPUT": usage = "output"; break;
                        default: continue;
                    }

                    foreach (XmlElement member in section.GetElementsByTagName("Member"))
                    {
                        info.Parameters.Add(new FbParameter
                        {
                            Name  = member.GetAttribute("Name"),
                            Type  = member.GetAttribute("Datatype"),
                            Usage = usage,
                        });
                    }
                }
            }
            finally
            {
                try { tmpFile.Delete(); } catch { }
            }

            return info;
        }

        public CreateInstancesResult CreateInstances(string fbName, List<string> instanceNames, int? startDbIndex = null)
        {
            if (_project == null)
                throw new InvalidOperationException("No project open");

            PlcSoftware plcSw = FindPlcSoftware();
            if (plcSw == null)
                throw new InvalidOperationException("No PLC software found in project");

            var created = new List<string>();
            var skipped = new List<string>();

            int dbOffset = 0;
            foreach (var instanceName in instanceNames)
            {
                try
                {
                    if (startDbIndex.HasValue)
                        plcSw.BlockGroup.Blocks.CreateInstanceDB(instanceName, false, startDbIndex.Value + dbOffset, fbName);
                    else
                        plcSw.BlockGroup.Blocks.CreateInstanceDB(instanceName, true, 0, fbName);
                    created.Add(instanceName);
                    dbOffset++;
                }
                catch (Exception ex)
                {
                    skipped.Add($"{instanceName}: {ex.Message}");
                    dbOffset++;
                }
            }

            if (created.Count > 0)
                _project.Save();

            return new CreateInstancesResult { Created = created, Skipped = skipped };
        }

        private PlcSoftware FindPlcSoftware()
        {
            foreach (var device in _project.Devices)
                foreach (var item in device.DeviceItems)
                {
                    var container = item.GetService<SoftwareContainer>();
                    if (container?.Software is PlcSoftware plcSw) return plcSw;
                }
            return null;
        }

        public void CloseProject()
        {
            if (_project != null)
            {
                try { _project.Close(); } catch { }
                _project = null;
            }
            if (_tia != null)
            {
                try { _tia.Dispose(); } catch { }
                _tia = null;
            }
        }

        public void Dispose() => CloseProject();
    }

    public class CreateInstancesResult
    {
        public List<string> Created { get; set; }
        public List<string> Skipped { get; set; }
    }

    public class FbListResult
    {
        public List<FbInfo> FunctionBlocks { get; set; }
        public List<string> Skipped { get; set; }
    }

    public class FbInfo
    {
        public string Name { get; set; }
        public int Number { get; set; }
        public List<FbParameter> Parameters { get; set; }
    }

    public class FbParameter
    {
        public string Name  { get; set; }
        public string Type  { get; set; }
        public string Usage { get; set; }
    }
}
