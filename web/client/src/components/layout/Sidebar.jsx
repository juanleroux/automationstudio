import React, { useState, useRef } from 'react';
import {
  Cpu, Map, Settings, ChevronLeft, ChevronRight,
  FilePlus, FolderOpen, Save, Zap, Trash2, Download, Upload
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import { listProjects, createProject, loadProject, saveProject, deleteProject } from '../../api/client';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';

const NAV_ITEMS = [
  { id: 'engineering', label: 'Assets', icon: Cpu },
  { id: 'areas', label: 'Model', icon: Map },
];

export default function Sidebar({ activeView, onChangeView }) {
  const { project, filename, isDirty, isSaving, openProject, saveCurrentProject, closeProject } = useProject();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);
  const importProjectRef = useRef(null);

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

  const handleExportProject = async (proj, e) => {
    e.stopPropagation();
    try {
      const data = await loadProject(proj.filename);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = proj.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${proj.name}"`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const handleDeleteProject = async () => {
    const proj = confirmDeleteProject;
    try {
      await deleteProject(proj.filename);
      setProjects(ps => ps.filter(p => p.filename !== proj.filename));
      toast.success(`Deleted "${proj.name}"`);
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setConfirmDeleteProject(null);
    }
  };

  const handleImportProject = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const name = data.name || file.name.replace(/\.json$/i, '').replace(/\.atsproj$/i, '');
        const result = await createProject(name);
        await saveProject(result.filename, { ...data, name });
        await openProject(result.filename);
        setShowOpenDialog(false);
        setShowNewDialog(false);
        toast.success(`Imported "${name}"`);
        onChangeView('engineering');
      } catch (err) {
        toast.error('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
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
      <input
        ref={importProjectRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={e => { handleImportProject(e.target.files[0]); e.target.value = ''; }}
      />
      <div
        className="flex flex-col h-full flex-shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 56 : 220,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)'
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-3 py-3 flex-shrink-0"
        >
          <div
            className="flex items-center justify-center rounded-md flex-shrink-0"
            style={{ width: 32, height: 32, background: 'var(--accent)' }}
          >
            <Zap size={18} color="var(--bg-main)" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-text-primary text-sm leading-tight truncate">
                Automation Studio
              </div>
            </div>
          )}
        </div>

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
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : (!project && item.id !== 'settings') ? 'var(--text-disabled)' : 'var(--text-muted)',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
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
        <div className="flex-shrink-0 py-2" style={{ borderTop: '1px solid var(--border)' }}>
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
          style={{ borderTop: '1px solid var(--border)' }}
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
              <button
                className="btn btn-secondary flex items-center gap-2"
                onClick={() => importProjectRef.current?.click()}
              >
                <Upload size={13} /> Import
              </button>
              <div style={{ flex: 1 }} />
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
          width={500}
          footer={
            <button
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => importProjectRef.current?.click()}
            >
              <Upload size={13} /> Import Project
            </button>
          }
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
                <div
                  key={proj.filename}
                  className="flex items-center gap-2 p-3 rounded-md transition-colors"
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleOpenProject(proj)}
                  >
                    <div className="text-sm font-medium text-text-primary">{proj.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{proj.filename}</div>
                  </div>
                  <div className="text-xs text-text-muted flex-shrink-0">
                    {new Date(proj.modified).toLocaleDateString()}
                  </div>
                  <button
                    className="btn btn-ghost btn-icon flex-shrink-0"
                    title="Export project"
                    onClick={e => handleExportProject(proj, e)}
                  >
                    <Download size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon flex-shrink-0"
                    title="Delete project"
                    style={{ color: '#e55353' }}
                    onClick={e => { e.stopPropagation(); setConfirmDeleteProject(proj); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {confirmDeleteProject && (
        <ConfirmDialog
          title="Delete Project"
          message={`Delete "${confirmDeleteProject.name}"? This cannot be undone.`}
          danger
          onConfirm={handleDeleteProject}
          onCancel={() => setConfirmDeleteProject(null)}
        />
      )}
    </>
  );
}
