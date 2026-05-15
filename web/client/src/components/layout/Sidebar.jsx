import React, { useState } from 'react';
import {
  Cpu, Map, Settings, ChevronLeft, ChevronRight,
  FilePlus, FolderOpen, Save, Zap
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import { listProjects, createProject } from '../../api/client';
import Modal from '../shared/Modal';

const NAV_ITEMS = [
  { id: 'engineering', label: 'Engineering', icon: Cpu },
  { id: 'areas', label: 'Areas', icon: Map },
];

export default function Sidebar({ activeView, onChangeView }) {
  const { project, filename, isDirty, isSaving, openProject, saveCurrentProject, closeProject } = useProject();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleNewProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const result = await createProject(newName.trim());
      await openProject(result.filename);
      setShowNewDialog(false);
      setNewName('');
      toast.success(`Project "${newName.trim()}" created`);
      onChangeView('engineering');
    } catch (err) {
      toast.error('Failed to create project: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDialog = async () => {
    try {
      const list = await listProjects();
      setProjects(list);
      setShowOpenDialog(true);
    } catch (err) {
      toast.error('Failed to load projects: ' + err.message);
    }
  };

  const handleOpenProject = async (proj) => {
    try {
      await openProject(proj.filename);
      setShowOpenDialog(false);
      toast.success(`Opened "${proj.name}"`);
      onChangeView('engineering');
    } catch (err) {
      toast.error('Failed to open project: ' + err.message);
    }
  };

  const handleSave = async () => {
    try {
      await saveCurrentProject();
      toast.success('Project saved');
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    }
  };

  return (
    <>
      <div
        className="flex flex-col h-full flex-shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 56 : 220,
          background: '#242424',
          borderRight: '1px solid #333'
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-3 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #333' }}
        >
          <div
            className="flex items-center justify-center rounded-md flex-shrink-0"
            style={{ width: 32, height: 32, background: '#3ecf8e' }}
          >
            <Zap size={18} color="#1c1c1c" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-text-primary text-sm leading-tight truncate">
                Automation Studio
              </div>
              <div className="text-xs text-text-muted truncate">SCADA Tag Manager</div>
            </div>
          )}
        </div>

        {/* Project info */}
        {!collapsed && (
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #333' }}>
            <div className="text-xs text-text-muted mb-1">Project</div>
            <div className="text-sm text-text-primary font-medium truncate">
              {project ? (project.name || filename?.replace('.atsproj.json', '')) : 'No project open'}
            </div>
            {isDirty && (
              <div className="text-xs text-yellow-400 mt-0.5">Unsaved changes</div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                disabled={!project && item.id !== 'settings'}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-none transition-colors"
                style={{
                  background: active ? 'rgba(62,207,142,0.1)' : 'transparent',
                  color: active ? '#3ecf8e' : (!project && item.id !== 'settings') ? '#555' : '#9e9e9e',
                  borderLeft: active ? '3px solid #3ecf8e' : '3px solid transparent',
                  cursor: (!project && item.id !== 'settings') ? 'not-allowed' : 'pointer',
                }}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex-shrink-0 py-2" style={{ borderTop: '1px solid #333' }}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 px-2">
              <button
                className="btn btn-ghost btn-icon w-full flex items-center justify-center"
                onClick={() => setShowNewDialog(true)}
                title="New Project"
              >
                <FilePlus size={16} />
              </button>
              <button
                className="btn btn-ghost btn-icon w-full flex items-center justify-center"
                onClick={handleOpenDialog}
                title="Open Project"
              >
                <FolderOpen size={16} />
              </button>
              <button
                className="btn btn-ghost btn-icon w-full flex items-center justify-center"
                onClick={handleSave}
                disabled={!project || isSaving}
                title="Save"
              >
                <Save size={16} />
              </button>
              <button
                className="btn btn-ghost btn-icon w-full flex items-center justify-center"
                onClick={() => onChangeView('settings')}
                title="Settings"
              >
                <Settings size={16} />
              </button>
            </div>
          ) : (
            <div className="px-3 flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  className="btn btn-secondary flex-1 text-xs"
                  style={{ padding: '5px 8px' }}
                  onClick={() => setShowNewDialog(true)}
                >
                  <FilePlus size={13} /> New
                </button>
                <button
                  className="btn btn-secondary flex-1 text-xs"
                  style={{ padding: '5px 8px' }}
                  onClick={handleOpenDialog}
                >
                  <FolderOpen size={13} /> Open
                </button>
              </div>
              <button
                className="btn btn-primary w-full text-xs"
                style={{ padding: '5px 8px' }}
                onClick={handleSave}
                disabled={!project || isSaving}
              >
                <Save size={13} /> {isSaving ? 'Saving...' : 'Save Project'}
              </button>
              <button
                className="btn btn-ghost w-full text-xs"
                style={{ padding: '5px 8px' }}
                onClick={() => onChangeView('settings')}
              >
                <Settings size={13} /> Settings
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          className="w-full flex items-center justify-center py-2 text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          style={{ borderTop: '1px solid #333' }}
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* New Project Dialog */}
      {showNewDialog && (
        <Modal
          title="New Project"
          onClose={() => { setShowNewDialog(false); setNewName(''); }}
          width={400}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowNewDialog(false); setNewName(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNewProject}
                disabled={!newName.trim() || creating}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Project Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="My Project"
              onKeyDown={e => { if (e.key === 'Enter') handleNewProject(); }}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Open Project Dialog */}
      {showOpenDialog && (
        <Modal
          title="Open Project"
          onClose={() => setShowOpenDialog(false)}
          width={480}
        >
          {projects.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p>No projects found</p>
              <p className="text-xs mt-1">Create a new project to get started</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {projects.map(proj => (
                <button
                  key={proj.filename}
                  onClick={() => handleOpenProject(proj)}
                  className="flex items-center justify-between p-3 rounded-md text-left transition-colors"
                  style={{ background: '#1c1c1c', border: '1px solid #333' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3ecf8e'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">{proj.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{proj.filename}</div>
                  </div>
                  <div className="text-xs text-text-muted">
                    {new Date(proj.modified).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
