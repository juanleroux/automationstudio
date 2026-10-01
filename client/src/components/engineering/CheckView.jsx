import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

function getAreaLabel(areaId, areas) {
  if (!areaId) return '—';
  const parts = [];
  let current = (areas || []).find(a => a.id === areaId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId != null ? (areas || []).find(a => a.id === current.parentId) : null;
  }
  return parts.join(' / ') || '—';
}

const ALL_COLUMNS = [
  { id: 'description', label: 'Description' },
  { id: 'area',        label: 'Area' },
  { id: 'flagged',     label: 'Flagged' },
  { id: 'lastModified', label: 'Last Modified' },
  { id: 'io',    label: 'I/O' },
  { id: 'plc',   label: 'PLC' },
  { id: 'scada', label: 'SCADA' },
  { id: 'mes',   label: 'MES' },
  { id: 'custom', label: 'Custom' },
];

const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
};
const tdStyle = { padding: '6px 12px', fontSize: 13, color: 'var(--text-primary)' };

export default function CheckView() {
  const { project, updateProject } = useProject();
  const [search, setSearch]               = useState('');
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [filterArea, setFilterArea]         = useState('all');
  const [filterFlagged, setFilterFlagged]   = useState('all');
  const [filterStatus, setFilterStatus]     = useState('all');
  const [visibleCols, setVisibleCols]       = useState(new Set(ALL_COLUMNS.map(c => c.id)));
  const [colMenuOpen, setColMenuOpen]       = useState(false);
  const [expanded, setExpanded]             = useState(null); // null = all open on first render
  const colMenuRef = useRef(null);

  useEffect(() => {
    if (!colMenuOpen) return;
    const h = e => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setColMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [colMenuOpen]);

  const templates = project?.templates || [];
  const areas = project?.areas || [];
  const checkData = project?.checkData || {};

  const getCheck = (tid, iid) =>
    checkData[`${tid}:${iid}`] || { io: false, plc: false, scada: false, mes: false, custom: '' };

  const setCheck = (tid, iid, field, value) => {
    const key = `${tid}:${iid}`;
    updateProject(p => ({
      ...p,
      checkData: {
        ...(p.checkData || {}),
        [key]: { ...getCheck(tid, iid), ...((p.checkData || {})[key] || {}), [field]: value },
      },
    }));
  };

  const allRows = useMemo(() => {
    const rows = [];
    for (const t of templates)
      for (const inst of (t.instances || []))
        rows.push({ template: t, instance: inst });
    return rows;
  }, [templates]);

  const filteredRows = useMemo(() => allRows.filter(({ template, instance }) => {
    if (search) {
      const q = search.toLowerCase();
      if (!instance.name.toLowerCase().includes(q) && !(instance.description || '').toLowerCase().includes(q)) return false;
    }
    if (filterTemplate !== 'all' && String(template.id) !== filterTemplate) return false;
    if (filterArea !== 'all' && String(instance.areaId) !== filterArea) return false;
    if (filterFlagged === 'flagged' && !instance.isFlagged) return false;
    if (filterFlagged === 'not-flagged' && instance.isFlagged) return false;
    if (filterStatus !== 'all') {
      const c = getCheck(template.id, instance.id);
      const any = c.io || c.plc || c.scada || c.mes;
      if (filterStatus === 'any' && !any) return false;
      if (filterStatus === 'none' && any) return false;
    }
    return true;
  }), [allRows, search, filterTemplate, filterArea, filterFlagged, filterStatus, checkData]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const { template, instance } of filteredRows) {
      if (!map.has(template.id)) map.set(template.id, { template, instances: [] });
      map.get(template.id).instances.push(instance);
    }
    return [...map.values()].sort((a, b) => a.template.name.localeCompare(b.template.name));
  }, [filteredRows]);

  // Default: all groups open
  const expandedSet = useMemo(() => {
    if (expanded !== null) return expanded;
    return new Set(grouped.map(g => g.template.id));
  }, [expanded, grouped]);

  const toggleGroup = id => setExpanded(prev => {
    const s = new Set(prev === null ? grouped.map(g => g.template.id) : prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const show = id => visibleCols.has(id);
  const toggleCol = id => setVisibleCols(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalInstances = filteredRows.length;
  const checkedCount = filteredRows.filter(({ template, instance }) => {
    const c = getCheck(template.id, instance.id);
    return c.io || c.plc || c.scada || c.mes;
  }).length;

  // Unique areas that actually appear in filtered rows (for filter dropdown)
  const usedAreaIds = useMemo(() => {
    const ids = new Set(filteredRows.map(r => r.instance.areaId));
    // Also include all area ids from unfiltered rows so filter doesn't disappear
    for (const { instance } of allRows) ids.add(instance.areaId);
    return [...ids].filter(Boolean);
  }, [allRows, filteredRows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filter / toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{ paddingLeft: 28, paddingRight: 8, height: 28, width: 170, fontSize: 12 }}
          />
        </div>

        {/* Template filter */}
        <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">All Templates</option>
          {[...templates].sort((a, b) => a.name.localeCompare(b.name)).map(t =>
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          )}
        </select>

        {/* Area filter */}
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">All Areas</option>
          {usedAreaIds.map(id => {
            const a = areas.find(a => a.id === id);
            return a ? <option key={id} value={String(id)}>{a.name}</option> : null;
          })}
        </select>

        {/* Flagged filter */}
        <select value={filterFlagged} onChange={e => setFilterFlagged(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">All</option>
          <option value="flagged">Flagged</option>
          <option value="not-flagged">Not flagged</option>
        </select>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">All status</option>
          <option value="any">Any checked</option>
          <option value="none">Not started</option>
        </select>

        <div style={{ flex: 1 }} />

        {/* Summary */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalInstances} instances · {checkedCount} started
        </span>

        {/* Column visibility */}
        <div ref={colMenuRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setColMenuOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, height: 28, padding: '0 10px' }}
          >
            <SlidersHorizontal size={13} />
            Columns
          </button>
          {colMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: 160, padding: '4px 0',
            }}>
              {ALL_COLUMNS.map(col => (
                <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                  <input type="checkbox" checked={visibleCols.has(col.id)} onChange={() => toggleCol(col.id)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="data-table" style={{ minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>Instance</th>
              {show('description')  && <th style={thStyle}>Description</th>}
              {show('area')         && <th style={thStyle}>Area</th>}
              {show('flagged')      && <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>Flagged</th>}
              {show('lastModified') && <th style={{ ...thStyle, width: 130 }}>Last Modified</th>}
              {show('io')    && <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>I/O</th>}
              {show('plc')   && <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>PLC</th>}
              {show('scada') && <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>SCADA</th>}
              {show('mes')   && <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>MES</th>}
              {show('custom') && <th style={{ ...thStyle, minWidth: 150 }}>Custom</th>}
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No instances match the current filters.
                </td>
              </tr>
            ) : grouped.map(({ template, instances }) => {
              const isExp = expandedSet.has(template.id);
              return (
                <React.Fragment key={template.id}>
                  {/* Template group header */}
                  <tr
                    onClick={() => toggleGroup(template.id)}
                    style={{
                      cursor: 'pointer', userSelect: 'none',
                      background: 'var(--bg-section, rgba(0,0,0,0.035))',
                    }}
                  >
                    <td colSpan={99} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        {template.name}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>({instances.length})</span>
                      </span>
                    </td>
                  </tr>

                  {isExp && instances.map(inst => {
                    const c = getCheck(template.id, inst.id);
                    return (
                      <tr key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        {/* Instance name */}
                        <td style={tdStyle}>
                          {inst.isFlagged && <span style={{ color: '#e55353', marginRight: 5 }}>●</span>}
                          {inst.name}
                        </td>

                        {show('description') && (
                          <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{inst.description || '—'}</td>
                        )}

                        {show('area') && (
                          <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {getAreaLabel(inst.areaId, areas)}
                          </td>
                        )}

                        {show('flagged') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {inst.isFlagged
                              ? <span style={{ color: '#e55353', fontSize: 15, lineHeight: 1 }}>●</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        )}

                        {show('lastModified') && (
                          <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {inst.lastModification
                              ? new Date(inst.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                        )}

                        {show('io') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <input
                              type="checkbox" checked={!!c.io}
                              onChange={e => setCheck(template.id, inst.id, 'io', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {show('plc') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <input
                              type="checkbox" checked={!!c.plc}
                              onChange={e => setCheck(template.id, inst.id, 'plc', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {show('scada') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <input
                              type="checkbox" checked={!!c.scada}
                              onChange={e => setCheck(template.id, inst.id, 'scada', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {show('mes') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <input
                              type="checkbox" checked={!!c.mes}
                              onChange={e => setCheck(template.id, inst.id, 'mes', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {show('custom') && (
                          <td style={tdStyle}>
                            <input
                              type="text"
                              value={c.custom || ''}
                              onChange={e => setCheck(template.id, inst.id, 'custom', e.target.value)}
                              placeholder="—"
                              style={{
                                width: '100%', background: 'transparent', border: 'none',
                                outline: 'none', fontSize: 13, color: 'var(--text-primary)',
                                fontFamily: 'inherit',
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
