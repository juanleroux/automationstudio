import React, { useState, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, ChevronRight, ChevronDown,
  FileText, Package, Check, X, DollarSign, Download
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';
import NoProjectOpen from '../shared/NoProjectOpen';

function nextId(arr) {
  if (!arr || !arr.length) return 1;
  return Math.max(...arr.map(x => x.id)) + 1;
}

function calcMarginDollar(price, qty, margin) {
  const p = parseFloat(price) || 0;
  const q = parseFloat(qty) || 0;
  const m = parseFloat(margin) || 0;
  return (p * q * m / 100).toFixed(2);
}

function calcTotal(price, qty, margin) {
  const p = parseFloat(price) || 0;
  const q = parseFloat(qty) || 0;
  const m = parseFloat(margin) || 0;
  return (p * q * (1 + m / 100)).toFixed(2);
}

function EditCell({ value, onChange, type = 'text', style, prefix }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const commit = () => { setEditing(false); if (val !== value) onChange(val); };

  if (editing) {
    return (
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
        autoFocus
        style={{ padding: '2px 4px', fontSize: 12, width: '100%', ...style }}
      />
    );
  }

  return (
    <div className="editable-cell" onClick={() => { setEditing(true); setVal(value); }} style={{ cursor: 'text', minHeight: 20, fontSize: 12, ...style }}>
      {prefix && <span style={{ color: '#9e9e9e', marginRight: 2 }}>{prefix}</span>}
      {value || <span style={{ color: '#555' }}>—</span>}
    </div>
  );
}

export default function ProposalView() {
  const { project, updateProject } = useProject();
  const toast = useToast();
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddItem, setShowAddItem] = useState(null); // topicId
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (!project) {
    return <NoProjectOpen />;
  }

  const proposal = project.proposal || {};
  const topics = proposal.topics || [];

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const addTopic = () => {
    if (!newName.trim()) return;
    const id = nextId(topics);
    updateProject(p => ({
      ...p,
      proposal: { ...(p.proposal || {}), topics: [...(p.proposal?.topics || []), { id, name: newName.trim(), description: '', items: [] }] }
    }));
    setShowAddTopic(false);
    setNewName('');
    setExpanded(prev => new Set([...prev, id]));
    setSelectedTopic(id);
    toast.success('Topic added');
  };

  const deleteTopic = (id) => {
    updateProject(p => ({
      ...p,
      proposal: { ...(p.proposal || {}), topics: (p.proposal?.topics || []).filter(t => t.id !== id) }
    }));
    if (selectedTopic === id) setSelectedTopic(null);
    setConfirmDelete(null);
    toast.success('Topic deleted');
  };

  const addItem = (topicId) => {
    if (!newName.trim()) return;
    const topic = topics.find(t => t.id === topicId);
    const itemId = nextId(topic?.items || []);
    updateProject(p => ({
      ...p,
      proposal: {
        ...(p.proposal || {}),
        topics: (p.proposal?.topics || []).map(t =>
          t.id !== topicId ? t : {
            ...t,
            items: [...(t.items || []), {
              id: itemId,
              name: newName.trim(),
              description: '',
              lineItems: []
            }]
          }
        )
      }
    }));
    setShowAddItem(null);
    setNewName('');
    setSelectedItem(itemId);
    toast.success('Item added');
  };

  const deleteItem = (topicId, itemId) => {
    updateProject(p => ({
      ...p,
      proposal: {
        ...(p.proposal || {}),
        topics: (p.proposal?.topics || []).map(t =>
          t.id !== topicId ? t : { ...t, items: (t.items || []).filter(i => i.id !== itemId) }
        )
      }
    }));
    if (selectedItem === itemId) setSelectedItem(null);
    setConfirmDelete(null);
    toast.success('Item deleted');
  };

  const updateLineItem = (topicId, itemId, lineItemId, field, value) => {
    updateProject(p => ({
      ...p,
      proposal: {
        ...(p.proposal || {}),
        topics: (p.proposal?.topics || []).map(t =>
          t.id !== topicId ? t : {
            ...t,
            items: (t.items || []).map(i =>
              i.id !== itemId ? i : {
                ...i,
                lineItems: (i.lineItems || []).map(li =>
                  li.id !== lineItemId ? li : { ...li, [field]: value }
                )
              }
            )
          }
        )
      }
    }));
  };

  const addLineItem = (topicId, itemId) => {
    updateProject(p => {
      const topic = (p.proposal?.topics || []).find(t => t.id === topicId);
      const item = topic?.items?.find(i => i.id === itemId);
      const liId = nextId(item?.lineItems || []);
      return {
        ...p,
        proposal: {
          ...(p.proposal || {}),
          topics: (p.proposal?.topics || []).map(t =>
            t.id !== topicId ? t : {
              ...t,
              items: (t.items || []).map(i =>
                i.id !== itemId ? i : {
                  ...i,
                  lineItems: [...(i.lineItems || []), {
                    id: liId,
                    supplier: '',
                    code: '',
                    description: '',
                    qty: '1',
                    price: '0',
                    margin: '0'
                  }]
                }
              )
            }
          )
        }
      };
    });
  };

  const deleteLineItem = (topicId, itemId, lineItemId) => {
    updateProject(p => ({
      ...p,
      proposal: {
        ...(p.proposal || {}),
        topics: (p.proposal?.topics || []).map(t =>
          t.id !== topicId ? t : {
            ...t,
            items: (t.items || []).map(i =>
              i.id !== itemId ? i : {
                ...i,
                lineItems: (i.lineItems || []).filter(li => li.id !== lineItemId)
              }
            )
          }
        )
      }
    }));
  };

  // Find current selected item data
  const currentTopic = topics.find(t => t.id === selectedTopic);
  const currentItem = currentTopic?.items?.find(i => i.id === selectedItem);

  // Grand total
  const grandTotal = topics.reduce((topicSum, t) =>
    topicSum + (t.items || []).reduce((itemSum, i) =>
      itemSum + (i.lineItems || []).reduce((liSum, li) =>
        liSum + parseFloat(calcTotal(li.price, li.qty, li.margin)), 0), 0), 0);

  // Export proposal CSV
  const exportCSV = () => {
    const rows = [['Topic', 'Item', 'Supplier', 'Code', 'Description', 'Qty', 'Price', 'Margin%', 'Margin$', 'Total']];
    topics.forEach(t => {
      (t.items || []).forEach(i => {
        (i.lineItems || []).forEach(li => {
          rows.push([
            t.name, i.name, li.supplier, li.code, li.description,
            li.qty, li.price, li.margin,
            calcMarginDollar(li.price, li.qty, li.margin),
            calcTotal(li.price, li.qty, li.margin)
          ]);
        });
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'proposal'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Proposal exported');
  };

  return (
    <div className="flex h-full">
      {/* Left: Topics tree */}
      <div className="flex flex-col flex-shrink-0" style={{ width: 240, background: '#242424', borderRight: '1px solid #333' }}>
        <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #333' }}>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Topics</span>
          <button className="btn btn-ghost btn-icon" title="Add Topic" onClick={() => { setNewName(''); setShowAddTopic(true); }}>
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {topics.length === 0 && (
            <div className="text-center py-8 text-text-muted text-xs">
              <FileText size={24} className="mx-auto mb-2 opacity-30" />
              No topics
            </div>
          )}
          {topics.map(topic => {
            const isExp = expanded.has(topic.id);
            const isSelTopic = selectedTopic === topic.id;
            return (
              <div key={topic.id}>
                <div
                  className={`tree-node flex items-center gap-1 px-2 py-1.5 ${isSelTopic && !selectedItem ? 'selected' : ''}`}
                  onClick={() => { setSelectedTopic(topic.id); setSelectedItem(null); toggleExpand(topic.id); }}
                >
                  <button onClick={e => { e.stopPropagation(); toggleExpand(topic.id); }} style={{ padding: 1 }}>
                    {isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <FileText size={13} style={{ color: '#3ecf8e', flexShrink: 0 }} />
                  <span className="flex-1 text-sm truncate">{topic.name}</span>
                  <span className="badge">{topic.items?.length || 0}</span>
                </div>
                {isExp && (topic.items || []).map(item => (
                  <div
                    key={item.id}
                    className={`tree-node flex items-center gap-1 pl-8 pr-2 py-1 ${selectedItem === item.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedTopic(topic.id); setSelectedItem(item.id); }}
                  >
                    <Package size={12} style={{ color: '#9e9e9e', flexShrink: 0 }} />
                    <span className="flex-1 text-xs truncate">{item.name}</span>
                    <span className="badge" style={{ fontSize: 9 }}>{item.lineItems?.length || 0}</span>
                  </div>
                ))}
                {isExp && (
                  <div
                    className="flex items-center gap-1 pl-8 pr-2 py-1 cursor-pointer text-text-muted hover:text-text-primary"
                    style={{ fontSize: 11 }}
                    onClick={() => { setNewName(''); setShowAddItem(topic.id); }}
                  >
                    <Plus size={11} /> Add item
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Line items */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #333', background: '#242424' }}>
          <div>
            {currentTopic && (
              <span className="text-sm font-medium text-text-primary">
                {currentTopic.name}
                {currentItem && <span className="text-text-muted"> / {currentItem.name}</span>}
              </span>
            )}
            {!currentTopic && <span className="text-text-muted text-sm">Select a topic</span>}
          </div>
          <div className="flex items-center gap-2">
            {currentTopic && !currentItem && (
              <>
                <button
                  className="btn btn-secondary text-xs"
                  style={{ padding: '3px 8px' }}
                  onClick={() => setConfirmDelete({ type: 'topic', id: currentTopic.id, name: currentTopic.name })}
                >
                  <Trash2 size={12} /> Delete Topic
                </button>
                <button
                  className="btn btn-primary text-xs"
                  style={{ padding: '3px 8px' }}
                  onClick={() => { setNewName(''); setShowAddItem(currentTopic.id); }}
                >
                  <Plus size={12} /> Add Item
                </button>
              </>
            )}
            {currentItem && (
              <>
                <button
                  className="btn btn-secondary text-xs"
                  style={{ padding: '3px 8px' }}
                  onClick={() => setConfirmDelete({ type: 'item', topicId: currentTopic.id, itemId: currentItem.id, name: currentItem.name })}
                >
                  <Trash2 size={12} /> Delete Item
                </button>
                <button
                  className="btn btn-primary text-xs"
                  style={{ padding: '3px 8px' }}
                  onClick={() => addLineItem(currentTopic.id, currentItem.id)}
                >
                  <Plus size={12} /> Add Line
                </button>
              </>
            )}
            <button className="btn btn-secondary text-xs" style={{ padding: '3px 8px' }} onClick={exportCSV}>
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* Line items table */}
        <div className="flex-1 overflow-auto">
          {!currentItem ? (
            <div className="flex items-center justify-center h-full text-text-muted">
              <div className="text-center">
                {!currentTopic ? (
                  <>
                    <DollarSign size={40} className="mx-auto mb-3 opacity-20" />
                    <p>Select or create a topic to get started</p>
                  </>
                ) : (
                  <>
                    <Package size={40} className="mx-auto mb-3 opacity-20" />
                    <p>Select an item or add one</p>
                    <button
                      className="btn btn-primary mt-3 text-sm"
                      onClick={() => { setNewName(''); setShowAddItem(currentTopic.id); }}
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Supplier</th>
                  <th style={{ width: '12%' }}>Code</th>
                  <th style={{ width: '28%' }}>Description</th>
                  <th style={{ width: '6%' }}>Qty</th>
                  <th style={{ width: '10%' }}>Price</th>
                  <th style={{ width: '8%' }}>Margin %</th>
                  <th style={{ width: '10%' }}>Margin $</th>
                  <th style={{ width: '10%' }}>Total</th>
                  <th style={{ width: '4%' }}></th>
                </tr>
              </thead>
              <tbody>
                {(currentItem.lineItems || []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-text-muted text-xs">
                      No line items. Click "+ Add Line" to add one.
                    </td>
                  </tr>
                )}
                {(currentItem.lineItems || []).map(li => (
                  <tr key={li.id}>
                    <td><EditCell value={li.supplier} onChange={v => updateLineItem(currentTopic.id, currentItem.id, li.id, 'supplier', v)} /></td>
                    <td><EditCell value={li.code} onChange={v => updateLineItem(currentTopic.id, currentItem.id, li.id, 'code', v)} /></td>
                    <td><EditCell value={li.description} onChange={v => updateLineItem(currentTopic.id, currentItem.id, li.id, 'description', v)} /></td>
                    <td><EditCell value={li.qty} onChange={v => updateLineItem(currentTopic.id, currentItem.id, li.id, 'qty', v)} type="number" /></td>
                    <td><EditCell value={li.price} onChange={v => updateLineItem(currentTopic.id, currentItem.id, li.id, 'price', v)} type="number" /></td>
                    <td><EditCell value={li.margin} onChange={v => updateLineItem(currentTopic.id, currentItem.id, li.id, 'margin', v)} type="number" /></td>
                    <td style={{ color: '#9e9e9e', fontSize: 12 }}>{calcMarginDollar(li.price, li.qty, li.margin)}</td>
                    <td style={{ color: '#3ecf8e', fontSize: 12, fontWeight: 500 }}>{calcTotal(li.price, li.qty, li.margin)}</td>
                    <td>
                      <button
                        className="btn-ghost btn-icon"
                        style={{ padding: 3, color: '#e55353' }}
                        onClick={() => deleteLineItem(currentTopic.id, currentItem.id, li.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Summary row */}
              {(currentItem.lineItems || []).length > 0 && (
                <tfoot>
                  <tr style={{ background: '#242424', borderTop: '2px solid #444' }}>
                    <td colSpan={7} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#9e9e9e', textAlign: 'right' }}>
                      Item Total:
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#3ecf8e' }}>
                      {(currentItem.lineItems || []).reduce((s, li) => s + parseFloat(calcTotal(li.price, li.qty, li.margin)), 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Grand total bar */}
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid #333', background: '#242424' }}
        >
          <span className="text-xs text-text-muted">
            {topics.length} topics · {topics.reduce((s, t) => s + (t.items?.length || 0), 0)} items
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Grand Total:</span>
            <span className="text-base font-bold" style={{ color: '#3ecf8e' }}>
              ${grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Add Topic Modal */}
      {showAddTopic && (
        <Modal
          title="Add Topic"
          onClose={() => setShowAddTopic(false)}
          width={360}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddTopic(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTopic} disabled={!newName.trim()}>Add</button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Topic Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Electrical" autoFocus onKeyDown={e => e.key === 'Enter' && addTopic()} />
          </div>
        </Modal>
      )}

      {/* Add Item Modal */}
      {showAddItem !== null && (
        <Modal
          title="Add Item"
          onClose={() => setShowAddItem(null)}
          width={360}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => addItem(showAddItem)} disabled={!newName.trim()}>Add</button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Item Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Control Panel" autoFocus onKeyDown={e => e.key === 'Enter' && addItem(showAddItem)} />
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type === 'topic' ? 'Topic' : 'Item'}`}
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          danger
          onConfirm={() => {
            if (confirmDelete.type === 'topic') deleteTopic(confirmDelete.id);
            else deleteItem(confirmDelete.topicId, confirmDelete.itemId);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
