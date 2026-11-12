import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Edit2, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import DataTypeSelect, { dataTypeName } from '../shared/DataTypeSelect';
import DatasetEditorModal, { datasetLabel } from './DatasetEditorModal';

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

export default function AttributeGrid({ attributes, templateAttributes, mode, onChange, hideDefaults = true, instanceArea }) {
  const isTemplate = mode === 'template';
  const [datasetEditId, setDatasetEditId] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());

  const toggleFolder = (id) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateAttr = useCallback((id, field, value) => {
    onChange(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  }, [onChange]);

  const addAttr = useCallback((folderId = null) => {
    if (!isTemplate) return;
    const newAttr = {
      id: nextId(attributes),
      name: 'Attribute',
      description: '',
      dataType: 9,
      value: '',
      parameter: false,
      ...(folderId != null ? { folderId } : {}),
    };
    onChange(prev => [...prev, newAttr]);
  }, [attributes, isTemplate, onChange]);

  const addFolder = useCallback(() => {
    if (!isTemplate) return;
    const newFolder = { id: nextId(attributes), folder: true, name: 'Folder' };
    // Insert before ungrouped attrs so folders stay at top
    onChange(prev => {
      const folders = prev.filter(a => a.folder);
      const inFolders = prev.filter(a => !a.folder && a.folderId != null);
      const ungrouped = prev.filter(a => !a.folder && a.folderId == null);
      return [...folders, newFolder, ...inFolders, ...ungrouped];
    });
  }, [attributes, isTemplate, onChange]);

  const removeFolder = useCallback((folderId) => {
    // Collect the folder and all descendant folder IDs
    const toRemove = new Set([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      attributes.forEach(a => {
        if (a.folder && a.parentFolderId != null && toRemove.has(a.parentFolderId) && !toRemove.has(a.id)) {
          toRemove.add(a.id);
          changed = true;
        }
      });
    }
    onChange(prev => prev
      .filter(a => !toRemove.has(a.id))
      .map(a => a.folderId != null && toRemove.has(a.folderId) ? { ...a, folderId: undefined } : a)
    );
  }, [attributes, onChange]);

  const removeAttr = useCallback((id) => {
    onChange(prev => prev.filter(a => a.id !== id));
  }, [onChange]);

  // ── Build display structure ──────────────────────────────────────────────
  // In template mode: source is `attributes` directly.
  // In instance mode: source is templateAttributes merged with instance values.
  const source = isTemplate
    ? attributes
    : (templateAttributes || []).map(ta => {
        const ia = (attributes || []).find(a => a.id === ta.id);
        return {
          ...ta,
          value: ia ? ia.value : ta.value,
          _instanceAttr: ia,
          _defaultValue: ta.value,
        };
      });

  const folderItems  = source.filter(a => a.folder);
  const childAttrs   = source.filter(a => !a.folder && a.folderId != null);
  const ungrouped    = source.filter(a => !a.folder && a.folderId == null);

  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  function sortAttrs(list) {
    const col = sortCol || 'name';
    const dir = sortCol ? sortDir : 'asc';
    return [...list].sort((a, b) => {
      const av = String(a[col] || '').toLowerCase();
      const bv = String(b[col] || '').toLowerCase();
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  function sortFolders(list) {
    return [...list].sort((a, b) => String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()));
  }

  // Hide-defaults filter for instance mode
  function filterDefaults(list) {
    if (isTemplate || !hideDefaults) return list;
    return list.filter(attr => {
      const val = String(attr.value ?? '');
      const def = String(attr._defaultValue ?? '');
      return val !== '' && val !== def;
    });
  }

  // Area row
  const areaRow = !isTemplate && instanceArea !== undefined
    ? { id: '__area__', _isAreaRow: true, value: instanceArea || '' }
    : null;
  const areaVisible = areaRow && (!hideDefaults || !!areaRow.value);

  function SortIcon({ col }) {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  }

  const datasetEditAttr = datasetEditId !== null ? source.find(a => a.id === datasetEditId) : null;

  // ── Attribute row renderer ───────────────────────────────────────────────
  function renderAttrRow(attr, indentPx = 0) {
    return (
      <tr key={attr.id} style={indentPx > 0 ? { background: 'var(--bg-card)' } : undefined}>
        <td style={{ paddingLeft: 8 + indentPx }}>
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
              onChange={v => {
                updateAttr(attr.id, 'dataType', v);
                if (v === 11 && !attr.parameter) updateAttr(attr.id, 'parameter', true);
              }}
              style={{ padding: '2px 6px', fontSize: 12 }}
            />
          ) : (
            <span className="text-text-muted text-xs">{dataTypeName(attr.dataType)}</span>
          )}
        </td>
        <td>
          {attr.dataType === 11 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {datasetLabel(attr.value)}
              </span>
              <button
                className="btn-ghost btn-icon"
                style={{ padding: 2 }}
                title="Edit dataset"
                onClick={() => setDatasetEditId(attr.id)}
              >
                <Edit2 size={12} />
              </button>
            </div>
          ) : (
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
          )}
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
    );
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
            {/* ── Area row (instance only) ─────────────────────────── */}
            {areaVisible && (
              <tr style={{ opacity: 0.75, fontStyle: 'italic' }}>
                <td><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Area</span></td>
                <td><span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>assigned area</span></td>
                <td><span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span></td>
                <td><span style={{ color: 'var(--text-muted)' }}>{areaRow.value || <span style={{ color: 'var(--text-disabled)' }}>—</span>}</span></td>
                <td />
                {isTemplate && <td />}
              </tr>
            )}

            {/* ── Folders (recursive, supports nesting) ───────────── */}
            {(() => {
              function countDeep(fid) {
                return childAttrs.filter(a => a.folderId === fid).length
                  + folderItems.filter(f => f.parentFolderId === fid).reduce((n, sf) => n + countDeep(sf.id), 0);
              }

              function renderFolderGroup(folder, depth) {
                const collapsed     = collapsedFolders.has(folder.id);
                const directAttrs   = sortAttrs(childAttrs.filter(a => a.folderId === folder.id));
                const subFolders    = sortFolders(folderItems.filter(f => f.parentFolderId === folder.id));
                const visibleAttrs  = filterDefaults(directAttrs);
                const headerIndent  = depth * 16;
                const childIndent   = headerIndent + 20;

                return (
                  <React.Fragment key={folder.id}>
                    <tr style={{ background: 'var(--bg-main)' }}>
                      <td colSpan={isTemplate ? 5 : 4} style={{ padding: '5px 8px', paddingLeft: 8 + headerIndent }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => toggleFolder(folder.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}
                          >
                            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <Folder size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          {isTemplate ? (
                            <EditCell
                              value={folder.name}
                              onChange={v => updateAttr(folder.id, 'name', v)}
                              style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                              {folder.name}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>
                            ({countDeep(folder.id)})
                          </span>
                        </div>
                      </td>
                      {isTemplate && (
                        <td style={{ textAlign: 'right', paddingRight: 6 }}>
                          <button
                            className="btn-ghost btn-icon"
                            style={{ padding: 3, color: '#e55353' }}
                            onClick={() => removeFolder(folder.id)}
                            title="Delete folder"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {!collapsed && subFolders.map(sf => renderFolderGroup(sf, depth + 1))}
                    {!collapsed && visibleAttrs.map(attr => renderAttrRow(attr, childIndent))}
                    {!collapsed && isTemplate && (
                      <tr
                        onClick={() => addAttr(folder.id)}
                        style={{ cursor: 'pointer', background: 'var(--bg-card)' }}
                        className="add-row"
                      >
                        <td colSpan={6} style={{ padding: '5px 12px 5px', paddingLeft: 12 + childIndent }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-disabled)', fontSize: 12 }}>
                            <Plus size={12} /> Add Attribute
                          </span>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              }

              return sortFolders(folderItems.filter(f => f.parentFolderId == null)).map(f => renderFolderGroup(f, 0));
            })()}

            {/* ── Ungrouped attributes ─────────────────────────────── */}
            {filterDefaults(sortAttrs(ungrouped)).map(attr => renderAttrRow(attr, false))}

            {/* Empty state */}
            {folderItems.length === 0 && filterDefaults(ungrouped).length === 0 && !areaVisible && (
              <tr>
                <td colSpan={isTemplate ? 6 : 5} className="text-center py-8 text-text-muted text-xs">
                  {isTemplate
                    ? 'No attributes. Use the buttons below to add one.'
                    : (hideDefaults && source.length > 0
                        ? 'All attributes are at their default values.'
                        : 'No attributes defined on this template.')}
                </td>
              </tr>
            )}

            {/* ── Add row (template only) ──────────────────────────── */}
            {isTemplate && (
              <tr style={{ cursor: 'default' }} className="add-row">
                <td colSpan={6} style={{ padding: '6px 12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span
                      onClick={addFolder}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-disabled)', fontSize: 12, cursor: 'pointer' }}
                    >
                      <Folder size={13} /> Add Folder
                    </span>
                    <span
                      onClick={() => addAttr(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-disabled)', fontSize: 12, cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add Attribute
                    </span>
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {datasetEditAttr && (
        <DatasetEditorModal
          value={datasetEditAttr.value}
          onApply={v => {
            if (isTemplate) {
              updateAttr(datasetEditAttr.id, 'value', v);
            } else {
              onChange(prev => {
                const exists = prev.find(a => a.id === datasetEditAttr.id);
                if (exists) return prev.map(a => a.id === datasetEditAttr.id ? { ...a, value: v } : a);
                return [...prev, { id: datasetEditAttr.id, value: v }];
              });
            }
            setDatasetEditId(null);
          }}
          onCancel={() => setDatasetEditId(null)}
        />
      )}
    </div>
  );
}
