import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

const COL_TYPES = [
  { value: 1,  label: 'Bool'   },
  { value: 4,  label: 'Int32'  },
  { value: 8,  label: 'Float'  },
  { value: 9,  label: 'String' },
];

function parseDataset(json) {
  if (!json) return { columns: [], rows: [] };
  try {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    return {
      columns: Array.isArray(d.columns) ? d.columns : [],
      rows:    Array.isArray(d.rows)    ? d.rows    : [],
    };
  } catch {
    return { columns: [], rows: [] };
  }
}

export function datasetLabel(json) {
  const { columns, rows } = parseDataset(json);
  if (!columns.length && !rows.length) return 'Dataset (empty)';
  return `Dataset [${rows.length}R × ${columns.length}C]`;
}

const TOOL_BTN = {
  width: 28, height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', borderRadius: 4,
  background: 'transparent', cursor: 'pointer', color: 'var(--text)',
};

export default function DatasetEditorModal({ value, onApply, onCancel }) {
  const [ds, setDs]               = useState(() => parseDataset(value));
  const [selCol, setSelCol]       = useState(null);
  const [selRow, setSelRow]       = useState(null);
  const [editCell, setEditCell]   = useState(null); // { ri, ci }
  const [editColIdx, setEditColIdx] = useState(null);

  const { columns, rows } = ds;

  const patch = fn => setDs(d => {
    const next = fn({ columns: d.columns.map(c => ({ ...c })), rows: d.rows.map(r => [...r]) });
    return next;
  });

  const addColumn = () => patch(d => ({
    columns: [...d.columns, { name: `Col${d.columns.length + 1}`, type: 9 }],
    rows:    d.rows.map(r => [...r, '']),
  }));

  const deleteColumn = ci => {
    patch(d => ({
      columns: d.columns.filter((_, i) => i !== ci),
      rows:    d.rows.map(r => r.filter((_, i) => i !== ci)),
    }));
    setSelCol(null);
  };

  const addRow = () => patch(d => ({
    columns: d.columns,
    rows:    [...d.rows, d.columns.map(() => '')],
  }));

  const deleteRow = ri => {
    patch(d => ({ columns: d.columns, rows: d.rows.filter((_, i) => i !== ri) }));
    setSelRow(null);
  };

  const updateCell = (ri, ci, val) => patch(d => ({
    columns: d.columns,
    rows:    d.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r),
  }));

  const updateColName = (ci, name) => patch(d => ({
    columns: d.columns.map((c, i) => i === ci ? { ...c, name } : c),
    rows:    d.rows,
  }));

  const updateColType = (ci, type) => patch(d => ({
    columns: d.columns.map((c, i) => i === ci ? { ...c, type } : c),
    rows:    d.rows,
  }));

  const selectedColDef = selCol !== null && selCol < columns.length ? columns[selCol] : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, width: 720, maxWidth: '95vw',
        display: 'flex', flexDirection: 'column', maxHeight: '80vh',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Dataset Editor</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {columns.length === 0 ? 'Empty' : `Dataset [${rows.length}R × ${columns.length}C]`}
          </span>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {columns.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-disabled)', padding: 48, fontSize: 13 }}>
                No columns. Click + Col to add one.
              </div>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                <thead>
                  <tr>
                    {columns.map((col, ci) => (
                      <th
                        key={ci}
                        onClick={() => { setSelCol(ci); setSelRow(null); }}
                        style={{
                          border: '1px solid var(--border)', padding: '4px 8px',
                          background: selCol === ci ? 'var(--accent, #3b82f6)' : 'var(--surface-alt)',
                          color: selCol === ci ? '#fff' : 'var(--text)',
                          cursor: 'pointer', userSelect: 'none',
                          maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {editColIdx === ci ? (
                          <input
                            autoFocus
                            value={col.name}
                            onChange={e => updateColName(ci, e.target.value)}
                            onBlur={() => setEditColIdx(null)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditColIdx(null); }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: 80, fontSize: 12, padding: '1px 2px' }}
                          />
                        ) : (
                          <span onDoubleClick={e => { e.stopPropagation(); setEditColIdx(ci); setSelCol(ci); }}>
                            {col.name}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-disabled)', padding: 20, border: '1px solid var(--border)' }}>
                        No rows. Click + Row to add one.
                      </td>
                    </tr>
                  )}
                  {rows.map((row, ri) => (
                    <tr
                      key={ri}
                      onClick={() => { setSelRow(ri); setSelCol(null); }}
                      style={{
                        background: selRow === ri
                          ? 'rgba(59,130,246,0.12)'
                          : ri % 2 === 0 ? 'var(--surface)' : 'var(--surface-alt)',
                        cursor: 'pointer',
                      }}
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{ border: '1px solid var(--border)', padding: 0, maxWidth: 140 }}
                          onDoubleClick={e => { e.stopPropagation(); setEditCell({ ri, ci }); }}
                        >
                          {editCell && editCell.ri === ri && editCell.ci === ci ? (
                            <input
                              autoFocus
                              defaultValue={cell}
                              onBlur={e => { updateCell(ri, ci, e.target.value); setEditCell(null); }}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  { updateCell(ri, ci, e.target.value); setEditCell(null); }
                                if (e.key === 'Escape') setEditCell(null);
                              }}
                              style={{
                                width: '100%', padding: '3px 6px', fontSize: 12,
                                border: 'none', outline: '2px solid var(--accent, #3b82f6)',
                                background: 'var(--surface)',
                              }}
                            />
                          ) : (
                            <div style={{ padding: '3px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cell !== '' && cell != null
                                ? String(cell)
                                : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right toolbar */}
          <div style={{
            width: 38, borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 0', gap: 6,
          }}>
            <button title="Add Column" onClick={addColumn} style={TOOL_BTN}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.5px' }}>+C</span>
            </button>
            <button title="Add Row" onClick={addRow} style={TOOL_BTN}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.5px' }}>+R</span>
            </button>
            <div style={{ flex: 1 }} />
            {selCol !== null && (
              <button title="Delete Column" onClick={() => deleteColumn(selCol)} style={{ ...TOOL_BTN, color: '#e55353' }}>
                <Trash2 size={13} />
              </button>
            )}
            {selRow !== null && (
              <button title="Delete Row" onClick={() => deleteRow(selRow)} style={{ ...TOOL_BTN, color: '#e55353' }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)', padding: '8px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
        }}>
          <div style={{ color: 'var(--text-muted)' }}>
            {selectedColDef ? (
              <>
                Column Name: <strong style={{ marginRight: 12 }}>{selectedColDef.name}</strong>
                Column Type:&nbsp;
                <select
                  value={selectedColDef.type}
                  onChange={e => updateColType(selCol, Number(e.target.value))}
                  style={{ fontSize: 12, padding: '1px 4px' }}
                >
                  {COL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </>
            ) : (
              <span>Column Name: ----&nbsp;&nbsp;Column Type: ----</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => onApply(JSON.stringify(ds))}>Apply</button>
            <button className="btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
