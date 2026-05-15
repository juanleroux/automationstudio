import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Tag,
  Circle, Search, Filter, Plus, Trash2, Copy, Edit2,
  Upload, Download, Flag, MoreVertical
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import Modal from '../shared/Modal';

function nextId(arr) {
  if (!arr || !arr.length) return 1;
  return Math.max(...arr.map(x => x.id)) + 1;
}

export default function TemplateTree({ selected, onSelect }) {
  const { project, updateProject } = useProject();
  const toast = useToast();

  const [expanded, setExpanded] = useState(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | flagged
  const [contextMenu, setContextMenu] = useState(null);
  const [renaming, setRenaming] = useState(null); // { type: 'template'|'instance', templateId, instanceId }
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddInstance, setShowAddInstance] = useState(null); // templateId
  const [newName, setNewName] = useState('');
  const [importModalTemplate, setImportModalTemplate] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const renameInputRef = useRef(null);

  const templates = project?.templates || [];
  const areas = project?.areas || [];

  useEffect(() => {
    if (renameInputRef.current) renameInputRef.current.focus();
  }, [renaming]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => { window.removeEventListener('click', handler); window.removeEventListener('contextmenu', handler); };
  }, [contextMenu]);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const handleContextMenu = (e, type, templateId, instanceId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, templateId, instanceId });
  };

  const startRename = (type, templateId, instanceId, currentName) => {
    setRenaming({ type, templateId, instanceId });
    setRenameValue(currentName);
    setContextMenu(null);
  };

  const commitRename = () => {
    if (!renaming || !renameValue.trim()) { setRenaming(null); return; }
    const now = new Date().toISOString();
    if (renaming.type === 'template') {
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t =>
          t.id === renaming.templateId
            ? { ...t, name: renameValue.trim(), lastModification: now }
            : t
        )
      }));
    } else {
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t =>
          t.id === renaming.templateId
            ? {
                ...t,
                instances: (t.instances || []).map(i =>
                  i.id === renaming.instanceId
                    ? { ...i, name: renameValue.trim(), lastModification: now }
                    : i
                )
              }
            : t
        )
      }));
    }
    setRenaming(null);
  };

  const addTemplate = () => {
    if (!newName.trim()) return;
    const now = new Date().toISOString();
    const id = nextId(templates);
    const tmpl = {
      id, name: newName.trim(), description: '',
      lastModification: now,
      attributes: [], instances: [], profiles: []
    };
    updateProject(p => ({ ...p, templates: [...p.templates, tmpl] }));
    setExpanded(prev => new Set([...prev, id]));
    onSelect({ type: 'template', templateId: id });
    setShowAddTemplate(false);
    setNewName('');
    toast.success(`Template "${newName.trim()}" added`);
  };

  const addInstance = (templateId) => {
    if (!newName.trim()) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t => {
        if (t.id !== templateId) return t;
        const instId = nextId(t.instances || []);
        const firstArea = areas.find(a => a.id !== 0);
        return {
          ...t,
          instances: [...(t.instances || []), {
            id: instId,
            areaId: firstArea ? firstArea.id : 0,
            name: newName.trim(),
            description: '',
            isFlagged: false,
            lastModification: now,
            attributes: []
          }]
        };
      })
    }));
    setShowAddInstance(null);
    setNewName('');
    toast.success(`Instance "${newName.trim()}" added`);
  };

  const duplicateTemplate = (templateId) => {
    const orig = templates.find(t => t.id === templateId);
    if (!orig) return;
    const now = new Date().toISOString();
    const newId = nextId(templates);
    const copy = {
      ...orig,
      id: newId,
      name: `${orig.name}_Copy`,
      lastModification: now,
      instances: (orig.instances || []).map((inst, i) => ({
        ...inst,
        id: i + 1,
        name: `${inst.name}_Copy`
      }))
    };
    updateProject(p => ({ ...p, templates: [...p.templates, copy] }));
    toast.success('Template duplicated');
    setContextMenu(null);
  };

  const duplicateInstance = (templateId, instanceId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t => {
        if (t.id !== templateId) return t;
        const orig = (t.instances || []).find(i => i.id === instanceId);
        if (!orig) return t;
        const newId = nextId(t.instances || []);
        const copy = { ...orig, id: newId, name: `${orig.name}_Copy`, lastModification: new Date().toISOString() };
        return { ...t, instances: [...(t.instances || []), copy] };
      })
    }));
    toast.success('Instance duplicated');
    setContextMenu(null);
  };

  const deleteTemplate = (templateId) => {
    updateProject(p => ({ ...p, templates: p.templates.filter(t => t.id !== templateId) }));
    if (selected?.templateId === templateId) onSelect(null);
    toast.success('Template deleted');
    setConfirmDelete(null);
  };

  const deleteInstance = (templateId, instanceId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === templateId
          ? { ...t, instances: (t.instances || []).filter(i => i.id !== instanceId) }
          : t
      )
    }));
    if (selected?.instanceId === instanceId) onSelect({ type: 'template', templateId });
    toast.success('Instance deleted');
    setConfirmDelete(null);
  };

  const toggleFlag = (templateId, instanceId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === templateId
          ? {
              ...t,
              instances: (t.instances || []).map(i =>
                i.id === instanceId ? { ...i, isFlagged: !i.isFlagged } : i
              )
            }
          : t
      )
    }));
    setContextMenu(null);
  };

  // CSV Import
  const handleImportCSV = (templateId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error('CSV must have header + data rows'); return; }
      const headers = lines[0].split(',').map(h => h.trim());
      const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
      const now = new Date().toISOString();
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t => {
          if (t.id !== templateId) return t;
          let nextInstId = nextId(t.instances || []);
          const newInsts = lines.slice(1).map(line => {
            const cells = line.split(',').map(c => c.trim());
            const name = nameIdx >= 0 ? (cells[nameIdx] || `Instance_${nextInstId}`) : `Instance_${nextInstId}`;
            const instAttrs = (t.attributes || []).map(ta => {
              const idx = headers.findIndex(h => h.toLowerCase() === ta.name.toLowerCase());
              return { id: ta.id, value: idx >= 0 ? (cells[idx] || ta.value) : ta.value };
            });
            return {
              id: nextInstId++,
              areaId: 0,
              name,
              description: cells[headers.findIndex(h => h.toLowerCase() === 'description')] || '',
              isFlagged: false,
              lastModification: now,
              attributes: instAttrs
            };
          });
          return { ...t, instances: [...(t.instances || []), ...newInsts] };
        })
      }));
      toast.success(`Imported ${lines.length - 1} instances`);
      setImportModalTemplate(null);
    };
    reader.readAsText(file);
  };

  // Export attributes as CSV
  const exportAttributesCSV = (template) => {
    const attrs = template.attributes || [];
    const header = ['Name', 'Description', 'DataType', 'Value', 'Parameter'];
    const rows = attrs.map(a => [a.name, a.description || '', a.dataType, a.value || '', a.parameter ? 'true' : 'false']);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_attributes.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${attrs.length} attributes`);
    setContextMenu(null);
  };

  // Export instances as CSV
  const exportInstancesCSV = (template) => {
    const attrs = template.attributes || [];
    const header = ['Name', 'Description', ...attrs.map(a => a.name)];
    const rows = (template.instances || []).map(inst => {
      const vals = attrs.map(ta => {
        const ia = (inst.attributes || []).find(a => a.id === ta.id);
        return ia ? ia.value : ta.value;
      });
      return [inst.name, inst.description, ...vals];
    });
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_instances.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${template.instances?.length || 0} instances`);
    setContextMenu(null);
  };

  // Filter & search
  const filteredTemplates = templates.map(t => {
    let instances = t.instances || [];
    if (filter === 'flagged') instances = instances.filter(i => i.isFlagged);
    if (search) {
      const q = search.toLowerCase();
      instances = instances.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
      if (!t.name.toLowerCase().includes(q) && instances.length === 0) return null;
    }
    return { ...t, instances };
  }).filter(Boolean);

  const isSelected = (type, templateId, instanceId) => {
    if (!selected) return false;
    if (type === 'template') return selected.type === 'template' && selected.templateId === templateId && !selected.instanceId;
    return selected.type === 'instance' && selected.templateId === templateId && selected.instanceId === instanceId;
  };

  // Drag and drop between templates
  const [dragging, setDragging] = useState(null); // { templateId, instanceId }

  const handleDragStart = (e, templateId, instanceId) => {
    setDragging({ templateId, instanceId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetTemplateId) => {
    e.preventDefault();
    if (!dragging || dragging.templateId === targetTemplateId) { setDragOver(null); setDragging(null); return; }
    // Move instance from one template to another
    updateProject(p => {
      let movedInst = null;
      const templates = p.templates.map(t => {
        if (t.id === dragging.templateId) {
          const inst = (t.instances || []).find(i => i.id === dragging.instanceId);
          if (inst) movedInst = inst;
          return { ...t, instances: (t.instances || []).filter(i => i.id !== dragging.instanceId) };
        }
        return t;
      });
      if (!movedInst) return p;
      const result = templates.map(t => {
        if (t.id !== targetTemplateId) return t;
        const newId = nextId(t.instances || []);
        return { ...t, instances: [...(t.instances || []), { ...movedInst, id: newId }] };
      });
      return { ...p, templates: result };
    });
    toast.success('Instance moved');
    setDragOver(null);
    setDragging(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search & filter bar */}
      <div className="px-2 py-2 flex-shrink-0 flex gap-1" style={{ borderBottom: '1px solid #333' }}>
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ paddingLeft: 24, fontSize: 12, padding: '4px 4px 4px 24px' }}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ fontSize: 12, padding: '4px 6px', width: 'auto', minWidth: 80 }}
        >
          <option value="all">All</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      {/* Add template button */}
      <div className="px-2 py-1 flex-shrink-0" style={{ borderBottom: '1px solid #2a2a2a' }}>
        <button
          className="btn btn-ghost w-full text-xs justify-start"
          style={{ padding: '4px 8px' }}
          onClick={() => { setNewName(''); setShowAddTemplate(true); }}
        >
          <Plus size={13} /> Add Template
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-text-muted text-xs">
            <Folder size={28} className="mx-auto mb-2 opacity-30" />
            {search || filter !== 'all' ? 'No results' : 'No templates. Add one to get started.'}
          </div>
        )}
        {filteredTemplates.map(template => {
          const isExp = expanded.has(template.id);
          const instCount = template.instances?.length || 0;
          const isTSelected = isSelected('template', template.id);

          return (
            <div
              key={template.id}
              onDragOver={e => { e.preventDefault(); setDragOver(template.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, template.id)}
            >
              {/* Template row */}
              <div
                className={`tree-node flex items-center gap-1 px-2 py-1 ${isTSelected ? 'selected' : ''} ${dragOver === template.id ? 'bg-accent-muted' : ''}`}
                onClick={() => { toggleExpand(template.id); onSelect({ type: 'template', templateId: template.id }); }}
                onContextMenu={e => handleContextMenu(e, 'template', template.id, null)}
              >
                <button
                  className="flex-shrink-0 text-text-muted"
                  onClick={e => { e.stopPropagation(); toggleExpand(template.id); }}
                  style={{ padding: 1 }}
                >
                  {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {isExp ? <FolderOpen size={14} style={{ color: '#3ecf8e', flexShrink: 0 }} /> : <Folder size={14} style={{ color: '#3ecf8e', flexShrink: 0 }} />}

                {renaming?.type === 'template' && renaming.templateId === template.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    style={{ fontSize: 13, flex: 1, padding: '0 2px' }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm text-text-primary truncate"
                    onDoubleClick={e => { e.stopPropagation(); startRename('template', template.id, null, template.name); }}
                  >
                    {template.name}
                  </span>
                )}

                <span className="badge flex-shrink-0">{instCount}</span>
              </div>

              {/* Instances */}
              {isExp && (template.instances || []).map(inst => {
                const isISelected = isSelected('instance', template.id, inst.id);
                return (
                  <div
                    key={inst.id}
                    className={`tree-node flex items-center gap-1 pl-8 pr-2 py-1 ${isISelected ? 'selected' : ''}`}
                    onClick={() => onSelect({ type: 'instance', templateId: template.id, instanceId: inst.id })}
                    onContextMenu={e => handleContextMenu(e, 'instance', template.id, inst.id)}
                    draggable
                    onDragStart={e => handleDragStart(e, template.id, inst.id)}
                  >
                    <Tag size={13} style={{ color: '#9e9e9e', flexShrink: 0 }} />
                    {inst.isFlagged && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e55353', flexShrink: 0 }} />
                    )}

                    {renaming?.type === 'instance' && renaming.templateId === template.id && renaming.instanceId === inst.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onBlur={commitRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        style={{ fontSize: 12, flex: 1, padding: '0 2px' }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs text-text-secondary truncate"
                        onDoubleClick={e => { e.stopPropagation(); startRename('instance', template.id, inst.id, inst.name); }}
                      >
                        {inst.name}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Add instance row */}
              {isExp && (
                <div
                  className="flex items-center gap-1 pl-8 pr-2 py-1 cursor-pointer text-text-muted hover:text-text-primary"
                  onClick={e => { e.stopPropagation(); setNewName(''); setShowAddInstance(template.id); }}
                  style={{ fontSize: 11 }}
                >
                  <Plus size={11} /> Add instance
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.type === 'template' ? (
            <>
              <div className="context-menu-item" onClick={() => { setNewName(''); setShowAddInstance(contextMenu.templateId); setContextMenu(null); }}>
                <Plus size={14} /> Add Instance
              </div>
              <div className="context-menu-item" onClick={() => {
                const t = templates.find(x => x.id === contextMenu.templateId);
                if (t) startRename('template', contextMenu.templateId, null, t.name);
              }}>
                <Edit2 size={14} /> Rename
              </div>
              <div className="context-menu-item" onClick={() => duplicateTemplate(contextMenu.templateId)}>
                <Copy size={14} /> Duplicate
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-submenu">
                <div className="context-menu-item">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Download size={14} /> Export</span>
                  <ChevronRight size={12} style={{ opacity: 0.6 }} />
                </div>
                <div className="context-menu-submenu-panel">
                  <div className="context-menu-item" onClick={() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    if (t) exportAttributesCSV(t);
                  }}>
                    <Download size={14} /> Export Attributes
                  </div>
                  <div className="context-menu-item" onClick={() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    if (t) exportInstancesCSV(t);
                  }}>
                    <Download size={14} /> Export Instances
                  </div>
                </div>
              </div>
              <div className="context-menu-submenu">
                <div className="context-menu-item">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={14} /> Import</span>
                  <ChevronRight size={12} style={{ opacity: 0.6 }} />
                </div>
                <div className="context-menu-submenu-panel">
                  <div className="context-menu-item" onClick={() => { setImportModalTemplate(contextMenu.templateId); setContextMenu(null); }}>
                    <Upload size={14} /> Import CSV
                  </div>
                </div>
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={() => {
                const t = templates.find(x => x.id === contextMenu.templateId);
                setConfirmDelete({ type: 'template', templateId: contextMenu.templateId, name: t?.name });
                setContextMenu(null);
              }}>
                <Trash2 size={14} /> Delete Template
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item" onClick={() => {
                const t = templates.find(x => x.id === contextMenu.templateId);
                const inst = t?.instances?.find(i => i.id === contextMenu.instanceId);
                if (inst) startRename('instance', contextMenu.templateId, contextMenu.instanceId, inst.name);
              }}>
                <Edit2 size={14} /> Rename
              </div>
              <div className="context-menu-item" onClick={() => duplicateInstance(contextMenu.templateId, contextMenu.instanceId)}>
                <Copy size={14} /> Duplicate
              </div>
              <div className="context-menu-item" onClick={() => toggleFlag(contextMenu.templateId, contextMenu.instanceId)}>
                <Flag size={14} /> Toggle Flag
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={() => {
                const t = templates.find(x => x.id === contextMenu.templateId);
                const inst = t?.instances?.find(i => i.id === contextMenu.instanceId);
                setConfirmDelete({ type: 'instance', templateId: contextMenu.templateId, instanceId: contextMenu.instanceId, name: inst?.name });
                setContextMenu(null);
              }}>
                <Trash2 size={14} /> Delete Instance
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type === 'template' ? 'Template' : 'Instance'}`}
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          danger
          onConfirm={() => {
            if (confirmDelete.type === 'template') deleteTemplate(confirmDelete.templateId);
            else deleteInstance(confirmDelete.templateId, confirmDelete.instanceId);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Add Template Modal */}
      {showAddTemplate && (
        <Modal
          title="Add Template"
          onClose={() => setShowAddTemplate(false)}
          width={380}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddTemplate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTemplate} disabled={!newName.trim()}>Add</button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Template Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Motor"
              onKeyDown={e => e.key === 'Enter' && addTemplate()}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Add Instance Modal */}
      {showAddInstance !== null && (
        <Modal
          title="Add Instance"
          onClose={() => setShowAddInstance(null)}
          width={380}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddInstance(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => addInstance(showAddInstance)} disabled={!newName.trim()}>Add</button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Instance Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Motor_01"
              onKeyDown={e => e.key === 'Enter' && addInstance(showAddInstance)}
              autoFocus
            />
            {areas.length > 0 && (
              <p className="text-xs text-text-muted mt-2">Instance will be added to the first area</p>
            )}
          </div>
        </Modal>
      )}

      {/* Import CSV Modal */}
      {importModalTemplate !== null && (
        <Modal
          title="Import Instances from CSV"
          onClose={() => setImportModalTemplate(null)}
          width={440}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              CSV must have a header row. Column "Name" maps to instance name. Other columns match attribute names.
            </p>
            <div>
              <label className="block text-xs text-text-muted mb-2">Select CSV File</label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={e => handleImportCSV(importModalTemplate, e.target.files[0])}
                style={{ background: 'transparent', border: 'none', padding: 0 }}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
