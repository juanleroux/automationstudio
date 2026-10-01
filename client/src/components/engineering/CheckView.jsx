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

// Textarea that auto-sizes to its content
const NotesCell = React.memo(function NotesCell({ value, onBlur }) {
  const [local, setLocal] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setLocal(value || ''); }, [value]);

  const resize = () => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  };

  return (
    <textarea
      ref={ref}
      value={local}
      rows={2}
      onChange={e => { setLocal(e.target.value); resize(); }}
      onBlur={e => { if (e.target.value !== value) onBlur(e.target.value); }}
      placeholder="Add notes…"
      style={{
        width: '100%', minWidth: 200, resize: 'vertical',
        background: 'transparent', border: '1px solid transparent', borderRadius: 4,
        outline: 'none', fontSize: 12, color: 'var(--text-primary)',
        fontFamily: 'inherit', lineHeight: 1.5, padding: '4px 6px',
        boxSizing: 'border-box',
      }}
      onFocus={e => (e.target.style.borderColor = 'var(--border)')}
      onBlurCapture={e => (e.target.style.borderColor = 'transparent')}
    />
  );
});

const ALL_COLUMNS = [
  { id: 'description',  label: 'Description',  filterType: 'text' },
  { id: 'area',         label: 'Area',          filterType: 'text' },
  { id: 'flagged',      label: 'Flagged',       filterType: 'select', options: [['all','All'],['yes','Flagged'],['no','Not flagged']] },
  { id: 'lastModified', label: 'Last Modified', filterType: 'text' },
  { id: 'io',           label: 'I/O',           filterType: 'select', options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'plc',          label: 'PLC',           filterType: 'select', options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'scada',        label: 'SCADA',         filterType: 'select', options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'mes',          label: 'MES',           filterType: 'select', options: [['all','All'],['yes','Checked'],['no','Unchecked']] },
  { id: 'custom',       label: 'Custom',        filterType: 'text' },
  { id: 'notes',        label: 'Notes',         filterType: 'text' },
];

// instance is always-visible but still filterable — include it in EMPTY_COL_FILTERS
const EMPTY_COL_FILTERS = {
  instance: '',
  ...Object.fromEntries(ALL_COLUMNS.map(c => [c.id, c.filterType === 'select' ? 'all' : ''])),
};

const thStyle = {
  padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-surface)',
};
const tfStyle   = { padding: '4px 6px', background: 'var(--bg-surface)', borderBottom: '2px solid var(--border)' };
const tdStyle   = { padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', verticalAlign: 'top' };
const finStyle  = { width: '100%', fontSize: 11, padding: '2px 5px', height: 22, background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', boxSizing: 'border-box' };
const fselStyle = { ...finStyle, padding: '2px 2px' };

function ColFilter({ col, value, onChange }) {
  if (col.filterType === 'select')
    return <select value={value} onChange={e => onChange(e.target.value)} style={fselStyle}>{col.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Filter…" style={finStyle} />;
}

export default function CheckView() {
  const { project, updateProject } = useProject();
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [colFilters,     setColFilters]      = useState(EMPTY_COL_FILTERS);
  const [visibleCols,    setVisibleCols]     = useState(new Set(ALL_COLUMNS.map(c => c.id)));
  const [colMenuOpen,    setColMenuOpen]     = useState(false);
  const [expanded,       setExpanded]        = useState(new Set()); // start collapsed
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
  const hasActiveFilters = filterTemplate !== 'all' || filterStatus !== 'all' ||
    Object.entries(colFilters).some(([, v]) => v && v !== 'all');
  const clearFilters = () => { setFilterTemplate('all'); setFilterStatus('all'); setColFilters(EMPTY_COL_FILTERS); };

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
      if (filterTemplate !== 'all' && String(template.id) !== filterTemplate) return false;
      if (filterStatus !== 'all') {
        const c = checkData[`${template.id}:${instance.id}`];
        const any = c && (c.io || c.plc || c.scada || c.mes);
        if (filterStatus === 'any'  && !any) return false;
        if (filterStatus === 'none' &&  any) return false;
      }
      if (cf.instance    && !instance.name.toLowerCase().includes(cf.instance.toLowerCase())) return false;
      if (cf.description && !(instance.description || '').toLowerCase().includes(cf.description.toLowerCase())) return false;
      if (cf.area) {
        const areaLbl = getAreaLabel(instance.areaId, areas).toLowerCase();
        if (!areaLbl.includes(cf.area.toLowerCase())) return false;
      }
      if (cf.flagged === 'yes' && !instance.isFlagged) return false;
      if (cf.flagged === 'no'  &&  instance.isFlagged) return false;
      if (cf.lastModified) {
        const d = instance.lastModification
          ? new Date(instance.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toLowerCase()
          : '';
        if (!d.includes(cf.lastModified.toLowerCase())) return false;
      }
      if (cf.io    !== 'all' || cf.plc !== 'all' || cf.scada !== 'all' || cf.mes !== 'all' ||
          cf.custom || cf.notes) {
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
  }, [allRows, filterTemplate, filterStatus, colFilters, checkData, areas]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const { template, instance } of filteredRows) {
      if (!map.has(template.id)) map.set(template.id, { template, instances: [] });
      map.get(template.id).instances.push(instance);
    }
    return [...map.values()].sort((a, b) => a.template.name.localeCompare(b.template.name));
  }, [filteredRows]);

  const toggleGroup = id => setExpanded(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const show      = id => visibleCols.has(id);
  const toggleCol = id => setVisibleCols(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalInstances = filteredRows.length;
  const checkedCount   = filteredRows.filter(({ template, instance }) => {
    const c = checkData[`${template.id}:${instance.id}`];
    return c && (c.io || c.plc || c.scada || c.mes);
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">All Templates</option>
          {[...templates].sort((a, b) => a.name.localeCompare(b.name)).map(t =>
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          )}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">All status</option>
          <option value="any">Any checked</option>
          <option value="none">Not started</option>
        </select>

        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={clearFilters}
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
        <table className="data-table" style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={thStyle}>Instance</th>
              {show('description')  && <th style={thStyle}>Description</th>}
              {show('area')         && <th style={thStyle}>Area</th>}
              {show('flagged')      && <th style={{ ...thStyle, width: 80,  textAlign: 'center' }}>Flagged</th>}
              {show('lastModified') && <th style={{ ...thStyle, width: 130 }}>Last Modified</th>}
              {show('io')           && <th style={{ ...thStyle, width: 55,  textAlign: 'center' }}>I/O</th>}
              {show('plc')          && <th style={{ ...thStyle, width: 55,  textAlign: 'center' }}>PLC</th>}
              {show('scada')        && <th style={{ ...thStyle, width: 65,  textAlign: 'center' }}>SCADA</th>}
              {show('mes')          && <th style={{ ...thStyle, width: 55,  textAlign: 'center' }}>MES</th>}
              {show('custom')       && <th style={{ ...thStyle, minWidth: 130 }}>Custom</th>}
              {show('notes')        && <th style={{ ...thStyle, minWidth: 220 }}>Notes</th>}
            </tr>
            {/* Per-column filter row */}
            <tr>
              <td style={tfStyle}><input type="text" value={colFilters.instance || ''} onChange={e => setCF('instance', e.target.value)} placeholder="Filter…" style={finStyle} /></td>
              {show('description')  && <td style={tfStyle}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='description')}  value={colFilters.description}  onChange={v=>setCF('description', v)}  /></td>}
              {show('area')         && <td style={tfStyle}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='area')}         value={colFilters.area}         onChange={v=>setCF('area', v)}         /></td>}
              {show('flagged')      && <td style={{ ...tfStyle, textAlign:'center' }}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='flagged')}      value={colFilters.flagged}      onChange={v=>setCF('flagged', v)}      /></td>}
              {show('lastModified') && <td style={tfStyle}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='lastModified')} value={colFilters.lastModified} onChange={v=>setCF('lastModified', v)} /></td>}
              {show('io')           && <td style={{ ...tfStyle, textAlign:'center' }}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='io')}           value={colFilters.io}           onChange={v=>setCF('io', v)}           /></td>}
              {show('plc')          && <td style={{ ...tfStyle, textAlign:'center' }}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='plc')}          value={colFilters.plc}          onChange={v=>setCF('plc', v)}          /></td>}
              {show('scada')        && <td style={{ ...tfStyle, textAlign:'center' }}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='scada')}        value={colFilters.scada}        onChange={v=>setCF('scada', v)}        /></td>}
              {show('mes')          && <td style={{ ...tfStyle, textAlign:'center' }}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='mes')}          value={colFilters.mes}          onChange={v=>setCF('mes', v)}          /></td>}
              {show('custom')       && <td style={tfStyle}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='custom')}       value={colFilters.custom}       onChange={v=>setCF('custom', v)}       /></td>}
              {show('notes')        && <td style={tfStyle}><ColFilter col={ALL_COLUMNS.find(c=>c.id==='notes')}        value={colFilters.notes}        onChange={v=>setCF('notes', v)}        /></td>}
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
                        <td style={tdStyle}>
                          {inst.isFlagged && <span style={{ color: '#e55353', marginRight: 5 }}>●</span>}
                          {inst.name}
                        </td>

                        {show('description') && <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{inst.description || '—'}</td>}

                        {show('area') && <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{getAreaLabel(inst.areaId, areas) || '—'}</td>}

                        {show('flagged') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {inst.isFlagged ? <span style={{ color: '#e55353', fontSize: 15 }}>●</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        )}

                        {show('lastModified') && (
                          <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {inst.lastModification ? new Date(inst.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </td>
                        )}

                        {['io','plc','scada','mes'].filter(f => show(f)).map(f => (
                          <td key={f} style={{ ...tdStyle, textAlign: 'center' }}>
                            <input type="checkbox" checked={!!c[f]}
                              onChange={e => setCheck(template.id, inst.id, f, e.target.checked)}
                              style={{ cursor: 'pointer' }} />
                          </td>
                        ))}

                        {show('custom') && (
                          <td style={tdStyle}>
                            <input type="text" value={c.custom || ''}
                              onChange={e => setCheck(template.id, inst.id, 'custom', e.target.value)}
                              placeholder="—"
                              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
                          </td>
                        )}

                        {show('notes') && (
                          <td style={{ ...tdStyle, minWidth: 220 }}>
                            <NotesCell
                              value={c.notes}
                              onBlur={v => setCheck(template.id, inst.id, 'notes', v)}
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
