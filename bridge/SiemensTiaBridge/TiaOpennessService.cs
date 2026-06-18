using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
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
                    try { results.Add(BuildFbInfo(fb)); }
                    catch (Exception ex) { skipped.Add($"{fb.Name}: {ex.Message}"); }
                }
            }
            foreach (var sub in group.Groups)
                CollectFbs(sub, results, skipped);
        }

        private static FbInfo BuildFbInfo(FB fb)
        {
            var info = new FbInfo { Name = fb.Name, Number = fb.Number, Parameters = new List<FbParameter>() };
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
                        info.Parameters.Add(new FbParameter
                        {
                            Name  = member.GetAttribute("Name"),
                            Type  = member.GetAttribute("Datatype"),
                            Usage = usage,
                        });
                }
            }
            finally { try { tmpFile.Delete(); } catch { } }
            return info;
        }

        public CreateInstancesResult CreateInstances(
            string fbName,
            List<InstanceInfo> instances,
            int? startDbIndex = null,
            string targetFolder = null,
            string fcName = null,
            int? fcNumber = null,
            string tiaVersion = null)
        {
            if (_project == null)
                throw new InvalidOperationException("No project open");

            PlcSoftware plcSw = FindPlcSoftware();
            if (plcSw == null)
                throw new InvalidOperationException("No PLC software found in project");

            var targetGroup = FindOrCreateGroup(plcSw.BlockGroup, targetFolder);

            var created = new List<string>();
            var skipped = new List<string>();

            int dbOffset = 0;
            foreach (var inst in instances)
            {
                try
                {
                    if (startDbIndex.HasValue)
                        targetGroup.Blocks.CreateInstanceDB(inst.Name, false, startDbIndex.Value + dbOffset, fbName);
                    else
                        targetGroup.Blocks.CreateInstanceDB(inst.Name, true, 0, fbName);
                    created.Add(inst.Name);
                    dbOffset++;
                }
                catch (Exception ex)
                {
                    skipped.Add($"{inst.Name}: {ex.Message}");
                    dbOffset++;
                }
            }

            string fcCreated = null;
            if (!string.IsNullOrWhiteSpace(fcName) && instances.Count > 0)
            {
                try
                {
                    CreateFcWithNetworks(targetGroup, fcName, fcNumber, instances, tiaVersion ?? "V19", fbName);
                    fcCreated = fcName;
                }
                catch (Exception ex)
                {
                    skipped.Add($"FC {fcName}: {ex.Message}");
                }
            }

            if (created.Count > 0 || fcCreated != null)
                _project.Save();

            return new CreateInstancesResult { Created = created, Skipped = skipped, FcCreated = fcCreated };
        }

        private static void CreateFcWithNetworks(
            PlcBlockGroup targetGroup,
            string fcName,
            int? fcNumber,
            List<InstanceInfo> instances,
            string tiaVersion,
            string fbName)
        {
            var xml = BuildFcXml(fcName, fcNumber, instances, tiaVersion, fbName);
            var debugPath = Path.Combine(Path.GetTempPath(), $"SiemensTiaBridge_debug_{fcName}.xml");
            File.WriteAllText(debugPath, xml, new UTF8Encoding(false));
            var tmpFile = new FileInfo(Path.Combine(Path.GetTempPath(), $"{fcName}_{Guid.NewGuid()}.xml"));
            try
            {
                File.WriteAllText(tmpFile.FullName, xml, new UTF8Encoding(false));
                targetGroup.Blocks.Import(tmpFile, ImportOptions.Override);
            }
            finally
            {
                try { tmpFile.Delete(); } catch { }
            }
        }

        private static string BuildFcXml(
            string fcName,
            int? fcNumber,
            List<InstanceInfo> instances,
            string tiaVersion,
            string fbName)
        {
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
            sb.Append("<Document>");
            sb.Append($"<Engineering version=\"{XmlEsc(tiaVersion)}\" />");
            sb.Append("<SW.Blocks.FC ID=\"0\" CompositionName=\"Blocks\">");
            sb.Append("<AttributeList>");
            sb.Append($"<AutoNumber>{(fcNumber.HasValue ? "false" : "true")}</AutoNumber>");
            sb.Append($"<Name>{XmlEsc(fcName)}</Name>");
            if (fcNumber.HasValue)
                sb.Append($"<Number>{fcNumber.Value}</Number>");
            sb.Append("<Namespace></Namespace>");
            sb.Append("<ProgrammingLanguage>SCL</ProgrammingLanguage>");
            sb.Append("</AttributeList>");
            sb.Append("<ObjectList>");

            // SCL supports only one CompileUnit per block — all calls go in a single network
            int nextId = 1;
            int cuId      = nextId++;
            int titleId   = nextId++;
            int titleItem = nextId++;

            sb.Append($"<SW.Blocks.CompileUnit ID=\"{cuId}\" CompositionName=\"CompileUnits\">");
            sb.Append("<AttributeList>");
            sb.Append("<NetworkSource>");
            sb.Append("<StructuredText xmlns=\"http://www.siemens.com/automation/Openness/SW/NetworkSource/StructuredText/v2\">");
            foreach (var inst in instances)
            {
                var n         = XmlEsc(inst.Name);
                var comment   = XmlEsc(inst.LongDesc);
                int accessUId = nextId++;
                int symbolUId = nextId++;
                int compUId   = nextId++;
                int tokenOpen = nextId++;
                int tokenClose= nextId++;
                int tokenSemi = nextId++;
                int commentId = nextId++;
                int newLineId = nextId++;
                sb.Append($"<Access Scope=\"GlobalVariable\" UId=\"{accessUId}\"><Symbol UId=\"{symbolUId}\"><Component Name=\"{n}\" UId=\"{compUId}\"/></Symbol></Access>");
                sb.Append($"<Token Text=\"(\" UId=\"{tokenOpen}\"/>");
                sb.Append($"<Token Text=\")\" UId=\"{tokenClose}\"/>");
                sb.Append($"<Token Text=\";\" UId=\"{tokenSemi}\"/>");
                if (!string.IsNullOrEmpty(inst.LongDesc))
                    sb.Append($"<LineComment UId=\"{commentId}\"><Text>{comment}</Text></LineComment>");
                sb.Append($"<NewLine UId=\"{newLineId}\"/>");
            }
            sb.Append("</StructuredText>");
            sb.Append("</NetworkSource>");
            sb.Append("<ProgrammingLanguage>SCL</ProgrammingLanguage>");
            sb.Append("</AttributeList>");
            sb.Append("<ObjectList>");
            sb.Append($"<MultilingualText ID=\"{titleId}\" CompositionName=\"Title\">");
            sb.Append("<ObjectList>");
            sb.Append($"<MultilingualTextItem ID=\"{titleItem}\" CompositionName=\"Items\">");
            sb.Append("<AttributeList>");
            sb.Append("<Culture>en-US</Culture>");
            sb.Append($"<Text>{XmlEsc(fcName)}</Text>");
            sb.Append("</AttributeList>");
            sb.Append("</MultilingualTextItem>");
            sb.Append("</ObjectList>");
            sb.Append("</MultilingualText>");
            sb.Append("</ObjectList>");
            sb.Append("</SW.Blocks.CompileUnit>");

            sb.Append("</ObjectList>");
            sb.Append("</SW.Blocks.FC>");
            sb.Append("</Document>");
            return sb.ToString();
        }

        private static string XmlEsc(string s) =>
            string.IsNullOrEmpty(s) ? "" :
            s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

        private static PlcBlockGroup FindOrCreateGroup(PlcBlockGroup root, string folderPath)
        {
            if (string.IsNullOrWhiteSpace(folderPath)) return root;
            var segments = folderPath.Trim('\\', '/').Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries);
            var current = root;
            foreach (var segment in segments)
            {
                PlcBlockGroup next = null;
                foreach (PlcBlockGroup g in current.Groups)
                    if (string.Equals(g.Name, segment, StringComparison.OrdinalIgnoreCase))
                    { next = g; break; }
                if (next == null)
                    next = current.Groups.Create(segment);
                current = next;
            }
            return current;
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

        public string ExportBlockXml(string blockName)
        {
            if (_project == null)
                throw new InvalidOperationException("No project open");

            var block = FindBlockByName(blockName);
            if (block == null)
                throw new InvalidOperationException($"Block '{blockName}' not found in project");

            var tmpFile = new FileInfo(Path.Combine(Path.GetTempPath(), $"export_{blockName}_{Guid.NewGuid()}.xml"));
            try
            {
                block.Export(tmpFile, ExportOptions.WithDefaults);
                return File.ReadAllText(tmpFile.FullName, Encoding.UTF8);
            }
            finally { try { tmpFile.Delete(); } catch { } }
        }

        private PlcBlock FindBlockByName(string name)
        {
            foreach (var device in _project.Devices)
                foreach (var item in device.DeviceItems)
                {
                    var container = item.GetService<SoftwareContainer>();
                    if (container?.Software is PlcSoftware plcSw)
                    {
                        var block = SearchGroup(plcSw.BlockGroup, name);
                        if (block != null) return block;
                    }
                }
            return null;
        }

        private static PlcBlock SearchGroup(PlcBlockGroup group, string name)
        {
            foreach (PlcBlock block in group.Blocks)
                if (string.Equals(block.Name, name, StringComparison.OrdinalIgnoreCase))
                    return block;
            foreach (PlcBlockGroup sub in group.Groups)
            {
                var found = SearchGroup(sub, name);
                if (found != null) return found;
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

    public class InstanceInfo
    {
        public string Name { get; set; }
        public string LongDesc { get; set; }
    }

    public class CreateInstancesResult
    {
        public List<string> Created { get; set; }
        public List<string> Skipped { get; set; }
        public string FcCreated { get; set; }
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
