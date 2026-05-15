import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DataTypeSelect from '../shared/DataTypeSelect';

function nextId(attrs) {
  if (!attrs || !attrs.length) return 1;
  return Math.max(...attrs.map(a => a.id)) + 1;
}

const RULE_SUGGESTIONS = [
  'Instance.Name',
  'Instance.Description',
  'Instance.Area',
  'Template.Name',
  'Attribute.Value',
  'Attribute.Name',
];

function EditCell({ value, onChange, suggestions }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [showSugg, setShowSugg] = useState(false);

  const commit = () => {
    setEditing(false);
    setShowSugg(false);
    if (val !== value) onChange(val);
  };

  if (editing) {
    const filtered = suggestions ? suggestions.filter(s => s.toLowerCase().includes(val.toLowerCase())) : [];
    return (
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={val}
          onChange={e => { setVal(e.target.value); setShowSugg(true); }}
          onBlur={() => setTimeout(() => { commit(); setShowSugg(false); }, 150)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setVal(value); setEditing(false); }
          }}
          autoFocus
          style={{ padding: '2px 4px', fontSize: 13, width: '100%' }}
        />
        {showSugg && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: '#2a2a2a', border: '1px solid #444', borderRadius: 4,
            minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            {filtered.map(s => (
              <div
                key={s}
                style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
                onMouseDown={() => { setVal(s); onChange(s); setEditing(false); setShowSugg(false); }}
                className="hover:bg-bg-hover text-text-primary"
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="editable-cell"
      onClick={() => { setEditing(true); setVal(value); }}
      style={{ cursor: 'text', minHeight: 22 }}
    >
      {value || <span style={{ color: '#555' }}>—</span>}
    </div>
  );
}

export default function ProfileAttributeGrid({ attributes, onChange }) {
  const updateAttr = useCallback((id, field, value) => {
    onChange(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  }, [onChange]);

  const addAttr = useCallback(() => {
    const newAttr = {
      id: nextId(attributes),
      name: 'Column',
      description: '',
      dataType: 9,
      rule: ''
    };
    onChange(prev => [...prev, newAttr]);
  }, [attributes, onChange]);

  const removeAttr = useCallback((id) => {
    onChange(prev => prev.filter(a => a.id !== id));
  }, [onChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="data-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Description</th>
              <th>Data Type</th>
              <th>Rule / Expression</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attributes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-muted text-xs">
                  No columns. Click "+ Add" to create one.
                </td>
              </tr>
            )}
            {attributes.map(attr => (
              <tr key={attr.id}>
                <td>
                  <EditCell value={attr.name} onChange={v => updateAttr(attr.id, 'name', v)} />
                </td>
                <td>
                  <EditCell value={attr.description} onChange={v => updateAttr(attr.id, 'description', v)} />
                </td>
                <td>
                  <DataTypeSelect
                    value={attr.dataType}
                    onChange={v => updateAttr(attr.id, 'dataType', v)}
                    style={{ padding: '2px 6px', fontSize: 12 }}
                  />
                </td>
                <td>
                  <EditCell
                    value={attr.rule}
                    onChange={v => updateAttr(attr.id, 'rule', v)}
                    suggestions={RULE_SUGGESTIONS}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    className="btn-ghost btn-icon"
                    style={{ padding: 3, color: '#e55353' }}
                    onClick={() => removeAttr(attr.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-shrink-0 px-3 py-2" style={{ borderTop: '1px solid #2a2a2a' }}>
        <button className="btn btn-secondary text-xs" style={{ padding: '4px 10px' }} onClick={addAttr}>
          <Plus size={13} /> Add Column
        </button>
      </div>
    </div>
  );
}
