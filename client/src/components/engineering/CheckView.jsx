import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

function getAreaLabel(areaId, areas) {
  if (!areaId) return '';
  const parts = [];
  let current = (areas || []).find(a => a.id === areaId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId != null ? (areas || []).find(a => a.id === current.parentId) : null;
  }
  return parts.join(' / ');
}

// Column definitions — id, label, filter type, default pixel weight, optional alignment
const COL_DEFS = [
  { id: 'description',  label: 'Description',  filterType: 'text',   defaultW: 180 },
  { id: 'area',         label: 'Area',          filterType: 'text',   defaultW: 150 },
  { id: 'flagged',      label: 'Flagged',       filterType: 'select', defaultW: 76,  align: 'center',
    options: [['all','All'],['yes','Flagged'],['no','Not flagged']] },
  { id: 'lastModified', label: 'Last Modified', filterType: 'text',   defaultW: 112 },
  { id: 'io',           label: 'I/O',           filterType: 'select', defaultW: 46,  align: 'center',
    options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'plc',          label: 'PLC',           filterType: 'select', defaultW: 46,  align: 'center',
    options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'scada',        label: 'SCADA',         filterType: 'select', defaultW: 56,  align: 'center',
    options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'mes',          label: 'MES',           filterType: 'select', defaultW: 46,  align: 'center',
    options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'custom',       label: 'Custom',        filterType: 'text',   defaultW: 120 },
  { id: 'notes',        label: 'Notes',         filterType: 'text',   defaultW: 180 },
];

const DEFAULT_WIDTHS = Object.fromEntries(
  [['instance', 140], ...COL_DEFS.map(c => [c.id, c.defaultW])]
);

const EMPTY_COL_FILTERS = {
  instance: '',
  ...Object.fromEntries(COL_DEFS.map(c => [c.id, c.filterType === 'select' ? 'all' : ''])),
};

const ROW_H = 34;

const thBase = {
  padding: '0 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  background: 'var(--bg-surface)', whiteSpace: 'nowrap',
  overflow: 'hidden', height: ROW_H, lineHeight: `${ROW_H}px`,
  position: 'relative', userSelect: 'none',
};
const tfBase = {
  padding: '3px 6px', background: 'var(--bg-surface)',
  borderBottom: '2px solid var(--border)', overflow: 'hidden',
};
const tdBase = {
  padding: '0 10px', fontSize: 13, color: 'var(--text-primary)',
  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
  height: ROW_H, lineHeight: `${ROW_H}px`, verticalAlign: 'middle',
};
const finStyle = {
  width: '100%', fontSize: 11, padding: '2px 5px', height: 22,
  background: 'var(--bg-main)', border: '1px solid var(--border)',
  borderRadius: 3, color: 'var(--text-primary)', boxSizing: 'border-box',
};
const fselStyle = { ...finStyle, padding: '2px 2px' };

function ColFilter({ col, value, onChange }) {
  if (col.filterType === 'select')
    return <select value={value} onChange={e => onChange(e.target.value)} style={fselStyle}>{col.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Filter…" style={finStyle} />;
}

// Drag-to-resize handle rendered inside each <th>
function ResizeHandle({ onMouseDown }) {
  return (
    <span
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 6,
        cursor: 'col-resize', zIndex: 1,
        borderRight: '2px solid transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderRightColor = 'var(--border)')}
      onMouseLeave={e => (e.currentTarget.style.borderRightColor = 'transparent')}
    />
  );
}

export default function CheckView() {
  const { project, updateProject } = useProject();
  const [colFilters,  setColFilters]  = useState(EMPTY_COL_FILTERS);
  const [visibleCols, setVisibleCols] = useState(new Set(COL_DEFS.map(c => c.id)));
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [expanded,    setExpanded]    = useState(new Set());
  const [colWidths,   setColWidths]   = useState(DEFAULT_WIDTHS);
  const colMenuRef = useRef(null);

  useEffect(() => {
    if (!colMenuOpen) return;
    const h = e => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setColMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [colMenuOpen]);

  const templates = project?.templates || [];
  const areas     = project?.areas     || [];
  const checkData = project?.checkData || {};

  function getCheck(tid, iid) {
    return checkData[`${tid}:${iid}`] || { io: false, plc: false, scada: false, mes: false, custom: '', notes: '' };
  }

  function setCheck(tid, iid, field, value) {
    const key = `${tid}:${iid}`;
    updateProject(p => ({
      ...p,
      checkData: {
        ...(p.checkData || {}),
        [key]: { ...getCheck(tid, iid), ...((p.checkData || {})[key] || {}), [field]: value },
      },
    }));
  }

  const setCF = (col, val) => setColFilters(prev => ({ ...prev, [col]: val }));
  const hasActiveFilters = Object.entries(colFilters).some(([, v]) => v && v !== 'all');

  const allRows = useMemo(() => {
    const rows = [];
    for (const t of templates)
      for (const inst of (t.instances || []))
        rows.push({ template: t, instance: inst });
    return rows;
  }, [templates]);

  const filteredRows = useMemo(() => {
    const cf = colFilters;
    return allRows.filter(({ template, instance }) => {
      if (cf.instance    && !instance.name.toLowerCase().includes(cf.instance.toLowerCase())) return false;
      if (cf.description && !(instance.description || '').toLowerCase().includes(cf.description.toLowerCase())) return false;
      if (cf.area) {
        const lbl = getAreaLabel(instance.areaId, areas).toLowerCase();
        if (!lbl.includes(cf.area.toLowerCase())) return false;
      }
      if (cf.flagged === 'yes' && !instance.isFlagged) return false;
      if (cf.flagged === 'no'  &&  instance.isFlagged) return false;
      if (cf.lastModified) {
        const d = instance.lastModification
          ? new Date(instance.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toLowerCase()
          : '';
        if (!d.includes(cf.lastModified.toLowerCase())) return false;
      }
      if (cf.io !== 'all' || cf.plc !== 'all' || cf.scada !== 'all' || cf.mes !== 'all' || cf.custom || cf.notes) {
        const c = checkData[`${template.id}:${instance.id}`] || {};
        if (cf.io    === 'yes' && !c.io)    return false;
        if (cf.io    === 'no'  &&  c.io)    return false;
        if (cf.plc   === 'yes' && !c.plc)   return false;
        if (cf.plc   === 'no'  &&  c.plc)   return false;
        if (cf.scada === 'yes' && !c.scada) return false;
        if (cf.scada === 'no'  &&  c.scada) return false;
        if (cf.mes   === 'yes' && !c.mes)   return false;
        if (cf.mes   === 'no'  &&  c.mes)   return false;
        if (cf.custom && !(c.custom || '').toLowerCase().includes(cf.custom.toLowerCase())) return false;
        if (cf.notes  && !(c.notes  || '').toLowerCase().includes(cf.notes.toLowerCase()))  return false;
      }
      return true;
    });
  }, [allRows, colFilters, checkData, areas]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const { template, instance } of filteredRows) {
      if (!map.has(template.id)) map.set(template.id, { template, instances: [] });
      map.get(template.id).instances.push(instance);
    }
    return [...map.values()].sort((a, b) => a.template.name.localeCompare(b.template.name));
  }, [filteredRows]);

  const toggleGroup = id => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const show      = id => id === 'instance' || visibleCols.has(id);
  const toggleCol = id => setVisibleCols(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalInstances = filteredRows.length;
  const checkedCount   = filteredRows.filter(({ template, instance }) => {
    const c = checkData[`${template.id}:${instance.id}`];
    return c && (c.io || c.plc || c.scada || c.mes);
  }).length;

  // Column resize
  const startResize = (e, colId) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[colId];
    const onMove = ev => {
      const next = Math.max(40, startW + ev.clientX - startX);
      setColWidths(prev => ({ ...prev, [colId]: next }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const visColDefs = [
    { id: 'instance', label: 'Instance', filterType: 'text', align: undefined },
    ...COL_DEFS.filter(c => visibleCols.has(c.id)),
  ];

  const thStyle  = id => ({ ...thBase,  textAlign: COL_DEFS.find(c => c.id === id)?.align || 'left' });
  const tdStyle  = id => ({ ...tdBase,  textAlign: COL_DEFS.find(c => c.id === id)?.align || 'left' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={() => setColFilters(EMPTY_COL_FILTERS)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, fontSize: 12, color: 'var(--text-muted)' }}>
            <X size={12} /> Clear filters
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalInstances} instances · {checkedCount} started
        </span>
        <div ref={colMenuRef} style={{ position: 'relative' }}>
          <button className="btn btn-ghost" onClick={() => setColMenuOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, height: 28, padding: '0 10px' }}>
            <SlidersHorizontal size={13} /> Columns
          </button>
          {colMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 160, padding: '4px 0',
            }}>
              {COL_DEFS.map(col => (
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
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            {visColDefs.map(c => (
              <col key={c.id} style={{ width: colWidths[c.id] || 100 }} />
            ))}
          </colgroup>

          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            {/* Header row */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {visColDefs.map(c => (
                <th key={c.id} style={thStyle(c.id)}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>
                    {c.label}
                  </span>
                  <ResizeHandle onMouseDown={e => startResize(e, c.id)} />
                </th>
              ))}
            </tr>
            {/* Filter row */}
            <tr>
              <td style={tfBase}>
                <input type="text" value={colFilters.instance || ''} onChange={e => setCF('instance', e.target.value)} placeholder="Filter…" style={finStyle} />
              </td>
              {COL_DEFS.filter(c => visibleCols.has(c.id)).map(c => (
                <td key={c.id} style={{ ...tfBase, textAlign: c.align || 'left' }}>
                  <ColFilter col={c} value={colFilters[c.id]} onChange={v => setCF(c.id, v)} />
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            {grouped.length === 0 ? (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No instances match the current filters.
              </td></tr>
            ) : grouped.map(({ template, instances }) => {
              const isExp = expanded.has(template.id);
              return (
                <React.Fragment key={template.id}>
                  <tr onClick={() => toggleGroup(template.id)}
                    style={{ cursor: 'pointer', userSelect: 'none', background: 'var(--bg-section, rgba(0,0,0,0.035))' }}>
                    <td colSpan={99} style={{ padding: '0 12px', height: ROW_H, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden' }}>
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
                        {/* Instance */}
                        <td style={tdStyle('instance')}>
                          {inst.isFlagged && <span style={{ color: '#e55353', marginRight: 5, fontSize: 10 }}>●</span>}
                          {inst.name}
                        </td>

                        {show('description') && (
                          <td style={{ ...tdStyle('description'), color: 'var(--text-muted)' }}>{inst.description || '—'}</td>
                        )}

                        {show('area') && (
                          <td style={{ ...tdStyle('area'), color: 'var(--text-muted)' }}>{getAreaLabel(inst.areaId, areas) || '—'}</td>
                        )}

                        {show('flagged') && (
                          <td style={tdStyle('flagged')}>
                            {inst.isFlagged ? <span style={{ color: '#e55353' }}>●</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        )}

                        {show('lastModified') && (
                          <td style={{ ...tdStyle('lastModified'), color: 'var(--text-muted)' }}>
                            {inst.lastModification ? new Date(inst.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </td>
                        )}

                        {['io', 'plc', 'scada', 'mes'].filter(f => show(f)).map(f => (
                          <td key={f} style={tdStyle(f)}>
                            <input type="checkbox" checked={!!c[f]}
                              onChange={e => setCheck(template.id, inst.id, f, e.target.checked)}
                              style={{ cursor: 'pointer' }} />
                          </td>
                        ))}

                        {show('custom') && (
                          <td style={tdStyle('custom')}>
                            <input type="text" value={c.custom || ''}
                              onChange={e => setCheck(template.id, inst.id, 'custom', e.target.value)}
                              placeholder="—"
                              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
                          </td>
                        )}

                        {show('notes') && (
                          <td style={tdStyle('notes')}>
                            <input type="text" value={c.notes || ''}
                              onChange={e => setCheck(template.id, inst.id, 'notes', e.target.value)}
                              placeholder="Add notes…"
                              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
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
