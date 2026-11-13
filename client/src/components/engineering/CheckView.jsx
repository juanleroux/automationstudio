import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const DEFAULT_DOC_COLUMNS = [
  { id: 'description',  label: 'Description',  colType: 'text',     builtin: true, defaultW: 180 },
  { id: 'area',         label: 'Area',          colType: 'text',     builtin: true, defaultW: 150 },
  { id: 'flagged',      label: 'Flagged',       colType: 'checkbox', builtin: true, defaultW: 76  },
  { id: 'lastModified', label: 'Last Modified', colType: 'text',     builtin: true, defaultW: 112 },
  { id: 'io',           label: 'I/O',           colType: 'checkbox', builtin: true, defaultW: 46  },
  { id: 'plc',          label: 'PLC',           colType: 'checkbox', builtin: true, defaultW: 46  },
  { id: 'scada',        label: 'SCADA',         colType: 'checkbox', builtin: true, defaultW: 56  },
  { id: 'mes',          label: 'MES',           colType: 'checkbox', builtin: true, defaultW: 46  },
  { id: 'notes',        label: 'Notes',         colType: 'text',     builtin: true, defaultW: 180 },
];

function getDocColumns(project) {
  if (project?.documentationColumns?.length) return project.documentationColumns;
  return DEFAULT_DOC_COLUMNS.map(c => ({ ...c, enabled: true }));
}

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

function ResizeHandle({ onMouseDown }) {
  return (
    <span
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 6,
        cursor: 'col-resize', zIndex: 1, borderRight: '2px solid transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderRightColor = 'var(--border)')}
      onMouseLeave={e => (e.currentTarget.style.borderRightColor = 'transparent')}
    />
  );
}

export default function CheckView() {
  const { project, updateProject } = useProject();
  const [colFilters, setColFilters] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [colWidths, setColWidths] = useState(() => {
    const w = { instance: 140 };
    DEFAULT_DOC_COLUMNS.forEach(c => { w[c.id] = c.defaultW; });
    return w;
  });

  const templates = project?.templates || [];
  const areas     = project?.areas     || [];
  const checkData = project?.checkData || {};

  const docColumns  = useMemo(() => getDocColumns(project), [project]);
  const enabledCols = useMemo(() => docColumns.filter(c => c.enabled !== false), [docColumns]);

  const instanceFilter = colFilters._instance || '';

  function getFilter(col) {
    return colFilters[col.id] ?? (col.colType === 'checkbox' ? 'all' : '');
  }

  function getCheck(tid, iid) {
    return checkData[`${tid}:${iid}`] || {};
  }

  function setCheck(tid, iid, field, value) {
    const key = `${tid}:${iid}`;
    updateProject(p => ({
      ...p,
      checkData: { ...(p.checkData || {}), [key]: { ...(p.checkData?.[key] || {}), [field]: value } },
    }));
  }

  const setCF = (colId, val) => setColFilters(prev => ({ ...prev, [colId]: val }));
  const hasActiveFilters = Object.entries(colFilters).some(([, v]) => v && v !== 'all');

  const allRows = useMemo(() => {
    const rows = [];
    for (const t of templates)
      for (const inst of (t.instances || []))
        rows.push({ template: t, instance: inst });
    return rows;
  }, [templates]);

  const filteredRows = useMemo(() => {
    return allRows.filter(({ template, instance }) => {
      if (instanceFilter && !instance.name.toLowerCase().includes(instanceFilter.toLowerCase())) return false;
      for (const col of enabledCols) {
        const fv = getFilter(col);
        if (col.id === 'description') {
          if (fv && !(instance.description || '').toLowerCase().includes(fv.toLowerCase())) return false;
        } else if (col.id === 'area') {
          if (fv) {
            if (!getAreaLabel(instance.areaId, areas).toLowerCase().includes(fv.toLowerCase())) return false;
          }
        } else if (col.id === 'lastModified') {
          if (fv) {
            const d = instance.lastModification
              ? new Date(instance.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toLowerCase()
              : '';
            if (!d.includes(fv.toLowerCase())) return false;
          }
        } else if (col.id === 'flagged') {
          if (fv === 'yes' && !instance.isFlagged) return false;
          if (fv === 'no'  &&  instance.isFlagged) return false;
        } else {
          const c = checkData[`${template.id}:${instance.id}`] || {};
          if (col.colType === 'checkbox') {
            if (fv === 'yes' && !c[col.id]) return false;
            if (fv === 'no'  &&  c[col.id]) return false;
          } else if (fv) {
            if (!(c[col.id] || '').toLowerCase().includes(fv.toLowerCase())) return false;
          }
        }
      }
      return true;
    });
  }, [allRows, colFilters, enabledCols, checkData, areas]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const { template, instance } of filteredRows) {
      if (!map.has(template.id)) map.set(template.id, { template, instances: [] });
      map.get(template.id).instances.push(instance);
    }
    return [...map.values()].sort((a, b) => a.template.name.localeCompare(b.template.name));
  }, [filteredRows]);

  const toggleGroup = id => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalInstances = filteredRows.length;
  const checkedCount   = filteredRows.filter(({ template, instance }) => {
    const c = checkData[`${template.id}:${instance.id}`];
    if (!c) return false;
    return enabledCols.some(col => col.colType === 'checkbox' && col.id !== 'flagged' && c[col.id]);
  }).length;

  const startResize = (e, colId) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[colId] || 100;
    const onMove = ev => setColWidths(prev => ({ ...prev, [colId]: Math.max(40, startW + ev.clientX - startX) }));
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const isCenter = col => col.colType === 'checkbox' || col.id === 'flagged';
  const allCols  = [{ id: 'instance', label: 'Instance', colType: 'text', builtin: true }, ...enabledCols];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={() => setColFilters({})}
            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, fontSize: 12, color: 'var(--text-muted)' }}>
            <X size={12} /> Clear filters
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalInstances} instances · {checkedCount} started
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            {allCols.map(c => <col key={c.id} style={{ width: colWidths[c.id] || 120 }} />)}
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {allCols.map(c => (
                <th key={c.id} style={{ ...thBase, textAlign: isCenter(c) ? 'center' : 'left' }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{c.label}</span>
                  <ResizeHandle onMouseDown={e => startResize(e, c.id)} />
                </th>
              ))}
            </tr>
            <tr>
              <td style={tfBase}>
                <input type="text" value={instanceFilter} onChange={e => setCF('_instance', e.target.value)} placeholder="Filter…" style={finStyle} />
              </td>
              {enabledCols.map(col => (
                <td key={col.id} style={{ ...tfBase, textAlign: isCenter(col) ? 'center' : 'left' }}>
                  {isCenter(col) ? (
                    <select value={getFilter(col)} onChange={e => setCF(col.id, e.target.value)} style={fselStyle}>
                      <option value="all">All</option>
                      {col.id === 'flagged'
                        ? <><option value="yes">Flagged</option><option value="no">Not flagged</option></>
                        : <><option value="yes">Checked</option><option value="no">Unchecked</option></>}
                    </select>
                  ) : (
                    <input type="text" value={getFilter(col)} onChange={e => setCF(col.id, e.target.value)} placeholder="Filter…" style={finStyle} />
                  )}
                </td>
              ))}
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
                        <td style={tdBase}>
                          {inst.isFlagged && <span style={{ color: '#e55353', marginRight: 5, fontSize: 10 }}>●</span>}
                          {inst.name}
                        </td>
                        {enabledCols.map(col => {
                          const center = isCenter(col);
                          const cs = { ...tdBase, textAlign: center ? 'center' : 'left' };
                          if (col.id === 'description')
                            return <td key={col.id} style={{ ...cs, color: 'var(--text-muted)' }}>{inst.description || '—'}</td>;
                          if (col.id === 'area')
                            return <td key={col.id} style={{ ...cs, color: 'var(--text-muted)' }}>{getAreaLabel(inst.areaId, areas) || '—'}</td>;
                          if (col.id === 'flagged')
                            return <td key={col.id} style={cs}>
                              {inst.isFlagged ? <span style={{ color: '#e55353' }}>●</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>;
                          if (col.id === 'lastModified')
                            return <td key={col.id} style={{ ...cs, color: 'var(--text-muted)' }}>
                              {inst.lastModification ? new Date(inst.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                            </td>;
                          if (col.colType === 'checkbox')
                            return <td key={col.id} style={cs}>
                              <input type="checkbox" checked={!!c[col.id]}
                                onChange={e => setCheck(template.id, inst.id, col.id, e.target.checked)}
                                style={{ cursor: 'pointer' }} />
                            </td>;
                          return <td key={col.id} style={cs}>
                            <input type="text" value={c[col.id] || ''}
                              onChange={e => setCheck(template.id, inst.id, col.id, e.target.value)}
                              placeholder="—"
                              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }} />
                          </td>;
                        })}
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
