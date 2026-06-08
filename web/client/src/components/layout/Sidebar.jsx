import React, { useState, useRef } from 'react';
import {
  Cpu, LayoutDashboard, Settings, ChevronLeft, ChevronRight,
  FilePlus, FolderOpen, FolderX, Save, SaveAll, Zap,
  Calculator, Network
} from 'lucide-react';
import { useProject, supportsFileSystemAccess } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';

const PROJECT_NAV = [
  { id: 'dashboard',   label: 'Dashboard', icon: LayoutDashboard, alwaysEnabled: true },
  { id: 'engineering', label: 'Assets',    icon: Cpu },
];

const TOOL_NAV = [
  { id: 'calculators', label: 'Calculators', icon: Calculator },
  { id: 'commtest',    label: 'Connections', icon: Network    },
];

export default function Sidebar({ activeView, onChangeView }) {
  const {
    project, isDirty, isSaving,
    newProject, openProject, loadProjectData,
    saveCurrentProject, saveProjectAs, closeProject,
  } = useProject();
  const toast = useToast();

  const [collapsed, setCollapsed]         = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName]             = useState('');
  const [creating, setCreating]           = useState(false);
  const [confirmClose, setConfirmClose]   = useState(false);

  // Hidden file input — fallback for browsers without File System Access API
  const openFileRef = useRef(null);

  const handleNewProject = () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      newProject(newName.trim());
      toast.success(`Project "${newName.trim()}" created`);
      onChangeView('dashboard');
      setShowNewDialog(false);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenProject = async () => {
    if (supportsFileSystemAccess) {
      try {
        const data = await openProject();
        toast.success(`Opened "${data.name}"`);
        onChangeView('dashboard');
      } catch (err) {
        if (err.name !== 'AbortError') toast.error('Failed to open: ' + err.message);
      }
    } else {
      openFileRef.current?.click();
    }
  };

  // Fallback: read file via <input type="file">
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadProjectData(data, file.name);
        toast.success(`Opened "${data.name || file.name}"`);
        onChangeView('dashboard');
      } catch {
        toast.error('Invalid project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    try {
      await saveCurrentProject();
      toast.success('Project saved');
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Save failed: ' + err.message);
    }
  };

  const handleSaveAs = async () => {
    try {
      await saveProjectAs();
      toast.success('Project saved');
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Save failed: ' + err.message);
    }
  };

  const handleCloseProject = () => {
    if (isDirty) setConfirmClose(true);
    else doClose();
  };

  const doClose = () => {
    closeProject();
    onChangeView('dashboard');
    setConfirmClose(false);
  };

  const labelStyle = (collapsed) => ({
    overflow: 'hidden', whiteSpace: 'nowrap',
    maxWidth: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1,
    transition: 'max-width 0.2s ease, opacity 0.15s ease',
  });

  return (
    <>
      {/* Fallback file picker for browsers without File System Access API */}
      <input
        ref={openFileRef}
        type="file"
        accept=".json,.atsproj.json"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <div
        className="flex flex-col h-full flex-shrink-0"
        style={{
          width: collapsed ? 56 : 220,
          transition: 'width 0.2s ease',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0">
          <div
            className="flex items-center justify-center rounded-md flex-shrink-0"
            style={{ width: 32, height: 32, background: 'var(--accent)' }}
          >
            <Zap size={18} color="var(--bg-main)" />
          </div>
          <div style={labelStyle(collapsed)}>
            <div className="font-bold text-text-primary text-sm leading-tight">
              Automation Studio
            </div>
          </div>
        </div>

        {/* Project nav — grows to fill space */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {PROJECT_NAV.map(item => {
            const Icon = item.icon;
            const active = activeView === item.id;
            const enabled = item.alwaysEnabled || !!project;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                disabled={!enabled}
                className="w-full flex items-center rounded-none transition-colors"
                style={{
                  padding: 0, flexShrink: 0,
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : !enabled ? 'var(--text-disabled)' : 'var(--text-muted)',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                  cursor: !enabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ width: 53, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 0' }}>
                  <Icon size={16} />
                </span>
                <span className="text-sm font-medium" style={labelStyle(collapsed)}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section: tool nav + project actions */}
        <div className="flex-shrink-0">
          {TOOL_NAV.map(item => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className="w-full flex items-center rounded-none transition-colors"
                style={{
                  padding: 0,
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 53, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 0' }}>
                  <Icon size={16} />
                </span>
                <span className="text-sm font-medium" style={labelStyle(collapsed)}>{item.label}</span>
              </button>
            );
          })}

          {/* Divider between tools and project actions */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Project actions */}
          {[
            { label: 'New Project',  icon: FilePlus,  onClick: () => setShowNewDialog(true), disabled: false,                title: 'New Project'  },
            { label: 'Open Project', icon: FolderOpen, onClick: handleOpenProject,            disabled: false,                title: 'Open Project' },
            { label: isSaving ? 'Saving…' : 'Save',   icon: Save,    onClick: handleSave,    disabled: !project || isSaving, title: 'Save'         },
            { label: 'Save As',      icon: SaveAll,   onClick: handleSaveAs,                  disabled: !project || isSaving, title: 'Save As'      },
            ...(project ? [{ label: 'Close Project', icon: FolderX, onClick: handleCloseProject, disabled: false, title: 'Close Project' }] : []),
            { label: 'Settings',     icon: Settings,  onClick: () => onChangeView('settings'), disabled: false,               title: 'Settings'     },
          ].map(({ label, icon: Icon, onClick, disabled, title }) => (
            <button
              key={title}
              title={collapsed ? title : undefined}
              onClick={onClick}
              disabled={disabled}
              className="w-full flex items-center rounded-none transition-colors"
              style={{
                padding: 0,
                background: 'transparent',
                color: disabled ? 'var(--text-disabled)' : 'var(--text-muted)',
                borderLeft: '3px solid transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ width: 53, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 0' }}>
                <Icon size={16} />
              </span>
              <span className="text-sm" style={labelStyle(collapsed)}>{label}</span>
            </button>
          ))}
        </div>

        {/* Collapse toggle */}
        <button
          className="w-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* New Project dialog */}
      {showNewDialog && (
        <Modal
          title="New Project"
          onClose={() => { setShowNewDialog(false); setNewName(''); }}
          width={400}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowNewDialog(false); setNewName(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleNewProject} disabled={!newName.trim() || creating}>
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

      {confirmClose && (
        <ConfirmDialog
          title="Close Project"
          message={`"${project?.name}" has unsaved changes. Close anyway?`}
          danger
          onConfirm={doClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </>
  );
}
