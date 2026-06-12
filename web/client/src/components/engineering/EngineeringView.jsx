import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Cpu, Plus, Zap, Printer, Download, Folder, ChevronRight, ChevronDown, Loader, FileCode } from 'lucide-react';
import { parseProjectL5X } from '../../utils/studio5000Export';
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

function collectAllPaths(nodes, result = []) {
  for (const n of nodes) {
    result.push(n.path);
    if (n.children?.length) collectAllPaths(n.children, result);
  }
  return result;
}

function FolderNode({ node, depth = 0, selected, onToggle }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const checked = selected.has(node.path);
  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: depth * 16 + 4, paddingTop: 3, paddingBottom: 3,
          borderRadius: 3,
        }}
        className="tree-node"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(node.path)}
          onClick={e => e.stopPropagation()}
          style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }}
        />
        <span
          style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, cursor: hasChildren ? 'pointer' : 'default' }}
          onClick={() => hasChildren && setOpen(o => !o)}
        >
          {hasChildren
            ? (open ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />)
            : <span style={{ width: 12, flexShrink: 0 }} />
          }
          <Folder size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{node.name}</span>
        </span>
      </div>
      {open && hasChildren && node.children.map((child, i) => (
        <FolderNode key={i} node={child} depth={depth + 1} selected={selected} onToggle={onToggle} />
      ))}
    </div>
  );
}

function AOIGroup({ group, s5kSelected, onToggleAOI, onToggleInstance }) {
  const [expanded, setExpanded] = useState(true);
  const allSelected = group.instances.every(i => s5kSelected.has(`${group.aoiName}::${i.name}`));
  const someSelected = !allSelected && group.instances.some(i => s5kSelected.has(`${group.aoiName}::${i.name}`));
  const checkRef = useRef(null);
  useEffect(() => { if (checkRef.current) checkRef.current.indeterminate = someSelected; }, [someSelected]);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', background: 'var(--bg-surface)', borderRadius: 5 }}>
        <input
          type="checkbox"
          ref={checkRef}
          checked={allSelected}
          onChange={() => onToggleAOI(group.aoiName, !allSelected)}
          style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }}
        />
        <span
          style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded
            ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
          <FileCode size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{group.aoiName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {group.instances.length} instance{group.instances.length !== 1 ? 's' : ''}
          </span>
        </span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 22 }}>
          {group.instances.map((inst, i) => (
            <div
              key={i}
              className="tree-node"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 3, cursor: 'pointer' }}
              onClick={() => onToggleInstance(group.aoiName, inst.name)}
            >
              <input
                type="checkbox"
                checked={s5kSelected.has(`${group.aoiName}::${inst.name}`)}
                onChange={() => onToggleInstance(group.aoiName, inst.name)}
                onClick={e => e.stopPropagation()}
                style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: inst.isNamed ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {inst.name}
              </span>
              {inst.tagRef !== inst.name && (
                <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{inst.tagRef}</span>
              )}
            </div>
          ))}
        </div>
      )}
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
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [s5kModal, setS5kModal] = useState(null); // null | { groups: [...] } | { error: string }
  const [s5kSelected, setS5kSelected] = useState(new Set()); // "${aoiName}::${instName}"

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
        const folders = result.folders || [];
      setFolderModal({ loading: false, folders, error: null });
      setSelectedPaths(new Set(collectAllPaths(folders)));
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Unknown error';
      setFolderModal({ loading: false, folders: null, error: msg });
    }
  }, [project, toast]);

  const handleTogglePath = useCallback((path) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (folderModal?.folders) setSelectedPaths(new Set(collectAllPaths(folderModal.folders)));
  }, [folderModal]);

  const handleSelectNone = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handleImportFolders = useCallback(() => {
    if (!folderModal?.folders || selectedPaths.size === 0) return;
    const now = new Date().toISOString();
    const newAreas = [];
    let counter = 1;
    const pathToLocalId = {};

    function walk(node, parentPath) {
      const selected = selectedPaths.has(node.path);
      const localId = selected ? counter++ : null;
      if (selected) {
        pathToLocalId[node.path] = localId;
        const parentLocalId = parentPath != null ? (pathToLocalId[parentPath] ?? null) : null;
        newAreas.push({ _localId: localId, _parentLocalId: parentLocalId, name: node.name, description: '' });
      }
      if (node.children?.length) {
        node.children.forEach(c => walk(c, selected ? node.path : parentPath));
      }
    }
    folderModal.folders.forEach(f => walk(f, null));

    if (!newAreas.length) return;

    updateProject(p => {
      const existing = p.areas || [];
      const maxId = existing.length ? Math.max(...existing.map(a => a.id)) : 0;
      const mapped = newAreas.map(a => ({
        id: maxId + a._localId,
        name: a.name,
        description: a.description,
        parentId: a._parentLocalId != null ? maxId + a._parentLocalId : null,
        lastModification: now,
      }));
      return { ...p, areas: [...existing, ...mapped] };
    });

    toast.success(`Imported ${newAreas.length} folder${newAreas.length !== 1 ? 's' : ''} as areas`);
    setFolderModal(null);
    setSelectedPaths(new Set());
  }, [folderModal, selectedPaths, updateProject, toast]);

  const handleOpenStudio5000Import = useCallback(() => {
    setCtxMenu(null);
    const content = project?.studio5000?.projectL5X?.content;
    if (!content) {
      toast.error('No Studio 5000 project file set — configure it in Settings → Studio 5000');
      return;
    }
    try {
      const groups = parseProjectL5X(content);
      if (!groups.length) {
        toast.error('No AOI definitions found in the project file');
        return;
      }
      // Default: select all instances
      const all = new Set();
      for (const g of groups) g.instances.forEach(i => all.add(`${g.aoiName}::${i.name}`));
      setS5kSelected(all);
      setS5kModal({ groups });
    } catch (err) {
      toast.error('Failed to parse project file: ' + err.message);
    }
  }, [project, toast]);

  const handleToggleS5kAOI = useCallback((aoiName, select) => {
    setS5kSelected(prev => {
      const next = new Set(prev);
      const group = s5kModal?.groups?.find(g => g.aoiName === aoiName);
      if (!group) return next;
      group.instances.forEach(i => {
        const key = `${aoiName}::${i.name}`;
        if (select) next.add(key); else next.delete(key);
      });
      return next;
    });
  }, [s5kModal]);

  const handleToggleS5kInstance = useCallback((aoiName, instName) => {
    setS5kSelected(prev => {
      const next = new Set(prev);
      const key = `${aoiName}::${instName}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleSelectAllS5k = useCallback(() => {
    if (!s5kModal?.groups) return;
    const all = new Set();
    for (const g of s5kModal.groups) g.instances.forEach(i => all.add(`${g.aoiName}::${i.name}`));
    setS5kSelected(all);
  }, [s5kModal]);

  const handleSelectNoneS5k = useCallback(() => setS5kSelected(new Set()), []);

  const handleImportStudio5000 = useCallback(() => {
    if (!s5kModal?.groups || !s5kSelected.size) return;
    const now = new Date().toISOString();
    const toImport = new Map(); // aoiName → instance names[]
    for (const group of s5kModal.groups) {
      const selected = group.instances.filter(i => s5kSelected.has(`${group.aoiName}::${i.name}`));
      if (selected.length) toImport.set(group.aoiName, selected.map(i => i.name));
    }
    if (!toImport.size) return;

    updateProject(p => {
      const templates = [...(p.templates || [])];
      let maxTplId = templates.length ? Math.max(...templates.map(t => t.id)) : 0;
      for (const [aoiName, instNames] of toImport) {
        let tpl = templates.find(t => t.name === aoiName);
        if (!tpl) {
          maxTplId++;
          tpl = { id: maxTplId, name: aoiName, description: '', color: '#3b82f6', attributes: [], instances: [], profiles: [], lastModification: now };
          templates.push(tpl);
        }
        const existingNames = new Set(tpl.instances.map(i => i.name));
        let maxInstId = tpl.instances.length ? Math.max(...tpl.instances.map(i => i.id)) : 0;
        for (const name of instNames) {
          if (!existingNames.has(name)) {
            maxInstId++;
            tpl.instances.push({ id: maxInstId, name, attributes: [], lastModification: now });
          }
        }
      }
      return { ...p, templates };
    });

    const total = [...toImport.values()].reduce((s, arr) => s + arr.length, 0);
    toast.success(`Imported ${total} instance${total !== 1 ? 's' : ''} from Studio 5000`);
    setS5kModal(null);
    setS5kSelected(new Set());
  }, [s5kModal, s5kSelected, updateProject, toast]);

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
            Import from Ignition
          </div>
          {project?.studio5000?.enableMenuItems && (
            <div
              className="context-menu-item"
              style={!project?.studio5000?.projectL5X ? { opacity: 0.45 } : {}}
              onClick={handleOpenStudio5000Import}
            >
              <FileCode size={14} />
              Import from Studio 5000
              {!project?.studio5000?.projectL5X && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(no file set)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Folder structure modal */}
      {folderModal && (
        <Modal
          title="Ignition Folder Structure"
          onClose={() => setFolderModal(null)}
          width={460}
          footer={
            folderModal.folders && !folderModal.loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleSelectAll}>All</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleSelectNone}>None</button>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedPaths.size} of {collectAllPaths(folderModal.folders).length} selected
                </span>
                <button className="btn btn-secondary" onClick={() => setFolderModal(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={selectedPaths.size === 0}
                  onClick={handleImportFolders}
                >
                  <Download size={13} /> Import
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => setFolderModal(null)}>Close</button>
            )
          }
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
                  {folderModal.folders.map((f, i) => (
                    <FolderNode key={i} node={f} depth={0} selected={selectedPaths} onToggle={handleTogglePath} />
                  ))}
                </div>
          )}
        </Modal>
      )}

      {/* Studio 5000 import modal */}
      {s5kModal && (
        <Modal
          title="Import from Studio 5000"
          onClose={() => setS5kModal(null)}
          width={500}
          footer={
            s5kModal.groups ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleSelectAllS5k}>All</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleSelectNoneS5k}>None</button>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>
                  {s5kSelected.size} of {s5kModal.groups.reduce((n, g) => n + g.instances.length, 0)} selected
                </span>
                <button className="btn btn-secondary" onClick={() => setS5kModal(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={s5kSelected.size === 0}
                  onClick={handleImportStudio5000}
                >
                  <Download size={13} /> Import
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => setS5kModal(null)}>Close</button>
            )
          }
        >
          {s5kModal.error && (
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>{s5kModal.error}</div>
          )}
          {s5kModal.groups && (
            <div style={{ maxHeight: 440, overflowY: 'auto', overflowX: 'hidden' }}>
              {s5kModal.groups.map((group, i) => (
                <AOIGroup
                  key={i}
                  group={group}
                  s5kSelected={s5kSelected}
                  onToggleAOI={handleToggleS5kAOI}
                  onToggleInstance={handleToggleS5kInstance}
                />
              ))}
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
