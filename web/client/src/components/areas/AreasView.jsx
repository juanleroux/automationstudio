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

export default function AreasView() {
  const { project, updateProject } = useProject();
  const toast = useToast();

  const [expanded, setExpanded] = useState(new Set([1]));
  const [editingArea, setEditingArea] = useState(null); // { id, name, description }
  const [showAddArea, setShowAddArea] = useState(false);
  const [newArea, setNewArea] = useState({ name: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null); // { templateId, instanceId }

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
  areaInstances[0] = []; // unassigned

  templates.forEach(t => {
    (t.instances || []).forEach(inst => {
      const areaId = inst.areaId ?? 0;
      if (!areaInstances[areaId]) areaInstances[areaId] = [];
      areaInstances[areaId].push({ ...inst, templateId: t.id, templateName: t.name });
    });
  });

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const addArea = () => {
    if (!newArea.name.trim()) return;
    const now = new Date().toISOString();
    const id = nextId(areas);
    updateProject(p => ({
      ...p,
      areas: [...(p.areas || []), { id, name: newArea.name.trim(), description: newArea.description.trim(), lastModification: now }]
    }));
    setShowAddArea(false);
    setNewArea({ name: '', description: '' });
    toast.success(`Area "${newArea.name.trim()}" added`);
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
    // Move instances in this area to unassigned
    updateProject(p => ({
      ...p,
      areas: (p.areas || []).filter(a => a.id !== areaId),
      templates: p.templates.map(t => ({
        ...t,
        instances: (t.instances || []).map(i =>
          i.areaId === areaId ? { ...i, areaId: 0 } : i
        )
      }))
    }));
    setConfirmDelete(null);
    toast.success('Area deleted (instances moved to Unassigned)');
  };

  const moveInstance = (templateId, instanceId, targetAreaId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === templateId
          ? {
              ...t,
              instances: (t.instances || []).map(i =>
                i.id === instanceId ? { ...i, areaId: targetAreaId } : i
              )
            }
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

  const allAreas = [
    { id: 0, name: 'Unassigned', description: 'Instances not assigned to any area', isSystem: true },
    ...areas
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: '#1c1c1c' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #333', background: '#242424' }}
      >
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Areas</h2>
          <p className="text-xs text-text-muted">{areas.length} areas, {templates.reduce((s, t) => s + (t.instances?.length || 0), 0)} total instances</p>
        </div>
        <button className="btn btn-primary text-sm" onClick={() => { setNewArea({ name: '', description: '' }); setShowAddArea(true); }}>
          <Plus size={14} /> Add Area
        </button>
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
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allAreas.map(area => {
              const instances = areaInstances[area.id] || [];
              const isExp = expanded.has(area.id);
              const isDragTarget = dragOver === area.id;

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
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="text-text-muted hover:text-text-primary"
                        onClick={() => toggleExpand(area.id)}
                        style={{ padding: 2 }}
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
                        <div className="flex items-center gap-2">
                          <Map size={14} style={{ color: area.isSystem ? '#666' : '#3ecf8e', flexShrink: 0 }} />
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
                                  style={{ padding: 3 }}
                                  onClick={() => setEditingArea({ id: area.id, name: area.name, description: area.description || '' })}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  className="btn-ghost btn-icon"
                                  style={{ padding: 3, color: '#e55353' }}
                                  onClick={() => setConfirmDelete({ id: area.id, name: area.name })}
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
                      <td style={{ paddingLeft: 36 }}>
                        <div className="flex items-center gap-2">
                          <Tag size={12} style={{ color: '#666', flexShrink: 0 }} />
                          <span className="text-sm">{inst.name}</span>
                          {inst.isFlagged && (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#e55353' }} title="Flagged" />
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-text-muted text-xs">{inst.description}</span>
                      </td>
                      <td>
                        <span className="text-text-muted text-xs">{inst.templateName}</span>
                      </td>
                      <td></td>
                    </tr>
                  ))}
                  {isExp && instances.length === 0 && (
                    <tr style={{ background: '#1a1a1a' }}>
                      <td></td>
                      <td colSpan={4} style={{ paddingLeft: 36, color: '#555', fontSize: 11, fontStyle: 'italic', paddingTop: 6, paddingBottom: 6 }}>
                        No instances — drag instances here or assign from Engineering view
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Area Modal */}
      {showAddArea && (
        <Modal
          title="Add Area"
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
              <label className="block text-xs text-text-muted mb-1">Area Name *</label>
              <input
                type="text"
                value={newArea.name}
                onChange={e => setNewArea(p => ({ ...p, name: e.target.value }))}
                placeholder="Line 1"
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
                placeholder="Production line 1"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Area"
          message={`Delete area "${confirmDelete.name}"? Instances in this area will be moved to Unassigned.`}
          danger
          onConfirm={() => deleteArea(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
