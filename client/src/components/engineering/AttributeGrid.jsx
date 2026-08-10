import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import DataTypeSelect, { dataTypeName } from '../shared/DataTypeSelect';

function nextId(attrs) {
  if (!attrs || !attrs.length) return 1;
  return Math.max(...attrs.map(a => a.id)) + 1;
}

// Inline editable cell
function EditCell({ value, onChange, disabled, type = 'text', style }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef(null);

  const commit = () => {
    setEditing(false);
    if (val !== value) onChange(val);
  };

  if (disabled) {
    return <span style={{ color: 'var(--text-disabled)', ...style }}>{value}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setVal(value); setEditing(false); }
        }}
        autoFocus
        style={{ padding: '2px 4px', fontSize: 13, width: '100%', minWidth: 60, ...style }}
      />
    );
  }

  return (
    <div
      className="editable-cell"
      onClick={() => { setEditing(true); setVal(value); }}
      style={{ cursor: 'text', minHeight: 22, ...style }}
    >
      {value || <span style={{ color: 'var(--text-disabled)' }}>—</span>}
    </div>
  );
}

export default function AttributeGrid({ attributes, templateAttributes, mode, onChange }) {
  // mode: 'template' | 'instance'
  const isTemplate = mode === 'template';

  const updateAttr = useCallback((id, field, value) => {
    onChange(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  }, [onChange]);

  const addAttr = useCallback(() => {
    const newAttr = isTemplate
      ? { id: nextId(attributes), name: 'Attribute', description: '', dataType: 9, value: '', parameter: false }
      : null; // instances can't add attrs
    if (newAttr) onChange(prev => [...prev, newAttr]);
  }, [attributes, isTemplate, onChange]);

  const removeAttr = useCallback((id) => {
    onChange(prev => prev.filter(a => a.id !== id));
  }, [onChange]);

  // Build display rows: for instance, merge with template attrs
  const rows = isTemplate
    ? attributes
    : (templateAttributes || []).map(ta => {
        const ia = attributes.find(a => a.id === ta.id);
        return {
          ...ta,
          value: ia ? ia.value : ta.value,
          _instanceAttr: ia
        };
      });

  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortCol) return 0;
    const av = String(a[sortCol] || '').toLowerCase();
    const bv = String(b[sortCol] || '').toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  function SortIcon({ col }) {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="data-table" style={{ tableLayout: 'auto', width: 'auto', minWidth: '100%' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                <span className="flex items-center gap-1">Name <SortIcon col="name" /></span>
              </th>
              <th onClick={() => handleSort('description')} style={{ cursor: 'pointer' }}>
                <span className="flex items-center gap-1">Description <SortIcon col="description" /></span>
              </th>
              <th onClick={() => handleSort('dataType')} style={{ cursor: 'pointer' }}>
                <span className="flex items-center gap-1">Type <SortIcon col="dataType" /></span>
              </th>
              <th>Value</th>
              <th>Param</th>
              {isTemplate && <th></th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={isTemplate ? 6 : 5} className="text-center py-8 text-text-muted text-xs">
                  {isTemplate ? 'No attributes. Click "+ Add" to create one.' : 'No attributes defined on this template.'}
                </td>
              </tr>
            )}
            {sortedRows.map((attr) => (
              <tr key={attr.id}>
                <td>
                  <EditCell
                    value={attr.name}
                    onChange={v => updateAttr(attr.id, 'name', v)}
                    disabled={!isTemplate}
                  />
                </td>
                <td>
                  <EditCell
                    value={attr.description}
                    onChange={v => updateAttr(attr.id, 'description', v)}
                    disabled={!isTemplate}
                  />
                </td>
                <td>
                  {isTemplate ? (
                    <DataTypeSelect
                      value={attr.dataType}
                      onChange={v => updateAttr(attr.id, 'dataType', v)}
                      style={{ padding: '2px 6px', fontSize: 12 }}
                    />
                  ) : (
                    <span className="text-text-muted text-xs">{dataTypeName(attr.dataType)}</span>
                  )}
                </td>
                <td>
                  <EditCell
                    value={attr.value}
                    onChange={v => {
                      if (isTemplate) {
                        updateAttr(attr.id, 'value', v);
                      } else {
                        onChange(prev => {
                          const exists = prev.find(a => a.id === attr.id);
                          if (exists) return prev.map(a => a.id === attr.id ? { ...a, value: v } : a);
                          return [...prev, { id: attr.id, value: v }];
                        });
                      }
                    }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!attr.parameter}
                    onChange={e => updateAttr(attr.id, 'parameter', e.target.checked)}
                    disabled={!isTemplate}
                  />
                </td>
                {isTemplate && (
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-ghost btn-icon"
                      style={{ padding: 3, color: '#e55353' }}
                      onClick={() => removeAttr(attr.id)}
                      title="Delete attribute"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {isTemplate && (
              <tr
                onClick={addAttr}
                style={{ cursor: 'pointer' }}
                className="add-row"
              >
                <td colSpan={6} style={{ padding: '6px 12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-disabled)', fontSize: 12 }}>
                    <Plus size={13} /> Add Attribute
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
