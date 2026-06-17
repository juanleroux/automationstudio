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

            // Create / update FC with one LAD network per instance
            string fcCreated = null;
            if (!string.IsNullOrWhiteSpace(fcName) && instances.Count > 0)
            {
                try
                {
                    var xml = BuildFcXml(fcName, fcNumber, instances, tiaVersion ?? "V19");
                    var tmpFile = new FileInfo(Path.Combine(Path.GetTempPath(), $"{fcName}_{Guid.NewGuid()}.xml"));
                    try
                    {
                        File.WriteAllText(tmpFile.FullName, xml, new UTF8Encoding(false));
                        targetGroup.Blocks.Import(tmpFile, ImportOptions.Override);
                        fcCreated = fcName;
                    }
                    finally
                    {
                        try { tmpFile.Delete(); } catch { }
                    }
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

        private static string BuildFcXml(string fcName, int? fcNumber, List<InstanceInfo> instances, string tiaVersion)
        {
            var sb = new StringBuilder();
            sb.AppendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
            sb.AppendLine("<Document>");
            sb.AppendLine($"  <Engineering version=\"{XmlEsc(tiaVersion)}\" />");
            sb.AppendLine("  <SW.Blocks.FC ID=\"0\">");
            sb.AppendLine("    <AttributeList>");
            sb.AppendLine($"      <AutoNumber>{(fcNumber.HasValue ? "false" : "true")}</AutoNumber>");
            sb.AppendLine($"      <Name>{XmlEsc(fcName)}</Name>");
            if (fcNumber.HasValue)
                sb.AppendLine($"      <Number>{fcNumber.Value}</Number>");
            sb.AppendLine("      <ProgrammingLanguage>LAD</ProgrammingLanguage>");
            sb.AppendLine("    </AttributeList>");
            sb.AppendLine("    <ObjectList>");

            int uid = 1;
            foreach (var inst in instances)
            {
                int cuId      = uid++;
                int titleId   = uid++;
                int titleItem = uid++;
                int callUid   = uid++;
                int wireUid   = uid++;
                int pwrUid    = uid++;

                sb.AppendLine($"      <SW.Blocks.CompileUnit ID=\"{cuId}\" CompositionName=\"CompileUnits\">");
                sb.AppendLine("        <AttributeList>");
                sb.AppendLine("          <NetworkSource>");
                sb.AppendLine("            <FlgNet xmlns=\"http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4\">");
                sb.AppendLine("              <Parts>");
                sb.AppendLine($"                <Call UId=\"{callUid}\">");
                sb.AppendLine($"                  <CallInfo Name=\"{XmlEsc(inst.Name)}\" BlockType=\"DB\">");
                sb.AppendLine($"                    <Instance Name=\"{XmlEsc(inst.Name)}\" Scope=\"GlobalVariable\">");
                sb.AppendLine($"                      <Component Name=\"{XmlEsc(inst.Name)}\"/>");
                sb.AppendLine("                    </Instance>");
                sb.AppendLine("                  </CallInfo>");
                sb.AppendLine("                </Call>");
                sb.AppendLine("              </Parts>");
                sb.AppendLine("              <Wires>");
                sb.AppendLine($"                <Wire UId=\"{wireUid}\">");
                sb.AppendLine($"                  <Powerrail UId=\"{pwrUid}\"/>");
                sb.AppendLine($"                  <NameCon UId=\"{callUid}\" Name=\"en\"/>");
                sb.AppendLine("                </Wire>");
                sb.AppendLine("              </Wires>");
                sb.AppendLine("            </FlgNet>");
                sb.AppendLine("          </NetworkSource>");
                sb.AppendLine("          <ProgrammingLanguage>LAD</ProgrammingLanguage>");
                sb.AppendLine("        </AttributeList>");
                sb.AppendLine("        <ObjectList>");
                sb.AppendLine($"          <MultilingualText ID=\"{titleId}\" CompositionName=\"Title\">");
                sb.AppendLine("            <ObjectList>");
                sb.AppendLine($"              <MultilingualTextItem ID=\"{titleItem}\" CompositionName=\"Items\">");
                sb.AppendLine("                <AttributeList>");
                sb.AppendLine("                  <Culture>en-US</Culture>");
                sb.AppendLine($"                  <Text>{XmlEsc(inst.LongDesc)}</Text>");
                sb.AppendLine("                </AttributeList>");
                sb.AppendLine("              </MultilingualTextItem>");
                sb.AppendLine("            </ObjectList>");
                sb.AppendLine("          </MultilingualText>");
                sb.AppendLine("        </ObjectList>");
                sb.AppendLine("      </SW.Blocks.CompileUnit>");
            }

            sb.AppendLine("    </ObjectList>");
            sb.AppendLine("  </SW.Blocks.FC>");
            sb.AppendLine("</Document>");
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
                {
                    if (string.Equals(g.Name, segment, StringComparison.OrdinalIgnoreCase))
                    {
                        next = g;
                        break;
                    }
                }
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
