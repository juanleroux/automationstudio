import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Cpu, Plus, Zap, Printer, Download, Folder, ChevronRight, ChevronDown, Loader } from 'lucide-react';
import NoProjectOpen from '../shared/NoProjectOpen';
import { VERSION } from '../../version';
import TemplateTree from './TemplateTree';
import AttributeGrid from './AttributeGrid';
import ProfilePanel, { ProfileForm } from './ProfilePanel';
import Modal from '../shared/Modal';
import { useProject } from '../../context/ProjectContext';
import AreasView from '../areas/AreasView';
import { openCommissioningReport } from '../../utils/commissioningReport';
import { getFoldersFromIgnition } from '../../api/client';
import { useToast } from '../shared/Toast';

function FolderNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: depth * 16 + 4, paddingTop: 3, paddingBottom: 3,
          cursor: hasChildren ? 'pointer' : 'default',
          borderRadius: 3,
        }}
        className="tree-node"
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {hasChildren
          ? (open ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />)
          : <span style={{ width: 12, flexShrink: 0 }} />
        }
        <Folder size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{node.name}</span>
      </div>
      {open && hasChildren && node.children.map((child, i) => (
        <FolderNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

const BLANK_PROFILE = { name: '', description: '', exportType: 0, formatType: 0, tabularExportDelimiter: ',', structuralExportTemplate: '', customFormat: '' };

function RightPanel({ selected, selectedTemplate, selectedInstance, project, onUpdateTemplateAttrs, onUpdateInstanceAttrs, onUpdateTemplate }) {
  const [activeTab, setActiveTab] = useState(0);
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [newProfileDraft, setNewProfileDraft] = useState(BLANK_PROFILE);
  const mode = selected?.type === 'instance' ? 'instance' : 'template';

  useEffect(() => { setActiveTab(0); }, [selected?.templateId, selected?.instanceId]);

  if (!selected) {
    return (
      <div className="relative flex items-center justify-center h-full" style={{ userSelect: 'none', pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-3" style={{ opacity: 0.07 }}>
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ width: 96, height: 96, background: 'var(--text-primary)' }}
          >
            <Zap size={56} color="var(--bg-main)" />
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            Automation Studio
          </span>
        </div>
        <span
          style={{
            position: 'absolute', bottom: 12, right: 16,
            fontSize: 11, color: 'var(--text-disabled)', opacity: 0.6,
          }}
        >
          Automation Studio {VERSION}
        </span>
      </div>
    );
  }

  const profiles = selectedTemplate?.profiles || [];
  const tabs = [
    { id: 'attrs', label: mode === 'instance' ? `${selectedInstance?.name || 'Instance'} Attributes` : 'Attributes' },
    ...(mode === 'template' ? profiles.map((p, i) => ({ id: `profile_${i}`, label: p.name || `Profile ${i + 1}` })) : [])
  ];

  const handleConfirmAddProfile = () => {
    onUpdateTemplate(t => ({
      ...t,
      profiles: [...(t.profiles || []), { ...newProfileDraft, attributes: [] }]
    }));
    setActiveTab(tabs.length);
    setShowAddProfileModal(false);
    setNewProfileDraft(BLANK_PROFILE);
  };

  return (
    <div className="flex flex-col h-full">
      {showAddProfileModal && (
        <Modal
          title="Add Profile"
          onClose={() => { setShowAddProfileModal(false); setNewProfileDraft(BLANK_PROFILE); }}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowAddProfileModal(false); setNewProfileDraft(BLANK_PROFILE); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmAddProfile} disabled={!newProfileDraft.name.trim()}>Add</button>
            </>
          }
        >
          <ProfileForm profile={newProfileDraft} onChange={setNewProfileDraft} />
        </Modal>
      )}

      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
        <div className="flex-1 flex overflow-x-auto" style={{ border: 'none' }}>
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === i ? 'active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.label}
            </button>
          ))}
          {mode === 'template' && (
            <button
              className="tab-item add-profile-tab"
              onClick={() => { setNewProfileDraft(BLANK_PROFILE); setShowAddProfileModal(true); }}
              style={{ color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-disabled)'}
            >
              <Plus size={13} /> Add Profile
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 0 ? (
          <AttributeGrid
            attributes={mode === 'instance' ? (selectedInstance?.attributes || []) : (selectedTemplate?.attributes || [])}
            templateAttributes={mode === 'instance' ? selectedTemplate?.attributes : undefined}
            mode={mode}
            onChange={mode === 'instance' ? onUpdateInstanceAttrs : onUpdateTemplateAttrs}
          />
        ) : (
          <ProfilePanel
            key={activeTab}
            profile={profiles[activeTab - 1]}
            template={selectedTemplate}
            profileIndex={activeTab - 1}
            onUpdateTemplate={onUpdateTemplate}
          />
        )}
      </div>

      <div className="flex-shrink-0 px-3 py-1 text-xs flex items-center gap-4" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-main)', color: 'var(--text-disabled)' }}>
        {mode === 'template' && selectedTemplate && (
          <>
            <span>{selectedTemplate.attributes?.length || 0} attributes</span>
            <span>{selectedTemplate.instances?.length || 0} instances</span>
            <span>{selectedTemplate.profiles?.length || 0} profiles</span>
          </>
        )}
        {mode === 'instance' && selectedInstance && (
          <>
            <span>{selectedInstance.name}</span>
            <span>Template: {selectedTemplate?.name}</span>
            {selectedInstance.isFlagged && <span style={{ color: '#e55353' }}>● Flagged</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default function EngineeringView() {
  const { project, updateProject } = useProject();
  const toast = useToast();
  const [assetTab, setAssetTab] = useState('derivation');
  const [selected, setSelected] = useState(null);
  const [paneWidth, setPaneWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y }
  const [folderModal, setFolderModal] = useState(null); // null | { loading, folders, error }

  const onMouseDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = paneWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta));
      setPaneWidth(newW);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const selectedTemplate = selected?.templateId
    ? (project?.templates || []).find(t => t.id === selected.templateId) || null
    : null;

  const selectedInstance = selected?.type === 'instance' && selectedTemplate
    ? (selectedTemplate.instances || []).find(i => i.id === selected.instanceId) || null
    : null;

  const handleUpdateTemplateAttrs = useCallback((updater) => {
    if (!selectedTemplate) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? { ...t, lastModification: now, attributes: typeof updater === 'function' ? updater(t.attributes || []) : updater }
          : t
      )
    }));
  }, [selectedTemplate, updateProject]);

  const handleUpdateInstanceAttrs = useCallback((updater) => {
    if (!selectedTemplate || !selectedInstance) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? {
              ...t,
              instances: (t.instances || []).map(i =>
                i.id === selectedInstance.id
                  ? { ...i, lastModification: now, attributes: typeof updater === 'function' ? updater(i.attributes || []) : updater }
                  : i
              )
            }
          : t
      )
    }));
  }, [selectedTemplate, selectedInstance, updateProject]);

  const handleUpdateTemplate = useCallback((updater) => {
    if (!selectedTemplate) return;
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === selectedTemplate.id
          ? (typeof updater === 'function' ? updater(t) : updater)
          : t
      )
    }));
  }, [selectedTemplate, updateProject]);

  const handleContextMenu = useCallback((e) => {
    // Only fire on direct background click, not on interactive children
    if (e.target !== e.currentTarget && e.target.closest('[data-interactive]')) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleDownloadFolders = useCallback(async () => {
    setCtxMenu(null);
    const eng = project?.engineering;
    if (!eng?.ignitionGateway) {
      toast.error('Configure Ignition gateway in Settings first');
      return;
    }
    setFolderModal({ loading: true, folders: null, error: null });
    try {
      const result = await getFoldersFromIgnition({
        gatewayUrl: eng.ignitionGateway,
        apiKey: eng.apiKey,
        provider: eng.provider || 'default',
        folderPath: eng.folderPath || undefined,
      });
      setFolderModal({ loading: false, folders: result.folders || [], error: null });
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Unknown error';
      setFolderModal({ loading: false, folders: null, error: msg });
    }
  }, [project, toast]);

  if (!project) {
    return <NoProjectOpen />;
  }

  return (
    <div className="flex flex-col h-full" onContextMenu={handleContextMenu}>
      {/* Context menu */}
      {ctxMenu && (
        <div
          className="context-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={handleDownloadFolders}>
            <Download size={14} />
            Download Folder Structure from Ignition
          </div>
        </div>
      )}

      {/* Folder structure modal */}
      {folderModal && (
        <Modal
          title="Ignition Folder Structure"
          onClose={() => setFolderModal(null)}
          width={420}
          footer={<button className="btn btn-secondary" onClick={() => setFolderModal(null)}>Close</button>}
        >
          {folderModal.loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Fetching folders from Ignition…
            </div>
          )}
          {folderModal.error && (
            <div style={{ color: 'var(--danger)', padding: '12px 0', fontSize: 13 }}>
              {folderModal.error}
            </div>
          )}
          {folderModal.folders && !folderModal.loading && (
            folderModal.folders.length === 0
              ? <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>No folders found.</div>
              : <div style={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
                  {folderModal.folders.map((f, i) => <FolderNode key={i} node={f} depth={0} />)}
                </div>
          )}
        </Modal>
      )}

      {/* View tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {['derivation', 'model'].map(tab => (
          <button
            key={tab}
            className={`tab-item ${assetTab === tab ? 'active' : ''}`}
            onClick={() => setAssetTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab === 'derivation' ? 'Derivation' : 'Model'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ width: 1, height: 16, background: 'var(--border)', marginRight: 2, flexShrink: 0 }} />
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => openCommissioningReport(project)}
          title="Print commissioning check sheet"
          style={{ marginRight: 6, color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <Printer size={15} />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {assetTab === 'derivation' && (
          <div className="flex h-full">
            <div
              className="flex flex-col flex-shrink-0 overflow-hidden"
              style={{ width: paneWidth, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
            >
              <TemplateTree selected={selected} onSelect={setSelected} />
            </div>

            <div className="resize-handle" onMouseDown={onMouseDown} />

            <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-main)' }}>
              <RightPanel
                selected={selected}
                selectedTemplate={selectedTemplate}
                selectedInstance={selectedInstance}
                project={project}
                onUpdateTemplateAttrs={handleUpdateTemplateAttrs}
                onUpdateInstanceAttrs={handleUpdateInstanceAttrs}
                onUpdateTemplate={handleUpdateTemplate}
              />
            </div>
          </div>
        )}

        {assetTab === 'model' && <AreasView />}
      </div>
    </div>
  );
}
