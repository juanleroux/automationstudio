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

            // Create / update FC: let TIA generate the block shell, then splice in our networks.
            string fcCreated = null;
            if (!string.IsNullOrWhiteSpace(fcName) && instances.Count > 0)
            {
                try
                {
                    CreateFcWithNetworks(targetGroup, fcName, fcNumber, instances);
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

        /// <summary>
        /// Creates (or replaces) an FC whose networks are LAD calls to the supplied instance DBs.
        /// Strategy: create an empty FC via TIA API → export it (so TIA writes the correct version-
        /// specific block header XML) → inject CompileUnit nodes → re-import with Override.
        /// This avoids having to guess TIA's internal identifier attributes (Namespace, etc.).
        /// </summary>
        private static void CreateFcWithNetworks(
            PlcBlockGroup targetGroup,
            string fcName,
            int? fcNumber,
            List<InstanceInfo> instances)
        {
            // Find existing FC or create a new empty one so TIA generates the correct XML shell.
            FC fc = null;
            foreach (var block in targetGroup.Blocks)
            {
                if (block is FC existing &&
                    string.Equals(existing.Name, fcName, StringComparison.OrdinalIgnoreCase))
                {
                    fc = existing;
                    break;
                }
            }
            if (fc == null)
                fc = targetGroup.Blocks.CreateFc(fcName, !fcNumber.HasValue, fcNumber ?? 0, "LAD");

            var exportFile = new FileInfo(Path.Combine(Path.GetTempPath(), $"fc_exp_{Guid.NewGuid()}.xml"));
            var importFile = new FileInfo(Path.Combine(Path.GetTempPath(), $"fc_imp_{Guid.NewGuid()}.xml"));
            try
            {
                // Export the empty shell — TIA writes all the version-correct identifier attributes.
                fc.Export(exportFile, ExportOptions.None);

                var doc = new XmlDocument();
                doc.Load(exportFile.FullName);

                // Locate the SW.Blocks.FC element.
                XmlElement fcElem = null;
                foreach (XmlNode n in doc.DocumentElement.ChildNodes)
                {
                    if (n is XmlElement el && el.Name.StartsWith("SW.Blocks.FC"))
                    { fcElem = el; break; }
                }
                if (fcElem == null)
                    throw new Exception("SW.Blocks.FC element not found in exported XML");

                // Get or create the ObjectList that holds CompileUnits.
                var objList = fcElem["ObjectList"];
                if (objList == null)
                {
                    objList = doc.CreateElement("ObjectList");
                    fcElem.AppendChild(objList);
                }
                else
                {
                    // Replace all existing networks.
                    var toRemove = new List<XmlNode>();
                    foreach (XmlNode child in objList.ChildNodes)
                        if (child is XmlElement ce && ce.Name == "SW.Blocks.CompileUnit")
                            toRemove.Add(child);
                    foreach (var n in toRemove) objList.RemoveChild(n);
                }

                // Find the highest existing ID so our new IDs don't collide.
                int nextId = 1;
                foreach (XmlNode n in doc.SelectNodes("//*[@ID]"))
                {
                    if (n is XmlElement e && int.TryParse(e.GetAttribute("ID"), out int id))
                        nextId = Math.Max(nextId, id + 1);
                }

                // Append one CompileUnit (network) per instance.
                foreach (var inst in instances)
                {
                    int cuId    = nextId++;
                    int titleId = nextId++;
                    int itemId  = nextId++;
                    int callUid = nextId++;
                    int wireUid = nextId++;
                    int pwrUid  = nextId++;

                    var frag = doc.CreateDocumentFragment();
                    frag.InnerXml = CompileUnitXml(cuId, titleId, itemId, callUid, wireUid, pwrUid, inst);
                    objList.AppendChild(frag);
                }

                doc.Save(importFile.FullName);
                targetGroup.Blocks.Import(importFile, ImportOptions.Override);
            }
            finally
            {
                try { exportFile.Delete(); } catch { }
                try { importFile.Delete(); } catch { }
            }
        }

        private static string CompileUnitXml(
            int cuId, int titleId, int itemId,
            int callUid, int wireUid, int pwrUid,
            InstanceInfo inst)
        {
            var n = XmlEsc(inst.Name);
            var t = XmlEsc(inst.LongDesc);
            return
                $"<SW.Blocks.CompileUnit ID=\"{cuId}\" CompositionName=\"CompileUnits\">" +
                "<AttributeList>" +
                "<NetworkSource>" +
                "<FlgNet xmlns=\"http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4\">" +
                "<Parts>" +
                $"<Call UId=\"{callUid}\">" +
                $"<CallInfo Name=\"{n}\" BlockType=\"DB\">" +
                $"<Instance Name=\"{n}\" Scope=\"GlobalVariable\">" +
                $"<Component Name=\"{n}\"/>" +
                "</Instance>" +
                "</CallInfo>" +
                "</Call>" +
                "</Parts>" +
                "<Wires>" +
                $"<Wire UId=\"{wireUid}\">" +
                $"<Powerrail UId=\"{pwrUid}\"/>" +
                $"<NameCon UId=\"{callUid}\" Name=\"en\"/>" +
                "</Wire>" +
                "</Wires>" +
                "</FlgNet>" +
                "</NetworkSource>" +
                "<ProgrammingLanguage>LAD</ProgrammingLanguage>" +
                "</AttributeList>" +
                "<ObjectList>" +
                $"<MultilingualText ID=\"{titleId}\" CompositionName=\"Title\">" +
                "<ObjectList>" +
                $"<MultilingualTextItem ID=\"{itemId}\" CompositionName=\"Items\">" +
                "<AttributeList>" +
                "<Culture>en-US</Culture>" +
                $"<Text>{t}</Text>" +
                "</AttributeList>" +
                "</MultilingualTextItem>" +
                "</ObjectList>" +
                "</MultilingualText>" +
                "</ObjectList>" +
                "</SW.Blocks.CompileUnit>";
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
                    { next = g; break; }
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
