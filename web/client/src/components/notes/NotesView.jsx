import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, X, StickyNote } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

let _seq = 0;
const uid = () => `n${Date.now()}-${++_seq}`;

function makeTab(index) {
  return {
    id: uid(),
    name: `Note ${index}`,
    columns: [
      { id: uid(), name: 'Topic' },
      { id: uid(), name: 'Details' },
    ],
    rows: [],
  };
}

export default function NotesView() {
  const { project, updateProject } = useProject();
  const [activeTabId, setActiveTabId] = useState(null);
  const [editTabId, setEditTabId]     = useState(null);
  const [editTabName, setEditTabName] = useState('');
  const [editColId, setEditColId]     = useState(null);
  const [editColName, setEditColName] = useState('');
  const [editCell, setEditCell]       = useState(null); // { rowId, colId }
  const [editCellVal, setEditCellVal] = useState('');

  const tabInputRef = useRef(null);
  const colInputRef = useRef(null);
  const cellRef     = useRef(null);

  useEffect(() => { if (editTabId  && tabInputRef.current) tabInputRef.current.select(); }, [editTabId]);
  useEffect(() => { if (editColId  && colInputRef.current) colInputRef.current.select(); }, [editColId]);
  useEffect(() => { if (editCell   && cellRef.current)     cellRef.current.focus();       }, [editCell]);

  const notes = project?.notes || { tabs: [] };
  const tabs  = notes.tabs || [];

  // Resolve active tab — fall back to first tab if stored id is gone
  const resolvedActiveId = tabs.find(t => t.id === activeTabId) ? activeTabId : (tabs[0]?.id ?? null);
  const activeTab = tabs.find(t => t.id === resolvedActiveId) ?? null;

  const patchNotes = useCallback((fn) => {
    updateProject(p => {
      const n = p?.notes || { tabs: [] };
      return { ...p, notes: fn(n) };
    });
  }, [updateProject]);

  const patchTab = useCallback((tabId, fn) => {
    patchNotes(n => ({
      ...n,
      tabs: n.tabs.map(t => t.id === tabId ? fn(t) : t),
    }));
  }, [patchNotes]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        Open or create a project to use Notes.
      </div>
    );
  }

  // ── Tab actions ────────────────────────────────────────────────
  const addTab = () => {
    const tab = makeTab(tabs.length + 1);
    patchNotes(n => ({ ...n, tabs: [...n.tabs, tab] }));
    setActiveTabId(tab.id);
  };

  const removeTab = (tabId, e) => {
    e.stopPropagation();
    patchNotes(n => {
      const remaining = n.tabs.filter(t => t.id !== tabId);
      return { ...n, tabs: remaining };
    });
    if (resolvedActiveId === tabId) {
      const idx  = tabs.findIndex(t => t.id === tabId);
      const next = tabs[idx + 1] ?? tabs[idx - 1];
      setActiveTabId(next?.id ?? null);
    }
  };

  const startRenameTab = (tab, e) => {
    e.stopPropagation();
    setEditTabId(tab.id);
    setEditTabName(tab.name);
  };

  const commitTabName = () => {
    if (editTabId) {
      patchTab(editTabId, t => ({ ...t, name: editTabName.trim() || t.name }));
    }
    setEditTabId(null);
  };

  // ── Column actions ─────────────────────────────────────────────
  const addColumn = () => {
    if (!activeTab) return;
    const col = { id: uid(), name: `Column ${activeTab.columns.length + 1}` };
    patchTab(activeTab.id, t => ({ ...t, columns: [...t.columns, col] }));
  };

  const removeColumn = (colId) => {
    if (!activeTab) return;
    patchTab(activeTab.id, t => ({
      ...t,
      columns: t.columns.filter(c => c.id !== colId),
      rows: t.rows.map(r => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    }));
  };

  const startRenameCol = (col) => {
    setEditColId(col.id);
    setEditColName(col.name);
  };

  const commitColName = () => {
    if (editColId && activeTab) {
      patchTab(activeTab.id, t => ({
        ...t,
        columns: t.columns.map(c =>
          c.id === editColId ? { ...c, name: editColName.trim() || c.name } : c
        ),
      }));
    }
    setEditColId(null);
  };

  // ── Row actions ────────────────────────────────────────────────
  const addRow = () => {
    if (!activeTab) return;
    patchTab(activeTab.id, t => ({ ...t, rows: [...t.rows, { id: uid(), cells: {} }] }));
  };

  const removeRow = (rowId) => {
    if (!activeTab) return;
    patchTab(activeTab.id, t => ({ ...t, rows: t.rows.filter(r => r.id !== rowId) }));
  };

  // ── Cell actions ───────────────────────────────────────────────
  const startEditCell = (rowId, colId, val) => {
    setEditCell({ rowId, colId });
    setEditCellVal(val ?? '');
  };

  const commitCell = () => {
    if (editCell && activeTab) {
      const { rowId, colId } = editCell;
      patchTab(activeTab.id, t => ({
        ...t,
        rows: t.rows.map(r =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: editCellVal } } : r
        ),
      }));
    }
    setEditCell(null);
  };

  // ── Styles ─────────────────────────────────────────────────────
  const cellBorder = '1px solid var(--border)';
  const thStyle    = { border: cellBorder, padding: '4px 8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'left', minWidth: 140 };
  const tdStyle    = { border: cellBorder };
  const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="tab-bar" style={{ flexShrink: 0, alignItems: 'center', paddingLeft: 4 }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item${tab.id === resolvedActiveId ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 4, userSelect: 'none' }}
            onClick={() => setActiveTabId(tab.id)}
          >
            {editTabId === tab.id ? (
              <input
                ref={tabInputRef}
                value={editTabName}
                onChange={e => setEditTabName(e.target.value)}
                onBlur={commitTabName}
                onKeyDown={e => {
                  if (e.key === 'Enter')  commitTabName();
                  if (e.key === 'Escape') setEditTabId(null);
                }}
                onClick={e => e.stopPropagation()}
                style={{ width: 90, fontSize: 13, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: 'var(--text-primary)', padding: '0 2px' }}
              />
            ) : (
              <span onDoubleClick={e => startRenameTab(tab, e)} style={{ minWidth: 40 }}>{tab.name}</span>
            )}
            <button
              onClick={e => removeTab(tab.id, e)}
              title="Close tab"
              style={{ ...iconBtn, opacity: 0.5, padding: '0 2px' }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={addTab}
          title="New note tab"
          style={{ ...iconBtn, padding: '4px 10px', flexShrink: 0 }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {tabs.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
          <StickyNote size={40} style={{ opacity: 0.25 }} />
          <div style={{ fontSize: 14 }}>No notes yet</div>
          <button className="btn btn-secondary" onClick={addTab} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> New Tab
          </button>
        </div>
      )}

      {/* ── Table canvas ────────────────────────────────────────── */}
      {activeTab && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'auto' }}>
            <thead>
              <tr>
                {/* row-delete gutter */}
                <th style={{ ...thStyle, width: 24, padding: '4px 6px' }} />

                {activeTab.columns.map(col => (
                  <th key={col.id} style={thStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {editColId === col.id ? (
                        <input
                          ref={colInputRef}
                          value={editColName}
                          onChange={e => setEditColName(e.target.value)}
                          onBlur={commitColName}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  commitColName();
                            if (e.key === 'Escape') setEditColId(null);
                          }}
                          style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', color: 'var(--text-primary)', padding: '0 2px', minWidth: 60 }}
                        />
                      ) : (
                        <span
                          style={{ flex: 1, cursor: 'default' }}
                          onDoubleClick={() => startRenameCol(col)}
                        >
                          {col.name}
                        </span>
                      )}
                      {activeTab.columns.length > 1 && (
                        <button
                          onClick={() => removeColumn(col.id)}
                          title="Delete column"
                          style={{ ...iconBtn, opacity: 0.45, flexShrink: 0 }}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}

                {/* add-column button */}
                <th style={{ ...thStyle, width: 32, textAlign: 'center', padding: '4px 6px' }}>
                  <button onClick={addColumn} title="Add column" style={iconBtn}>
                    <Plus size={13} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {activeTab.rows.map(row => (
                <tr key={row.id}>
                  {/* delete row */}
                  <td style={{ ...tdStyle, background: 'var(--bg-surface)', padding: '2px 5px', textAlign: 'center' }}>
                    <button onClick={() => removeRow(row.id)} title="Delete row" style={{ ...iconBtn, opacity: 0.45 }}>
                      <X size={11} />
                    </button>
                  </td>

                  {activeTab.columns.map(col => {
                    const isEditing = editCell?.rowId === row.id && editCell?.colId === col.id;
                    const val = row.cells[col.id] ?? '';
                    return (
                      <td
                        key={col.id}
                        style={{ ...tdStyle, padding: 0, verticalAlign: 'top' }}
                        onClick={() => !isEditing && startEditCell(row.id, col.id, val)}
                      >
                        {isEditing ? (
                          <textarea
                            ref={cellRef}
                            value={editCellVal}
                            onChange={e => setEditCellVal(e.target.value)}
                            onBlur={commitCell}
                            onKeyDown={e => {
                              if (e.key === 'Escape') { setEditCell(null); }
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitCell(); }
                            }}
                            rows={1}
                            style={{
                              display: 'block', width: '100%', minWidth: 140, minHeight: 32,
                              resize: 'vertical', background: 'var(--bg-card)',
                              border: 'none', outline: '2px solid var(--accent)',
                              color: 'var(--text-primary)', fontSize: 13,
                              padding: '5px 8px', boxSizing: 'border-box',
                              fontFamily: 'inherit', lineHeight: 1.4,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              padding: '5px 8px', minHeight: 32, minWidth: 140,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              cursor: 'text', lineHeight: 1.4,
                              color: val ? 'var(--text-primary)' : 'transparent',
                            }}
                          >
                            {val || ' '}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* spacer cell under add-column button */}
                  <td style={{ ...tdStyle, background: 'var(--bg-surface)' }} />
                </tr>
              ))}

              {/* add-row footer */}
              <tr>
                <td
                  colSpan={activeTab.columns.length + 2}
                  style={{ border: cellBorder, padding: '4px 8px', background: 'var(--bg-surface)' }}
                >
                  <button
                    onClick={addRow}
                    style={{ ...iconBtn, fontSize: 12, gap: 4, color: 'var(--text-muted)' }}
                    title="Add row"
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
