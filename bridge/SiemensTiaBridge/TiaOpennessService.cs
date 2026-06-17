using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
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

        /// <summary>
        /// Returns every FB type defined in the project across all PLCs, with their
        /// input, in/out and output parameters — same shape as parseXDB() in the UI.
        /// </summary>
        public List<FbInfo> ListFunctionBlocks()
        {
            if (_project == null)
                throw new InvalidOperationException("No project open");

            var results = new List<FbInfo>();

            foreach (var device in _project.Devices)
            {
                foreach (var item in device.DeviceItems)
                {
                    var sw = item.GetService<PlcSoftware>();
                    if (sw == null) continue;

                    CollectFbs(sw.BlockGroup, results);
                }
            }

            return results;
        }

        private static void CollectFbs(PlcBlockGroup group, List<FbInfo> results)
        {
            foreach (var block in group.Blocks)
            {
                if (block is FB fb)
                {
                    results.Add(BuildFbInfo(fb));
                }
            }

            foreach (var sub in group.Groups)
                CollectFbs(sub, results);
        }

        private static FbInfo BuildFbInfo(FB fb)
        {
            var info = new FbInfo
            {
                Name = fb.Name,
                Number = fb.Number,
                Parameters = new List<FbParameter>(),
            };

            foreach (var member in fb.Interface.Sections)
            {
                string usage;
                switch (member.Name.ToUpperInvariant())
                {
                    case "INPUT":   usage = "input";  break;
                    case "INOUT":   usage = "inOut";  break;
                    case "OUTPUT":  usage = "output"; break;
                    default:        continue;         // STATIC/TEMP/CONSTANT — not exposed
                }

                foreach (var v in member.Members)
                {
                    info.Parameters.Add(new FbParameter
                    {
                        Name    = v.Name,
                        Type    = v.Datatype,
                        Usage   = usage,
                    });
                }
            }

            return info;
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
