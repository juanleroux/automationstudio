import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, Map, Tag, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import Modal from '../shared/Modal';

function nextId(arr) {
  if (!arr || !arr.length) return 1;
  return Math.max(...arr.map(x => x.id)) + 1;
}

// Build nested tree from flat areas array using parentId
function buildTree(areas, parentId = null) {
  return areas
    .filter(a => (a.parentId ?? null) === parentId)
    .map(a => ({ ...a, children: buildTree(areas, a.id) }));
}

// Flatten tree into ordered rows, only including children of expanded nodes
function flattenVisible(nodes, expanded, depth = 0) {
  const rows = [];
  for (const node of nodes) {
    rows.push({ ...node, depth });
    if (expanded.has(node.id) && node.children.length > 0) {
      rows.push(...flattenVisible(node.children, expanded, depth + 1));
    }
  }
  return rows;
}

// Collect all descendant IDs of an area
function collectDescendants(areas, areaId) {
  const ids = [];
  const children = areas.filter(a => a.parentId === areaId);
  for (const child of children) {
    ids.push(child.id);
    ids.push(...collectDescendants(areas, child.id));
  }
  return ids;
}

export default function AreasView() {
  const { project, updateProject } = useProject();
  const toast = useToast();

  const [expanded, setExpanded] = useState(new Set([1]));
  const [editingArea, setEditingArea] = useState(null);
  const [addParentId, setAddParentId] = useState(null); // null = top-level
  const [showAddArea, setShowAddArea] = useState(false);
  const [newArea, setNewArea] = useState({ name: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <Map size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No Project Open</p>
        </div>
      </div>
    );
  }

  const areas = project.areas || [];
  const templates = project.templates || [];

  // Build area → instances map
  const areaInstances = {};
  areas.forEach(a => { areaInstances[a.id] = []; });
  areaInstances[0] = [];
  templates.forEach(t => {
    (t.instances || []).forEach(inst => {
      const areaId = inst.areaId ?? 0;
      if (!areaInstances[areaId]) areaInstances[areaId] = [];
      areaInstances[areaId].push({ ...inst, templateId: t.id, templateName: t.name });
    });
  });

  const tree = buildTree(areas);
  const visibleAreas = flattenVisible(tree, expanded);

  const allAreas = [
    { id: 0, name: 'Unassigned', description: 'Instances not assigned to any area', isSystem: true, depth: 0, children: [] },
    ...visibleAreas
  ];

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const openAddArea = (parentId = null) => {
    setAddParentId(parentId);
    setNewArea({ name: '', description: '' });
    setShowAddArea(true);
    // Auto-expand parent so the new child is visible
    if (parentId !== null) {
      setExpanded(prev => new Set([...prev, parentId]));
    }
  };

  const addArea = () => {
    if (!newArea.name.trim()) return;
    const now = new Date().toISOString();
    const id = nextId(areas);
    updateProject(p => ({
      ...p,
      areas: [
        ...(p.areas || []),
        { id, name: newArea.name.trim(), description: newArea.description.trim(), parentId: addParentId, lastModification: now }
      ]
    }));
    setShowAddArea(false);
    setNewArea({ name: '', description: '' });
    toast.success(`${addParentId !== null ? 'Sub-area' : 'Area'} "${newArea.name.trim()}" added`);
    setExpanded(prev => new Set([...prev, id]));
  };

  const saveEditArea = () => {
    if (!editingArea || !editingArea.name.trim()) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      areas: (p.areas || []).map(a =>
        a.id === editingArea.id
          ? { ...a, name: editingArea.name.trim(), description: editingArea.description, lastModification: now }
          : a
      )
    }));
    setEditingArea(null);
    toast.success('Area updated');
  };

  const deleteArea = (areaId) => {
    const descendants = collectDescendants(areas, areaId);
    const toRemove = new Set([areaId, ...descendants]);
    updateProject(p => ({
      ...p,
      areas: (p.areas || []).filter(a => !toRemove.has(a.id)),
      templates: p.templates.map(t => ({
        ...t,
        instances: (t.instances || []).map(i =>
          toRemove.has(i.areaId) ? { ...i, areaId: 0 } : i
        )
      }))
    }));
    setConfirmDelete(null);
    const extra = descendants.length > 0 ? ` and ${descendants.length} sub-area(s)` : '';
    toast.success(`Area deleted${extra} (instances moved to Unassigned)`);
  };

  const moveInstance = (templateId, instanceId, targetAreaId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === templateId
          ? { ...t, instances: (t.instances || []).map(i => i.id === instanceId ? { ...i, areaId: targetAreaId } : i) }
          : t
      )
    }));
  };

  const handleDragStart = (e, templateId, instanceId) => {
    setDragging({ templateId, instanceId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetAreaId) => {
    e.preventDefault();
    if (!dragging) return;
    moveInstance(dragging.templateId, dragging.instanceId, targetAreaId);
    toast.success('Instance moved');
    setDragOver(null);
    setDragging(null);
  };

  const parentArea = addParentId !== null ? areas.find(a => a.id === addParentId) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: '#1c1c1c' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #333', background: '#242424' }}
      >
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Model</h2>
          <p className="text-xs text-text-muted">
            {areas.length} areas, {templates.reduce((s, t) => s + (t.instances?.length || 0), 0)} total instances
          </p>
        </div>
      </div>

      {/* Areas table */}
      <div className="flex-1 overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Area Name</th>
              <th>Description</th>
              <th style={{ width: 80 }}>Instances</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allAreas.map(area => {
              const instances = areaInstances[area.id] || [];
              const isExp = expanded.has(area.id);
              const isDragTarget = dragOver === area.id;
              const hasChildren = area.children?.length > 0;
              const indent = (area.depth || 0) * 20;

              return (
                <React.Fragment key={area.id}>
                  {/* Area row */}
                  <tr
                    style={{
                      background: isDragTarget ? 'rgba(62,207,142,0.08)' : undefined,
                      borderLeft: isDragTarget ? '2px solid #3ecf8e' : '2px solid transparent'
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver(area.id); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => handleDrop(e, area.id)}
                  >
                    <td style={{ textAlign: 'center', paddingLeft: indent }}>
                      <button
                        className="text-text-muted hover:text-text-primary"
                        onClick={() => toggleExpand(area.id)}
                        style={{ padding: 2, visibility: (hasChildren || instances.length > 0 || !area.isSystem) ? 'visible' : 'hidden' }}
                      >
                        {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    </td>
                    <td>
                      {editingArea?.id === area.id ? (
                        <input
                          type="text"
                          value={editingArea.name}
                          onChange={e => setEditingArea(prev => ({ ...prev, name: e.target.value }))}
                          style={{ padding: '2px 6px', fontSize: 13 }}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveEditArea(); if (e.key === 'Escape') setEditingArea(null); }}
                        />
                      ) : (
                        <div className="flex items-center gap-2" style={{ paddingLeft: indent }}>
                          <Map
                            size={14}
                            style={{
                              color: area.isSystem ? '#666' : area.depth > 0 ? '#6eb5ff' : '#3ecf8e',
                              flexShrink: 0
                            }}
                          />
                          <span className="font-medium">{area.name}</span>
                          {area.isSystem && <span className="badge" style={{ fontSize: 9 }}>System</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {editingArea?.id === area.id ? (
                        <input
                          type="text"
                          value={editingArea.description}
                          onChange={e => setEditingArea(prev => ({ ...prev, description: e.target.value }))}
                          style={{ padding: '2px 6px', fontSize: 13 }}
                        />
                      ) : (
                        <span className="text-text-muted text-xs">{area.description}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge">{instances.length}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {editingArea?.id === area.id ? (
                          <>
                            <button className="btn-ghost btn-icon" style={{ padding: 3, color: '#3ecf8e' }} onClick={saveEditArea} title="Save">
                              <Check size={13} />
                            </button>
                            <button className="btn-ghost btn-icon" style={{ padding: 3 }} onClick={() => setEditingArea(null)} title="Cancel">
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            {!area.isSystem && (
                              <>
                                <button
                                  className="btn-ghost btn-icon"
                                  style={{ padding: 3, color: 'var(--text-disabled)' }}
                                  onClick={() => openAddArea(area.id)}
                                  title="Add sub-area"
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  className="btn-ghost btn-icon"
                                  style={{ padding: 3 }}
                                  onClick={() => setEditingArea({ id: area.id, name: area.name, description: area.description || '' })}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  className="btn-ghost btn-icon"
                                  style={{ padding: 3, color: '#e55353' }}
                                  onClick={() => setConfirmDelete({ id: area.id, name: area.name, hasChildren: area.children?.length > 0 })}
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Instance rows */}
                  {isExp && instances.map(inst => (
                    <tr
                      key={`${inst.templateId}_${inst.id}`}
                      style={{ background: '#1a1a1a', cursor: 'grab' }}
                      draggable
                      onDragStart={e => handleDragStart(e, inst.templateId, inst.id)}
                    >
                      <td></td>
                      <td style={{ paddingLeft: 36 + indent }}>
                        <div className="flex items-center gap-2">
                          <Tag size={12} style={{ color: '#666', flexShrink: 0 }} />
                          <span className="text-sm">{inst.name}</span>
                          {inst.isFlagged && (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#e55353' }} title="Flagged" />
                          )}
                        </div>
                      </td>
                      <td><span className="text-text-muted text-xs">{inst.description}</span></td>
                      <td><span className="text-text-muted text-xs">{inst.templateName}</span></td>
                      <td></td>
                    </tr>
                  ))}
                  {isExp && instances.length === 0 && !hasChildren && (
                    <tr style={{ background: '#1a1a1a' }}>
                      <td></td>
                      <td colSpan={4} style={{ paddingLeft: 36 + indent, color: '#555', fontSize: 11, fontStyle: 'italic', paddingTop: 6, paddingBottom: 6 }}>
                        No instances — drag instances here or assign from Assets view
                      </td>
                    </tr>
                  )}
                  {isExp && !area.isSystem && (
                    <tr onClick={() => openAddArea(area.id)} style={{ cursor: 'pointer', background: '#1a1a1a' }} className="add-row">
                      <td></td>
                      <td colSpan={4} style={{ paddingLeft: 36 + indent, padding: '5px 12px 5px ' + (36 + indent) + 'px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-disabled)', fontSize: 12 }}>
                          <Plus size={13} /> Add Area
                        </span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Add top-level area row */}
            <tr onClick={() => openAddArea(null)} style={{ cursor: 'pointer' }} className="add-row">
              <td colSpan={5} style={{ padding: '6px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-disabled)', fontSize: 12 }}>
                  <Plus size={13} /> Add Area
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Area / Sub-Area Modal */}
      {showAddArea && (
        <Modal
          title={parentArea ? `Add Sub-Area under "${parentArea.name}"` : 'Add Area'}
          onClose={() => setShowAddArea(false)}
          width={400}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddArea(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addArea} disabled={!newArea.name.trim()}>Add</button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {parentArea ? 'Sub-Area Name *' : 'Area Name *'}
              </label>
              <input
                type="text"
                value={newArea.name}
                onChange={e => setNewArea(p => ({ ...p, name: e.target.value }))}
                placeholder={parentArea ? 'Zone A' : 'Line 1'}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addArea()}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Description</label>
              <input
                type="text"
                value={newArea.description}
                onChange={e => setNewArea(p => ({ ...p, description: e.target.value }))}
                placeholder={parentArea ? `Sub-section of ${parentArea.name}` : 'Production line 1'}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Area"
          message={
            confirmDelete.hasChildren
              ? `Delete "${confirmDelete.name}" and all its sub-areas? Instances will be moved to Unassigned.`
              : `Delete area "${confirmDelete.name}"? Instances will be moved to Unassigned.`
          }
          danger
          onConfirm={() => deleteArea(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
