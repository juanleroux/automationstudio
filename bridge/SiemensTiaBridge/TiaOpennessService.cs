using System;
using System.IO;
using System.Linq;
using Siemens.Engineering;

namespace SiemensTiaBridge
{
    /// <summary>
    /// Thin wrapper around the TIA Portal Openness API. Holds at most one open
    /// TiaPortal/Project pair at a time — this bridge is meant to be driven by a
    /// single engineering workstation, not shared across concurrent callers.
    /// </summary>
    public class TiaOpennessService : IDisposable
    {
        private TiaPortal _tia;
        private Project _project;

        public bool IsProjectOpen => _project != null;

        public string OpenProjectName => _project?.Name;

        /// <summary>
        /// Opens TIA Portal (if not already running for this service instance) and
        /// loads the given project file.
        /// </summary>
        /// <param name="projectPath">Full path to the .apXX project file.</param>
        /// <param name="withUi">When true, TIA Portal runs with its UI visible.</param>
        public string OpenProject(string projectPath, bool withUi)
        {
            if (string.IsNullOrWhiteSpace(projectPath))
                throw new ArgumentException("projectPath is required");
            if (!File.Exists(projectPath))
                throw new FileNotFoundException("TIA project file not found", projectPath);

            CloseProject();

            _tia = new TiaPortal(withUi ? TiaPortalMode.WithUserInterface : TiaPortalMode.WithoutUserInterface);

            var projectFile = new FileInfo(projectPath);
            _project = _tia.Projects.Open(projectFile);

            return _project.Name;
        }

        public void CloseProject()
        {
            if (_project != null)
            {
                try { _project.Close(); } catch { /* already closed/detached */ }
                _project = null;
            }
            if (_tia != null)
            {
                try { _tia.Dispose(); } catch { /* already disposed */ }
                _tia = null;
            }
        }

        public void Dispose()
        {
            CloseProject();
        }
    }
}
