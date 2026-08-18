import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Tag,
  Circle, Search, Filter, Plus, Trash2, Copy, Edit2,
  Upload, Download, Flag, MoreVertical, ArrowUpDown, FileCode
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../shared/Toast';
import { uploadToIgnition } from '../../api/client';
import { exportFromIgnition, createTiaInstances } from '../../api/client';
import { buildIgnitionPayload, buildInstancesPayload, buildAreaPath, parseIgnitionResponse, convertUdtsToTemplates } from '../../utils/ignition';
import { runProfileExport } from '../../utils/profileExport';
import { downloadStudio5000Routine, parseProjectL5X, mapL5XDataType } from '../../utils/studio5000Export';
import { parseXDB, mapCEDataType, downloadXBD } from '../../utils/controlExpertExport';
import ConfirmDialog from '../shared/ConfirmDialog';
import Modal from '../shared/Modal';

function S5kGroupRow({ group, s5kSelected, setS5kSelected }) {
  const [expanded, setExpanded] = useState(true);
  const allSelected = group.instances.every(i => s5kSelected.has(`${group.aoiName}::${i.name}`));
  const someSelected = !allSelected && group.instances.some(i => s5kSelected.has(`${group.aoiName}::${i.name}`));
  const checkRef = useRef(null);
  useEffect(() => { if (checkRef.current) checkRef.current.indeterminate = someSelected; }, [someSelected]);
  const toggleAll = () => {
    setS5kSelected(prev => {
      const next = new Set(prev);
      group.instances.forEach(i => {
        const k = `${group.aoiName}::${i.name}`;
        if (allSelected) next.delete(k); else next.add(k);
      });
      return next;
    });
  };
  const toggleOne = (name) => {
    setS5kSelected(prev => {
      const next = new Set(prev);
      const k = `${group.aoiName}::${name}`;
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', background: 'var(--bg-surface)', borderRadius: 5, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" ref={checkRef} checked={allSelected} onChange={toggleAll} onClick={e => e.stopPropagation()} style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }} />
        {expanded ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
        <FileCode size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{group.aoiName}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{group.instances.length} instance{group.instances.length !== 1 ? 's' : ''}</span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 22 }}>
          {group.instances.map((inst, i) => (
            <div key={i} className="tree-node" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 3, cursor: 'pointer' }} onClick={() => toggleOne(inst.name)}>
              <input type="checkbox" checked={s5kSelected.has(`${group.aoiName}::${inst.name}`)} onChange={() => toggleOne(inst.name)} onClick={e => e.stopPropagation()} style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: inst.isNamed ? 'var(--text-primary)' : 'var(--text-muted)' }}>{inst.name}</span>
              {inst.tagRef !== inst.name && <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{inst.tagRef}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CeGroupRow({ group, ceSelected, setCeSelected }) {
  const [expanded, setExpanded] = useState(true);
  const allSelected = group.instances.every(i => ceSelected.has(`${group.fbTypeName}::${i}`));
  const someSelected = !allSelected && group.instances.some(i => ceSelected.has(`${group.fbTypeName}::${i}`));
  const checkRef = useRef(null);
  useEffect(() => { if (checkRef.current) checkRef.current.indeterminate = someSelected; }, [someSelected]);
  const toggleAll = () => {
    setCeSelected(prev => {
      const next = new Set(prev);
      group.instances.forEach(i => {
        const k = `${group.fbTypeName}::${i}`;
        if (allSelected) next.delete(k); else next.add(k);
      });
      return next;
    });
  };
  const toggleOne = (name) => {
    setCeSelected(prev => {
      const next = new Set(prev);
      const k = `${group.fbTypeName}::${name}`;
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', background: 'var(--bg-surface)', borderRadius: 5, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" ref={checkRef} checked={allSelected} onChange={toggleAll} onClick={e => e.stopPropagation()} style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }} />
        {expanded ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
        <FileCode size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{group.fbTypeName}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{group.instances.length} instance{group.instances.length !== 1 ? 's' : ''}</span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 22 }}>
          {group.instances.map((name, i) => (
            <div key={i} className="tree-node" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 3, cursor: 'pointer' }} onClick={() => toggleOne(name)}>
              <input type="checkbox" checked={ceSelected.has(`${group.fbTypeName}::${name}`)} onChange={() => toggleOne(name)} onClick={e => e.stopPropagation()} style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function nextId(arr) {
  if (!arr || !arr.length) return 1;
  return Math.max(...arr.map(x => x.id)) + 1;
}

export default function TemplateTree({ selected, onSelect }) {
  const { project, updateProject } = useProject();
  const toast = useToast();

  const [expanded, setExpanded] = useState(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | flagged
  const [sortDir, setSortDir] = useState('asc'); // asc | desc
  const [contextMenu, setContextMenu] = useState(null);
  const [renaming, setRenaming] = useState(null); // { type: 'template'|'instance', templateId, instanceId }
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddInstance, setShowAddInstance] = useState(null); // templateId
  const [newName, setNewName] = useState('');
  const [importModalTemplate, setImportModalTemplate] = useState(null);
  const [importAttributesModalTemplate, setImportAttributesModalTemplate] = useState(null);
  const [importProfileTemplateId, setImportProfileTemplateId] = useState(null);
  const [importProfileModalTemplate, setImportProfileModalTemplate] = useState(null); // templateId for profile-select modal
  const [dragOver, setDragOver] = useState(null);
  const importTemplateRef = useRef(null);
  const importProfileRef = useRef(null);
  const [showImportIgnition, setShowImportIgnition] = useState(false);
  const [ignitionPath, setIgnitionPath] = useState('');
  const [ignitionFetch, setIgnitionFetch] = useState({ loading: false, error: null, udts: [] });
  const [selectedUdts, setSelectedUdts] = useState(new Set());
  const [ignitionFilter, setIgnitionFilter] = useState('');
  const [showImportStudio5000, setShowImportStudio5000] = useState(false);
  const [s5kGroups, setS5kGroups] = useState([]);
  const [s5kSelected, setS5kSelected] = useState(new Set());
  const [showImportControlExpert, setShowImportControlExpert] = useState(false);
  const [ceGroups, setCeGroups] = useState([]); // [{ fbTypeName, fbVersion, parameters, instances: [name] }]
  const [ceSelected, setCeSelected] = useState(new Set());
  const [multiSelected, setMultiSelected] = useState(new Set()); // "templateId:instanceId"

  const renameInputRef = useRef(null);

  const templates = project?.templates || [];
  const areas = project?.areas || [];

  useEffect(() => {
    if (renameInputRef.current) renameInputRef.current.focus();
  }, [renaming]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => { window.removeEventListener('click', handler); window.removeEventListener('contextmenu', handler); };
  }, [contextMenu]);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const handleContextMenu = (e, type, templateId, instanceId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, templateId, instanceId });
  };

  const startRename = (type, templateId, instanceId, currentName) => {
    setRenaming({ type, templateId, instanceId });
    setRenameValue(currentName);
    setContextMenu(null);
  };

  const commitRename = () => {
    if (!renaming || !renameValue.trim()) { setRenaming(null); return; }
    const now = new Date().toISOString();
    if (renaming.type === 'template') {
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t =>
          t.id === renaming.templateId
            ? { ...t, name: renameValue.trim(), lastModification: now }
            : t
        )
      }));
    } else {
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t =>
          t.id === renaming.templateId
            ? {
                ...t,
                instances: (t.instances || []).map(i =>
                  i.id === renaming.instanceId
                    ? { ...i, name: renameValue.trim(), lastModification: now }
                    : i
                )
              }
            : t
        )
      }));
    }
    setRenaming(null);
  };

  const addTemplate = () => {
    if (!newName.trim()) return;
    const now = new Date().toISOString();
    const id = nextId(templates);
    const tmpl = {
      id, name: newName.trim(), description: '',
      lastModification: now,
      attributes: [], instances: [], profiles: []
    };
    updateProject(p => ({ ...p, templates: [...p.templates, tmpl] }));
    setExpanded(prev => new Set([...prev, id]));
    onSelect({ type: 'template', templateId: id });
    setShowAddTemplate(false);
    setNewName('');
    toast.success(`Template "${newName.trim()}" added`);
  };

  const addInstance = (templateId) => {
    if (!newName.trim()) return;
    const now = new Date().toISOString();
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t => {
        if (t.id !== templateId) return t;
        const instId = nextId(t.instances || []);
        const firstArea = areas.find(a => a.id !== 0);
        return {
          ...t,
          instances: [...(t.instances || []), {
            id: instId,
            areaId: firstArea ? firstArea.id : 0,
            name: newName.trim(),
            description: '',
            isFlagged: false,
            lastModification: now,
            attributes: []
          }]
        };
      })
    }));
    setShowAddInstance(null);
    setNewName('');
    toast.success(`Instance "${newName.trim()}" added`);
  };

  const duplicateTemplate = (templateId) => {
    const orig = templates.find(t => t.id === templateId);
    if (!orig) return;
    const now = new Date().toISOString();
    const newId = nextId(templates);
    const copy = {
      ...orig,
      id: newId,
      name: `${orig.name}_Copy`,
      lastModification: now,
      instances: (orig.instances || []).map((inst, i) => ({
        ...inst,
        id: i + 1,
        name: `${inst.name}_Copy`
      }))
    };
    updateProject(p => ({ ...p, templates: [...p.templates, copy] }));
    toast.success('Template duplicated');
    setContextMenu(null);
  };

  const duplicateInstance = (templateId, instanceId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t => {
        if (t.id !== templateId) return t;
        const orig = (t.instances || []).find(i => i.id === instanceId);
        if (!orig) return t;
        const newId = nextId(t.instances || []);
        const copy = { ...orig, id: newId, name: `${orig.name}_Copy`, lastModification: new Date().toISOString() };
        return { ...t, instances: [...(t.instances || []), copy] };
      })
    }));
    toast.success('Instance duplicated');
    setContextMenu(null);
  };

  const deleteTemplate = (templateId) => {
    updateProject(p => ({ ...p, templates: p.templates.filter(t => t.id !== templateId) }));
    if (selected?.templateId === templateId) onSelect(null);
    toast.success('Template deleted');
    setConfirmDelete(null);
  };

  const deleteInstance = (templateId, instanceId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === templateId
          ? { ...t, instances: (t.instances || []).filter(i => i.id !== instanceId) }
          : t
      )
    }));
    if (selected?.instanceId === instanceId) onSelect({ type: 'template', templateId });
    toast.success('Instance deleted');
    setConfirmDelete(null);
  };

  const toggleFlag = (templateId, instanceId) => {
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t =>
        t.id === templateId
          ? {
              ...t,
              instances: (t.instances || []).map(i =>
                i.id === instanceId ? { ...i, isFlagged: !i.isFlagged } : i
              )
            }
          : t
      )
    }));
    setContextMenu(null);
  };

  // RFC 4180 CSV line parser — handles quoted fields, embedded commas, and "" escaped quotes
  const parseCSVLine = (line) => {
    const fields = [];
    let i = 0;
    while (i <= line.length) {
      if (i === line.length) { fields.push(''); break; }
      if (line[i] === '"') {
        i++;
        let field = '';
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { field += line[i++]; }
        }
        fields.push(field);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i).trim()); break; }
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
    return fields;
  };

  // Read a CSV file as text, falling back to windows-1252 if UTF-8 produces replacement chars
  const readCSVFile = (file, onText) => {
    const utf8Reader = new FileReader();
    utf8Reader.onload = (e) => {
      const text = e.target.result;
      if (text.includes('�')) {
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e2) => onText(e2.target.result);
        fallbackReader.readAsText(file, 'windows-1252');
      } else {
        onText(text);
      }
    };
    utf8Reader.readAsText(file, 'utf-8');
  };

  // CSV Import
  const handleImportCSV = (templateId, file) => {
    if (!file) return;
    readCSVFile(file, (text) => {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error('CSV must have header + data rows'); return; }
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const nameIdx = headers.findIndex(h => h === 'name');
      const now = new Date().toISOString();
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t => {
          if (t.id !== templateId) return t;
          let nextInstId = nextId(t.instances || []);
          const newInsts = lines.slice(1).map(line => {
            const cells = parseCSVLine(line);
            const name = nameIdx >= 0 ? (cells[nameIdx] || `Instance_${nextInstId}`) : `Instance_${nextInstId}`;
            const instAttrs = (t.attributes || []).map(ta => {
              const idx = headers.findIndex(h => h === ta.name.toLowerCase());
              return { id: ta.id, value: idx >= 0 ? (cells[idx] || ta.value) : ta.value };
            });
            return {
              id: nextInstId++,
              areaId: 0,
              name,
              description: cells[headers.findIndex(h => h === 'description')] || '',
              isFlagged: false,
              lastModification: now,
              attributes: instAttrs
            };
          });
          return { ...t, instances: [...(t.instances || []), ...newInsts] };
        })
      }));
      toast.success(`Imported ${lines.length - 1} instances`);
      setImportModalTemplate(null);
    });
  };

  const handleImportAttributesCSV = (templateId, file) => {
    if (!file) return;
    readCSVFile(file, (text) => {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error('CSV must have header + data rows'); return; }
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const nameIdx = headers.indexOf('name');
      const descIdx = headers.indexOf('description');
      const typeIdx = headers.indexOf('datatype');
      const valIdx = headers.indexOf('value');
      const paramIdx = headers.indexOf('parameter');
      if (nameIdx < 0) { toast.error('CSV must have a "Name" column'); return; }
      const now = new Date().toISOString();
      updateProject(p => ({
        ...p,
        templates: p.templates.map(t => {
          if (t.id !== templateId) return t;
          let nextAttrId = nextId(t.attributes || []);
          const newAttrs = lines.slice(1).map(line => {
            const cells = parseCSVLine(line);
            return {
              id: nextAttrId++,
              name: cells[nameIdx] || `Attr_${nextAttrId}`,
              description: descIdx >= 0 ? (cells[descIdx] || '') : '',
              dataType: typeIdx >= 0 ? (cells[typeIdx] || 'String') : 'String',
              value: valIdx >= 0 ? (cells[valIdx] || '') : '',
              parameter: paramIdx >= 0 ? cells[paramIdx]?.toLowerCase() === 'true' : false,
              lastModification: now,
            };
          });
          return { ...t, lastModification: now, attributes: [...(t.attributes || []), ...newAttrs] };
        })
      }));
      toast.success(`Imported ${lines.length - 1} attributes`);
      setImportAttributesModalTemplate(null);
    });
  };

  // Export attributes as CSV
  const exportAttributesCSV = (template) => {
    const attrs = template.attributes || [];
    const header = ['Name', 'Description', 'DataType', 'Value', 'Parameter'];
    const rows = attrs.map(a => [a.name, a.description || '', a.dataType, a.value || '', a.parameter ? 'true' : 'false']);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_attributes.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${attrs.length} attributes`);
    setContextMenu(null);
  };

  // Export instances as CSV
  const exportInstancesCSV = (template) => {
    const attrs = template.attributes || [];
    const header = ['Name', 'Description', ...attrs.map(a => a.name)];
    const rows = (template.instances || []).map(inst => {
      const vals = attrs.map(ta => {
        const ia = (inst.attributes || []).find(a => a.id === ta.id);
        return ia ? ia.value : ta.value;
      });
      return [inst.name, inst.description, ...vals];
    });
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_instances.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${template.instances?.length || 0} instances`);
    setContextMenu(null);
  };

  // Upload template to Ignition as UDT via API
  const uploadTemplateToIgnition = async (template) => {
    setContextMenu(null);
    const eng = project?.engineering;
    if (!eng?.ignitionGateway) {
      toast.error('Configure Ignition gateway in Settings first');
      return;
    }
    const areas = project.areas || [];
    const base = eng.folderPath || '';

    // Separate unassigned instances (go with the type) from area-assigned ones
    const unassigned = (template.instances || []).filter(i => !i.areaId || i.areaId === 0);
    const assigned   = (template.instances || []).filter(i => i.areaId && i.areaId !== 0);

    // Group area-assigned instances by their resolved folder path
    const groups = new Map();
    for (const inst of assigned) {
      const areaPath = buildAreaPath(inst.areaId, areas);
      const fullPath = [base, areaPath].filter(Boolean).join('/');
      if (!groups.has(fullPath)) groups.set(fullPath, []);
      groups.get(fullPath).push(inst);
    }

    const uploadOpts = (folderPath, payload) => ({
      gatewayUrl: eng.ignitionGateway,
      apiKey: eng.apiKey,
      provider: eng.provider || 'default',
      collisionPolicy: eng.collisionPolicy || 'Overwrite',
      folderPath,
      payload,
    });

    try {
      // Upload UDT type + unassigned instances together
      await uploadToIgnition(uploadOpts(base, buildIgnitionPayload(template, unassigned)));

      // Upload each area group with the matching ?path=
      await Promise.all([...groups.entries()].map(([folderPath, insts]) =>
        uploadToIgnition(uploadOpts(folderPath, buildInstancesPayload(insts.map(inst => ({ template, instance: inst })))))
      ));

      toast.success(`Uploaded "${template.name}" to Ignition`);
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      const usedUrl = err.response?.data?.url;
      toast.error('Upload failed: ' + detail + (usedUrl ? ` [${usedUrl}]` : ''));
    }
  };

  // Import UDTs from Ignition
  const handleFetchFromIgnition = async () => {
    const eng = project?.engineering;
    if (!eng?.ignitionGateway) { toast.error('Configure Ignition gateway in Settings first'); return; }
    setIgnitionFetch({ loading: true, error: null, udts: [] });
    try {
      const result = await exportFromIgnition({
        gatewayUrl: eng.ignitionGateway,
        apiKey: eng.apiKey,
        provider: eng.provider || 'default',
        folderPath: ignitionPath || eng.folderPath || '',
      });
      const udts = parseIgnitionResponse(result.data);
      setIgnitionFetch({ loading: false, error: null, udts });
      setSelectedUdts(new Set(udts.map(r => `${r.folderPath}/${r.udtType.name}`)));
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setIgnitionFetch({ loading: false, error: msg, udts: [] });
    }
  };

  const handleImportIgnitionUdts = () => {
    const toImport = ignitionFetch.udts.filter(r => selectedUdts.has(`${r.folderPath}/${r.udtType.name}`));
    if (!toImport.length) return;
    updateProject(p => {
      const startId = nextId(p.templates || []);
      const newTemplates = convertUdtsToTemplates(toImport, startId);
      return { ...p, templates: [...(p.templates || []), ...newTemplates] };
    });
    toast.success(`Imported ${toImport.length} template(s) from Ignition`);
    setShowImportIgnition(false);
    setIgnitionFetch({ loading: false, error: null, udts: [] });
    setSelectedUdts(new Set());
  };

  // Multi-select helpers
  const instKey = (templateId, instanceId) => `${templateId}:${instanceId}`;
  const lastClickedRef = useRef(null);

  const toggleMultiSelect = (e, templateId, instanceId) => {
    e.stopPropagation();
    const key = instKey(templateId, instanceId);
    setMultiSelected(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  const handleInstanceClick = (e, templateId, instanceId) => {
    e.stopPropagation();
    const key = instKey(templateId, instanceId);

    if (e.shiftKey && lastClickedRef.current) {
      const [lastTid] = lastClickedRef.current.split(':').map(Number);
      if (lastTid === templateId) {
        const tmpl = filteredTemplates.find(t => t.id === templateId);
        const keys = (tmpl?.instances || []).map(i => instKey(templateId, i.id));
        const curIdx = keys.indexOf(key);
        const lastIdx = keys.indexOf(lastClickedRef.current);
        if (curIdx >= 0 && lastIdx >= 0) {
          const [from, to] = [Math.min(curIdx, lastIdx), Math.max(curIdx, lastIdx)];
          setMultiSelected(prev => {
            const s = new Set(prev);
            keys.slice(from, to + 1).forEach(k => s.add(k));
            return s;
          });
          return;
        }
      }
    }

    if (e.ctrlKey || e.metaKey) {
      setMultiSelected(prev => {
        const s = new Set(prev);
        if (s.has(key)) s.delete(key); else s.add(key);
        return s;
      });
      lastClickedRef.current = key;
      return;
    }

    setMultiSelected(new Set());
    onSelect({ type: 'instance', templateId, instanceId });
    lastClickedRef.current = key;
  };

  const deleteMultipleInstances = (instanceList) => {
    const byTemplate = {};
    instanceList.forEach(({ template, instance }) => {
      if (!byTemplate[template.id]) byTemplate[template.id] = new Set();
      byTemplate[template.id].add(instance.id);
    });
    updateProject(p => ({
      ...p,
      templates: p.templates.map(t => {
        const ids = byTemplate[t.id];
        if (!ids) return t;
        return { ...t, instances: (t.instances || []).filter(i => !ids.has(i.id)) };
      })
    }));
    setMultiSelected(new Set());
    onSelect(null);
    toast.success(`Deleted ${instanceList.length} instance${instanceList.length > 1 ? 's' : ''}`);
    setConfirmDelete(null);
  };

  const getSelectedInstances = (fallbackTemplateId, fallbackInstanceId) => {
    const key = instKey(fallbackTemplateId, fallbackInstanceId);
    const keys = multiSelected.size > 0 && multiSelected.has(key) ? multiSelected : new Set([key]);
    const result = [];
    for (const k of keys) {
      const [tid, iid] = k.split(':').map(Number);
      const tmpl = templates.find(t => t.id === tid);
      const inst = tmpl?.instances?.find(i => i.id === iid);
      if (tmpl && inst) result.push({ template: tmpl, instance: inst });
    }
    return result;
  };

  const exportInstancesToIgnition = async (instanceList) => {
    setContextMenu(null);
    const eng = project?.engineering;
    if (!eng?.ignitionGateway) { toast.error('Configure Ignition gateway in Settings first'); return; }

    const areas = project.areas || [];
    const base = eng.folderPath || '';

    // Group instances by their resolved folder path
    const groups = new Map();
    for (const item of instanceList) {
      const areaPath = buildAreaPath(item.instance.areaId, areas);
      const fullPath = [base, areaPath].filter(Boolean).join('/');
      if (!groups.has(fullPath)) groups.set(fullPath, []);
      groups.get(fullPath).push(item);
    }

    try {
      await Promise.all([...groups.entries()].map(([folderPath, items]) =>
        uploadToIgnition({
          gatewayUrl: eng.ignitionGateway,
          apiKey: eng.apiKey,
          provider: eng.provider || 'default',
          collisionPolicy: eng.collisionPolicy || 'Overwrite',
          folderPath,
          payload: buildInstancesPayload(items),
        })
      ));
      toast.success(`Uploaded ${instanceList.length} instance(s) to Ignition`);
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      toast.error('Upload failed: ' + detail);
    }
  };

  const exportInstancesToJSON = (instanceList) => {
    setContextMenu(null);
    const payload = buildInstancesPayload(instanceList);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = instanceList.length === 1 ? `${instanceList[0].instance.name}.json` : 'instances_export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${instanceList.length} instance(s)`);
  };

  // Export all templates as JSON
  const exportTemplatesJSON = () => {
    const data = JSON.stringify(templates, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'templates'}_templates.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${templates.length} template(s)`);
    setContextMenu(null);
  };

  // Import template from JSON file
  const handleImportTemplateJSON = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let data = JSON.parse(e.target.result);
        const now = new Date().toISOString();
        const incoming = Array.isArray(data) ? data : [data];
        updateProject(p => {
          let nextTmplId = nextId(p.templates || []);
          const added = incoming.map(tmpl => ({
            ...tmpl,
            id: nextTmplId++,
            name: tmpl.name || `Imported_${nextTmplId}`,
            lastModification: now,
            instances: (tmpl.instances || []).map((inst, i) => ({ ...inst, id: i + 1 })),
          }));
          return { ...p, templates: [...(p.templates || []), ...added] };
        });
        toast.success(`Imported ${incoming.length} template(s)`);
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    setContextMenu(null);
  };

  // Import profile(s) from JSON file into a template
  const handleImportProfileJSON = (templateId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const incoming = Array.isArray(data) ? data : [data];
        const now = new Date().toISOString();
        updateProject(p => ({
          ...p,
          templates: p.templates.map(t => {
            if (t.id !== templateId) return t;
            const existing = t.profiles || [];
            const added = incoming.map(prof => ({
              name: prof.name || 'Imported Profile',
              description: prof.description || '',
              exportType: prof.exportType ?? 0,
              formatType: prof.formatType ?? 0,
              tabularExportDelimiter: prof.tabularExportDelimiter || ',',
              structuralExportTemplate: prof.structuralExportTemplate || '',
              customFormat: prof.customFormat || '',
              attributes: prof.attributes || [],
            }));
            return { ...t, lastModification: now, profiles: [...existing, ...added] };
          })
        }));
        toast.success(`Imported ${incoming.length} profile${incoming.length > 1 ? 's' : ''}`);
      } catch {
        toast.error('Invalid profile JSON');
      }
    };
    reader.readAsText(file);
    setImportProfileTemplateId(null);
  };

  // Filter & search
  const filteredTemplates = templates.map(t => {
    let instances = t.instances || [];
    if (filter === 'flagged') instances = instances.filter(i => i.isFlagged);
    if (search) {
      const q = search.toLowerCase();
      instances = instances.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
      if (!t.name.toLowerCase().includes(q) && instances.length === 0) return null;
    }
    return { ...t, instances };
  }).filter(Boolean).sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  // Duplicate instance name detection (across all templates, not just filtered view)
  const duplicateNames = (() => {
    const counts = {};
    for (const t of templates) for (const i of (t.instances || [])) counts[i.name] = (counts[i.name] || 0) + 1;
    return new Set(Object.keys(counts).filter(n => counts[n] > 1));
  })();

  const isSelected = (type, templateId, instanceId) => {
    if (!selected) return false;
    if (type === 'template') return selected.type === 'template' && selected.templateId === templateId && !selected.instanceId;
    return selected.type === 'instance' && selected.templateId === templateId && selected.instanceId === instanceId;
  };

  // Drag and drop between templates
  const [dragging, setDragging] = useState(null); // { templateId, instanceId }

  const handleDragStart = (e, templateId, instanceId) => {
    setDragging({ templateId, instanceId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetTemplateId) => {
    e.preventDefault();
    if (!dragging || dragging.templateId === targetTemplateId) { setDragOver(null); setDragging(null); return; }
    // Move instance from one template to another
    updateProject(p => {
      let movedInst = null;
      const templates = p.templates.map(t => {
        if (t.id === dragging.templateId) {
          const inst = (t.instances || []).find(i => i.id === dragging.instanceId);
          if (inst) movedInst = inst;
          return { ...t, instances: (t.instances || []).filter(i => i.id !== dragging.instanceId) };
        }
        return t;
      });
      if (!movedInst) return p;
      const result = templates.map(t => {
        if (t.id !== targetTemplateId) return t;
        const newId = nextId(t.instances || []);
        return { ...t, instances: [...(t.instances || []), { ...movedInst, id: newId }] };
      });
      return { ...p, templates: result };
    });
    toast.success('Instance moved');
    setDragOver(null);
    setDragging(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search & filter bar */}
      <div className="px-2 py-2 flex-shrink-0 flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ paddingLeft: 24, fontSize: 12, padding: '4px 4px 4px 24px' }}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ fontSize: 12, padding: '4px 6px', width: 'auto', minWidth: 80 }}
        >
          <option value="all">All</option>
          <option value="flagged">Flagged</option>
        </select>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'Sorted A→Z (click for Z→A)' : 'Sorted Z→A (click for A→Z)'}
          style={{ padding: '3px 6px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 2 }}
        >
          <ArrowUpDown size={11} />
          {sortDir === 'asc' ? 'A→Z' : 'Z→A'}
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={importTemplateRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={e => { handleImportTemplateJSON(e.target.files[0]); e.target.value = ''; }}
      />
      <input
        ref={importProfileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={e => {
          if (importProfileTemplateId !== null) handleImportProfileJSON(importProfileTemplateId, e.target.files[0]);
          e.target.value = '';
        }}
      />

      {/* Tree */}
      <div
        className="flex-1 overflow-y-auto"
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'blank', templateId: null, instanceId: null }); }}
      >
        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-text-muted text-xs">
            <Folder size={28} className="mx-auto mb-2 opacity-30" />
            {search || filter !== 'all' ? 'No results' : 'No templates. Add one to get started.'}
          </div>
        )}
        {filteredTemplates.map(template => {
          const isExp = expanded.has(template.id);
          const instCount = template.instances?.length || 0;
          const isTSelected = isSelected('template', template.id);
          const hasDuplicateInst = (template.instances || []).some(i => duplicateNames.has(i.name));

          return (
            <div
              key={template.id}
              onDragOver={e => { e.preventDefault(); setDragOver(template.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, template.id)}
            >
              {/* Template row */}
              <div
                className={`tree-node flex items-center gap-1 px-2 py-1 ${isTSelected ? 'selected' : ''} ${dragOver === template.id ? 'bg-accent-muted' : ''}`}
                onClick={() => { toggleExpand(template.id); onSelect({ type: 'template', templateId: template.id }); }}
                onContextMenu={e => handleContextMenu(e, 'template', template.id, null)}
              >
                <button
                  className="flex-shrink-0 text-text-muted"
                  onClick={e => { e.stopPropagation(); toggleExpand(template.id); }}
                  style={{ padding: 1 }}
                >
                  {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {isExp ? <FolderOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : <Folder size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}

                {renaming?.type === 'template' && renaming.templateId === template.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    style={{ fontSize: 13, flex: 1, padding: '0 2px' }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm truncate"
                    style={{ color: hasDuplicateInst ? '#e55353' : 'var(--text-primary)' }}
                    onDoubleClick={e => { e.stopPropagation(); startRename('template', template.id, null, template.name); }}
                  >
                    {template.name}
                  </span>
                )}

                <span className="badge flex-shrink-0">{instCount}</span>
              </div>

              {/* Instances */}
              {isExp && (template.instances || []).map(inst => {
                const isISelected = isSelected('instance', template.id, inst.id);
                const isDuplicate = duplicateNames.has(inst.name);
                return (
                  <div
                    key={inst.id}
                    className={`tree-node flex items-center gap-1 pl-6 pr-2 py-1 ${isISelected ? 'selected' : ''} ${multiSelected.has(instKey(template.id, inst.id)) ? 'bg-accent-muted' : ''}`}
                    onClick={e => handleInstanceClick(e, template.id, inst.id)}
                    onContextMenu={e => handleContextMenu(e, 'instance', template.id, inst.id)}
                    draggable
                    onDragStart={e => handleDragStart(e, template.id, inst.id)}
                  >
                    <input
                      type="checkbox"
                      checked={multiSelected.has(instKey(template.id, inst.id))}
                      onChange={e => toggleMultiSelect(e, template.id, inst.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ flexShrink: 0, width: 12, height: 12, cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                    <Tag size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {inst.isFlagged && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e55353', flexShrink: 0 }} />
                    )}

                    {renaming?.type === 'instance' && renaming.templateId === template.id && renaming.instanceId === inst.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onBlur={commitRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        style={{ fontSize: 12, flex: 1, padding: '0 2px' }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs truncate"
                        style={{ color: isDuplicate ? '#e55353' : 'var(--text-secondary)' }}
                        onDoubleClick={e => { e.stopPropagation(); startRename('instance', template.id, inst.id, inst.name); }}
                      >
                        {inst.name}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Add instance row */}
              {isExp && (
                <div
                  className="flex items-center gap-1 pl-8 pr-2 py-1 cursor-pointer text-text-muted hover:text-text-primary"
                  onClick={e => { e.stopPropagation(); setNewName(''); setShowAddInstance(template.id); }}
                  style={{ fontSize: 11 }}
                >
                  <Plus size={11} /> Add instance
                </div>
              )}
            </div>
          );
        })}

        {/* Add Template inline row */}
        {!search && filter === 'all' && (
          <div
            className="flex items-center gap-1 px-2 py-1 cursor-pointer"
            style={{ fontSize: 12, color: 'var(--text-disabled)' }}
            onClick={() => { setNewName(''); setShowAddTemplate(true); }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-disabled)'}
          >
            <Plus size={13} /> Add Template
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.type === 'blank' ? (
            <>
              <div className="context-menu-item" onClick={() => { setNewName(''); setShowAddTemplate(true); setContextMenu(null); }}>
                <Plus size={14} /> Add New Template
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { setContextMenu(null); importTemplateRef.current?.click(); }}>
                <Upload size={14} /> Import Template
              </div>
              <div className="context-menu-item" onClick={exportTemplatesJSON} style={{ opacity: templates.length === 0 ? 0.4 : 1, pointerEvents: templates.length === 0 ? 'none' : 'auto' }}>
                <Download size={14} /> Export All Templates
              </div>
              {project?.engineering?.enableIgnitionMenuItems && (
                <>
                  <div className="context-menu-separator" />
                  <div className="context-menu-item" onClick={() => {
                    setIgnitionPath(project?.engineering?.folderPath || '');
                    setIgnitionFetch({ loading: false, error: null, udts: [] });
                    setSelectedUdts(new Set());
                    setIgnitionFilter('');
                    setShowImportIgnition(true);
                    setContextMenu(null);
                  }}>
                    <Download size={14} /> Import from Ignition
                  </div>
                </>
              )}
              {project?.studio5000?.enableMenuItems && (
                <>
                  <div className="context-menu-separator" />
                  <div
                    className="context-menu-item"
                    style={!project?.studio5000?.projectL5X ? { opacity: 0.45 } : {}}
                    onClick={() => {
                      const content = project?.studio5000?.projectL5X?.content;
                      if (!content) {
                        toast.error('No Studio 5000 project file set — configure it in Settings → Studio 5000');
                        setContextMenu(null);
                        return;
                      }
                      try {
                        const groups = parseProjectL5X(content);
                        if (!groups.length) {
                          toast.error('No AOI definitions found in the project file');
                          setContextMenu(null);
                          return;
                        }
                        const all = new Set();
                        for (const g of groups) g.instances.forEach(i => all.add(`${g.aoiName}::${i.name}`));
                        setS5kGroups(groups);
                        setS5kSelected(all);
                        setShowImportStudio5000(true);
                      } catch (err) {
                        toast.error('Failed to parse project file: ' + err.message);
                      }
                      setContextMenu(null);
                    }}
                  >
                    <FileCode size={14} /> Import from Studio 5000
                    {!project?.studio5000?.projectL5X && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(no file set)</span>
                    )}
                  </div>
                </>
              )}
              {project?.controlExpert?.enableMenuItems && (
                <>
                  <div className="context-menu-separator" />
                  <div
                    className="context-menu-item"
                    style={!project?.controlExpert?.projectXDBFile ? { opacity: 0.45 } : {}}
                    onClick={() => {
                      const xdbFile = project?.controlExpert?.projectXDBFile;
                      if (!xdbFile?.content) {
                        toast.error('No Control Expert XDB file set — configure it in Settings → Control Expert');
                        setContextMenu(null);
                        return;
                      }
                      try {
                        const parsed = parseXDB(xdbFile.content);
                        const group = {
                          fbTypeName: parsed.fbTypeName,
                          fbVersion: parsed.version,
                          parameters: parsed.parameters,
                          instances: [],
                        };
                        setCeGroups([group]);
                        setCeSelected(new Set());
                        setShowImportControlExpert(true);
                      } catch (err) {
                        toast.error('Failed to parse XDB file: ' + err.message);
                      }
                      setContextMenu(null);
                    }}
                  >
                    <FileCode size={14} /> Import from Control Expert
                    {!project?.controlExpert?.projectXDBFile && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(no file set)</span>
                    )}
                  </div>
                </>
              )}
            </>
          ) : contextMenu.type === 'template' ? (
            <>
              <div className="context-menu-item" onClick={() => { setNewName(''); setShowAddInstance(contextMenu.templateId); setContextMenu(null); }}>
                <Plus size={14} /> Add Instance
              </div>
              <div className="context-menu-item" onClick={() => {
                const t = templates.find(x => x.id === contextMenu.templateId);
                if (t) startRename('template', contextMenu.templateId, null, t.name);
              }}>
                <Edit2 size={14} /> Rename
              </div>
              <div className="context-menu-item" onClick={() => duplicateTemplate(contextMenu.templateId)}>
                <Copy size={14} /> Duplicate
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-submenu">
                <div className="context-menu-item">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Download size={14} /> Export</span>
                  <ChevronRight size={12} style={{ opacity: 0.6 }} />
                </div>
                <div className="context-menu-submenu-panel">
                  <div className="context-menu-item" onClick={() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    if (t) exportAttributesCSV(t);
                  }}>
                    <Download size={14} /> Export Attributes
                  </div>
                  <div className="context-menu-item" onClick={() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    if (t) exportInstancesCSV(t);
                  }}>
                    <Download size={14} /> Export Instances
                  </div>
                  {project?.engineering?.enableIgnitionMenuItems && (
                    <div className="context-menu-item" onClick={() => {
                      const t = templates.find(x => x.id === contextMenu.templateId);
                      if (t) uploadTemplateToIgnition(t);
                    }}>
                      <Upload size={14} /> Upload to Ignition
                    </div>
                  )}
                  {project?.studio5000?.enableMenuItems && (() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    const aoiConfig = project?.studio5000?.templateAOIs?.[contextMenu.templateId];
                    const hasInstances = (t?.instances?.length || 0) > 0;
                    return (
                      <div
                        className="context-menu-item"
                        style={{ opacity: (!aoiConfig || !hasInstances) ? 0.4 : 1, pointerEvents: (!aoiConfig || !hasInstances) ? 'none' : 'auto' }}
                        title={!aoiConfig ? 'Configure AOI file in Settings → Studio 5000' : !hasInstances ? 'No instances to export' : ''}
                        onClick={() => {
                          if (!t || !aoiConfig) return;
                          try {
                            downloadStudio5000Routine({ template: t, aoiConfig });
                            toast.success(`Exported ${t.name} routine (${t.instances?.length || 0} rungs)`);
                          } catch (err) {
                            toast.error('Export failed: ' + err.message);
                          }
                          setContextMenu(null);
                        }}
                      >
                        <Download size={14} /> Export to Studio 5000
                      </div>
                    );
                  })()}
                  {project?.controlExpert?.enableMenuItems && (() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    const fbConfig = project?.controlExpert?.templateFBs?.[contextMenu.templateId];
                    const hasInstances = (t?.instances?.length || 0) > 0;
                    return (
                      <div
                        className="context-menu-item"
                        style={{ opacity: (!fbConfig || !hasInstances) ? 0.4 : 1, pointerEvents: (!fbConfig || !hasInstances) ? 'none' : 'auto' }}
                        title={!fbConfig ? 'Configure XDB file in Settings → Control Expert' : !hasInstances ? 'No instances to export' : ''}
                        onClick={() => {
                          if (!t || !fbConfig) return;
                          try {
                            downloadXBD({ template: t, fbConfig, projectName: project?.name });
                            toast.success(`Exported ${t.name} (${t.instances?.length || 0} instances)`);
                          } catch (err) {
                            toast.error('Export failed: ' + err.message);
                          }
                          setContextMenu(null);
                        }}
                      >
                        <Download size={14} /> Export to Control Expert
                      </div>
                    );
                  })()}
                  {/* Profile data exports (run each configured profile format) */}
                  {(() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    const profiles = t?.profiles || [];
                    if (!profiles.length) return null;
                    return (
                      <>
                        <div className="context-menu-separator" />
                        {profiles.map((p, i) => (
                          <div
                            key={i}
                            className="context-menu-item"
                            onClick={() => {
                              const err = runProfileExport(p, t);
                              if (err) toast.error(err);
                              else toast.success(`Exported "${p.name}"`);
                              setContextMenu(null);
                            }}
                          >
                            <Download size={14} /> {p.name || `Profile ${i + 1}`}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                  {/* Export profile definitions as JSON (for re-importing into other templates) */}
                  {(() => {
                    const t = templates.find(x => x.id === contextMenu.templateId);
                    const profiles = t?.profiles || [];
                    const disabled = profiles.length === 0;
                    return (
                      <>
                        <div className="context-menu-separator" />
                        <div
                          className="context-menu-item"
                          style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${t.name}_profiles.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success(`Exported ${profiles.length} profile${profiles.length !== 1 ? 's' : ''} as JSON`);
                            setContextMenu(null);
                          }}
                        >
                          <Download size={14} /> Export Profiles (JSON)
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="context-menu-submenu">
                <div className="context-menu-item">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={14} /> Import</span>
                  <ChevronRight size={12} style={{ opacity: 0.6 }} />
                </div>
                <div className="context-menu-submenu-panel">
                  <div className="context-menu-item" onClick={() => { setImportAttributesModalTemplate(contextMenu.templateId); setContextMenu(null); }}>
                    <Upload size={14} /> Import Attributes
                  </div>
                  <div className="context-menu-item" onClick={() => { setImportModalTemplate(contextMenu.templateId); setContextMenu(null); }}>
                    <Upload size={14} /> Import Instances
                  </div>
                  <div className="context-menu-item" onClick={() => { setImportProfileModalTemplate(contextMenu.templateId); setContextMenu(null); }}>
                    <Upload size={14} /> Import Profile
                  </div>
                </div>
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={() => {
                const t = templates.find(x => x.id === contextMenu.templateId);
                setConfirmDelete({ type: 'template', templateId: contextMenu.templateId, name: t?.name });
                setContextMenu(null);
              }}>
                <Trash2 size={14} /> Delete Template
              </div>
            </>
          ) : (
            <>
              {(() => {
                const ctxInsts = getSelectedInstances(contextMenu.templateId, contextMenu.instanceId);
                const multi = ctxInsts.length > 1;
                return (
                  <>
                    {!multi && (
                      <>
                        <div className="context-menu-item" onClick={() => {
                          const t = templates.find(x => x.id === contextMenu.templateId);
                          const inst = t?.instances?.find(i => i.id === contextMenu.instanceId);
                          if (inst) startRename('instance', contextMenu.templateId, contextMenu.instanceId, inst.name);
                        }}>
                          <Edit2 size={14} /> Rename
                        </div>
                        <div className="context-menu-item" onClick={() => duplicateInstance(contextMenu.templateId, contextMenu.instanceId)}>
                          <Copy size={14} /> Duplicate
                        </div>
                        <div className="context-menu-item" onClick={() => toggleFlag(contextMenu.templateId, contextMenu.instanceId)}>
                          <Flag size={14} /> Toggle Flag
                        </div>
                        <div className="context-menu-separator" />
                      </>
                    )}
                    <div className="context-menu-submenu">
                      <div className="context-menu-item">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Upload size={14} /> Export{multi ? ` (${ctxInsts.length})` : ''}
                        </span>
                        <ChevronRight size={12} style={{ opacity: 0.6 }} />
                      </div>
                      <div className="context-menu-submenu-panel">
                        {project?.engineering?.enableIgnitionMenuItems && (
                          <div className="context-menu-item" onClick={() => exportInstancesToIgnition(ctxInsts)}>
                            <Upload size={14} /> Upload to Ignition
                          </div>
                        )}
                        <div className="context-menu-item" onClick={() => exportInstancesToJSON(ctxInsts)}>
                          <Download size={14} /> Export to JSON
                        </div>
                        {project?.studio5000?.enableMenuItems && (() => {
                          const t = templates.find(x => x.id === contextMenu.templateId);
                          const aoiConfig = project?.studio5000?.templateAOIs?.[contextMenu.templateId];
                          const disabled = !aoiConfig;
                          const partialTemplate = t ? { ...t, instances: ctxInsts.map(item => item.instance) } : null;
                          return (
                            <div
                              className="context-menu-item"
                              style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
                              title={disabled ? 'Configure AOI file in Settings → Studio 5000' : ''}
                              onClick={() => {
                                if (!partialTemplate || !aoiConfig) return;
                                try {
                                  downloadStudio5000Routine({ template: partialTemplate, aoiConfig });
                                  toast.success(`Exported ${ctxInsts.length} instance${ctxInsts.length !== 1 ? 's' : ''} to Studio 5000`);
                                } catch (err) {
                                  toast.error('Export failed: ' + err.message);
                                }
                                setContextMenu(null);
                              }}
                            >
                              <Download size={14} /> Export to Studio 5000
                            </div>
                          );
                        })()}
                        {project?.controlExpert?.enableMenuItems && (() => {
                          const t = templates.find(x => x.id === contextMenu.templateId);
                          const fbConfig = project?.controlExpert?.templateFBs?.[contextMenu.templateId];
                          const disabled = !fbConfig;
                          const partialTemplate = t ? { ...t, instances: ctxInsts.map(item => item.instance) } : null;
                          return (
                            <div
                              className="context-menu-item"
                              style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
                              title={disabled ? 'Configure XDB file in Settings → Control Expert' : ''}
                              onClick={() => {
                                if (!partialTemplate || !fbConfig) return;
                                try {
                                  downloadXBD({ template: partialTemplate, fbConfig, projectName: project?.name });
                                  toast.success(`Exported ${ctxInsts.length} instance${ctxInsts.length !== 1 ? 's' : ''} to Control Expert`);
                                } catch (err) {
                                  toast.error('Export failed: ' + err.message);
                                }
                                setContextMenu(null);
                              }}
                            >
                              <Download size={14} /> Export to Control Expert
                            </div>
                          );
                        })()}
                        {project?.siemens?.enableSiemensMenuItems && (() => {
                          const t = templates.find(x => x.id === contextMenu.templateId);
                          const fbMapping = project?.siemens?.templateFBs?.[contextMenu.templateId];
                          const bridgeUrl = project?.siemens?.bridgeUrl;
                          const disabled = !fbMapping || !bridgeUrl;
                          return (
                            <div
                              className="context-menu-item"
                              style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
                              title={disabled ? 'Configure FB mapping in Settings → Siemens' : ''}
                              onClick={async () => {
                                if (disabled) return;
                                setContextMenu(null);
                                const longDescAttr = (t?.attributes || []).find(a => a.name === 'LongDesc');
                                const dbAttr = (t?.attributes || []).find(a => a.name === 'DB');
                                const instances = ctxInsts.map(item => {
                                  const inst = item.instance;
                                  const la = longDescAttr ? (inst.attributes || []).find(a => a.id === longDescAttr.id) : null;
                                  const longDesc = (la?.value != null ? la.value : longDescAttr?.value) || '';
                                  const da = dbAttr ? (inst.attributes || []).find(a => a.id === dbAttr.id) : null;
                                  const dbVal = da?.value != null ? da.value : dbAttr?.value;
                                  const dbNumber = (dbVal != null && dbVal !== '') ? parseInt(dbVal, 10) : undefined;
                                  return { name: inst.name, longDesc, ...(dbNumber != null && !isNaN(dbNumber) ? { dbNumber } : {}) };
                                });
                                try {
                                  const result = await createTiaInstances({
                                    bridgeUrl,
                                    fbName: fbMapping.fbName,
                                    instances,
                                    ...(fbMapping.targetFolder ? { targetFolder: fbMapping.targetFolder } : {}),
                                    ...(fbMapping.fcName ? { fcName: fbMapping.fcName } : {}),
                                    ...(fbMapping.fcNumber != null ? { fcNumber: fbMapping.fcNumber } : {}),
                                    fcLanguage: fbMapping.fcLanguage ?? 'LAD',
                                    addReset: fbMapping.addReset !== false,
                                    tiaVersion: project?.siemens?.tiaVersion || 'V19',
                                  });
                                  if (result.skipped?.length) {
                                    toast.error(`${result.skipped.length} skipped: ${result.skipped[0]}`);
                                  }
                                  if (result.created?.length || result.fcCreated) {
                                    const dbMsg = result.created?.length ? `${result.created.length} instance DB${result.created.length !== 1 ? 's' : ''}` : '';
                                    const fcMsg = result.fcCreated ? `FC "${result.fcCreated}"` : '';
                                    toast.success(`Created ${[dbMsg, fcMsg].filter(Boolean).join(' + ')} in TIA Portal`);
                                  }
                                } catch (err) {
                                  toast.error('TIA export failed: ' + (err.response?.data?.error || err.message));
                                }
                              }}
                            >
                              <Upload size={14} /> Export to TIA Portal
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {multiSelected.size > 0 && (
                      <>
                        <div className="context-menu-separator" />
                        <div className="context-menu-item" onClick={() => { setMultiSelected(new Set()); setContextMenu(null); }}>
                          <Circle size={14} /> Clear Selection ({multiSelected.size})
                        </div>
                      </>
                    )}
                    <div className="context-menu-separator" />
                    <div className="context-menu-item danger" onClick={() => {
                      setConfirmDelete({ type: 'multi-instance', instances: ctxInsts, count: ctxInsts.length });
                      setContextMenu(null);
                    }}>
                      <Trash2 size={14} /> Delete {multi ? `${ctxInsts.length} Instances` : 'Instance'}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.type === 'template' ? 'Delete Template' : confirmDelete.count > 1 ? `Delete ${confirmDelete.count} Instances` : 'Delete Instance'}
          message={confirmDelete.type === 'template' ? `Delete "${confirmDelete.name}"? This cannot be undone.` : confirmDelete.count > 1 ? `Delete ${confirmDelete.count} selected instances? This cannot be undone.` : `Delete "${confirmDelete.instances?.[0]?.instance?.name}"? This cannot be undone.`}
          danger
          onConfirm={() => {
            if (confirmDelete.type === 'template') deleteTemplate(confirmDelete.templateId);
            else deleteMultipleInstances(confirmDelete.instances);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Add Template Modal */}
      {showAddTemplate && (
        <Modal
          title="Add Template"
          onClose={() => setShowAddTemplate(false)}
          width={380}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddTemplate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTemplate} disabled={!newName.trim()}>Add</button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Template Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Motor"
              onKeyDown={e => e.key === 'Enter' && addTemplate()}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Add Instance Modal */}
      {showAddInstance !== null && (
        <Modal
          title="Add Instance"
          onClose={() => setShowAddInstance(null)}
          width={380}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddInstance(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => addInstance(showAddInstance)} disabled={!newName.trim()}>Add</button>
            </>
          }
        >
          <div>
            <label className="block text-xs text-text-muted mb-1">Instance Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Motor_01"
              onKeyDown={e => e.key === 'Enter' && addInstance(showAddInstance)}
              autoFocus
            />
            {areas.length > 0 && (
              <p className="text-xs text-text-muted mt-2">Instance will be added to the first area</p>
            )}
          </div>
        </Modal>
      )}

      {/* Import Attributes Modal */}
      {importAttributesModalTemplate !== null && (
        <Modal
          title="Import Attributes from CSV"
          onClose={() => setImportAttributesModalTemplate(null)}
          width={440}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              CSV must have a header row with columns: Name, Description, DataType, Value, Parameter.
            </p>
            <div>
              <label className="block text-xs text-text-muted mb-2">Select CSV File</label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={e => handleImportAttributesCSV(importAttributesModalTemplate, e.target.files[0])}
                style={{ background: 'transparent', border: 'none', padding: 0 }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Import Instances Modal */}
      {importModalTemplate !== null && (
        <Modal
          title="Import Instances from CSV"
          onClose={() => setImportModalTemplate(null)}
          width={440}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              CSV must have a header row. Column "Name" maps to instance name. Other columns match attribute names.
            </p>
            <div>
              <label className="block text-xs text-text-muted mb-2">Select CSV File</label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={e => handleImportCSV(importModalTemplate, e.target.files[0])}
                style={{ background: 'transparent', border: 'none', padding: 0 }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Import Profile Modal */}
      {importProfileModalTemplate !== null && (() => {
        const tmpl = templates.find(t => t.id === importProfileModalTemplate);
        const existingProfiles = tmpl?.profiles || [];
        return (
          <Modal
            title="Import Profile"
            onClose={() => setImportProfileModalTemplate(null)}
            width={480}
          >
            <div className="flex flex-col gap-4">
              {existingProfiles.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2">Profiles already on this template:</p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: 140, overflowY: 'auto' }}>
                    {existingProfiles.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderBottom: i < existingProfiles.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <Download size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span className="text-sm text-text-primary">{p.name || `Profile ${i + 1}`}</span>
                        {p.description && <span className="text-xs text-text-muted truncate">{p.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-text-secondary mb-3">
                  Select a profile JSON file exported from another template. The profile(s) will be added to <strong style={{ color: 'var(--text-primary)' }}>{tmpl?.name}</strong>.
                </p>
                <label className="block text-xs text-text-muted mb-2">Select Profile JSON File</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={e => {
                    handleImportProfileJSON(importProfileModalTemplate, e.target.files[0]);
                    setImportProfileModalTemplate(null);
                  }}
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                />
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Import from Studio 5000 Modal */}
      {showImportStudio5000 && (
        <Modal
          title="Import from Studio 5000"
          onClose={() => setShowImportStudio5000(false)}
          width={500}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => {
                const all = new Set();
                for (const g of s5kGroups) g.instances.forEach(i => all.add(`${g.aoiName}::${i.name}`));
                setS5kSelected(all);
              }}>All</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setS5kSelected(new Set())}>None</button>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>
                {s5kSelected.size} of {s5kGroups.reduce((n, g) => n + g.instances.length, 0)} selected
              </span>
              <button className="btn btn-secondary" onClick={() => setShowImportStudio5000(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={s5kSelected.size === 0}
                onClick={() => {
                  const now = new Date().toISOString();
                  const toImport = new Map();
                  for (const group of s5kGroups) {
                    const sel = group.instances.filter(i => s5kSelected.has(`${group.aoiName}::${i.name}`));
                    if (sel.length) toImport.set(group.aoiName, sel.map(i => i.name));
                  }
                  if (!toImport.size) return;
                  updateProject(p => {
                    const tmpls = [...(p.templates || [])];
                    let maxTplId = tmpls.length ? Math.max(...tmpls.map(t => t.id)) : 0;
                    for (const [aoiName, instNames] of toImport) {
                      let tpl = tmpls.find(t => t.name === aoiName);
                      if (!tpl) {
                        maxTplId++;
                        // Build template attributes from AOI Input/Output parameters
                        const group = s5kGroups.find(g => g.aoiName === aoiName);
                        const attrs = (group?.parameters || []).map((param, idx) => ({
                          id: idx + 1,
                          name: param.name,
                          description: param.usage || '',
                          dataType: mapL5XDataType(param.dataType),
                          value: '',
                          parameter: false,
                          lastModification: now,
                        }));
                        tpl = { id: maxTplId, name: aoiName, description: '', color: '#3b82f6', attributes: attrs, instances: [], profiles: [], lastModification: now };
                        tmpls.push(tpl);
                      }
                      const existingNames = new Set(tpl.instances.map(i => i.name));
                      let maxInstId = tpl.instances.length ? Math.max(...tpl.instances.map(i => i.id)) : 0;
                      for (const name of instNames) {
                        if (!existingNames.has(name)) {
                          maxInstId++;
                          tpl.instances.push({ id: maxInstId, name, attributes: [], lastModification: now });
                        }
                      }
                    }
                    return { ...p, templates: tmpls };
                  });
                  const total = [...toImport.values()].reduce((s, arr) => s + arr.length, 0);
                  toast.success(`Imported ${total} instance${total !== 1 ? 's' : ''} from Studio 5000`);
                  setShowImportStudio5000(false);
                  setS5kSelected(new Set());
                }}
              >
                <Download size={13} /> Import
              </button>
            </div>
          }
        >
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {s5kGroups.map((group, i) => (
              <S5kGroupRow key={i} group={group} s5kSelected={s5kSelected} setS5kSelected={setS5kSelected} />
            ))}
          </div>
        </Modal>
      )}

      {/* Import from Control Expert Modal */}
      {showImportControlExpert && (
        <Modal
          title="Import from Control Expert"
          onClose={() => setShowImportControlExpert(false)}
          width={520}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <button className="btn btn-secondary" onClick={() => setShowImportControlExpert(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!ceGroups[0] || ceGroups[0].instances.length === 0 || ceSelected.size === 0}
                onClick={() => {
                  const group = ceGroups[0];
                  if (!group) return;
                  const now = new Date().toISOString();
                  const selNames = group.instances.filter(n => ceSelected.has(`${group.fbTypeName}::${n}`));
                  if (!selNames.length) return;
                  updateProject(p => {
                    const tmpls = [...(p.templates || [])];
                    let maxTplId = tmpls.length ? Math.max(...tmpls.map(t => t.id)) : 0;
                    let tpl = tmpls.find(t => t.name === group.fbTypeName);
                    if (!tpl) {
                      maxTplId++;
                      const attrs = (group.parameters || []).map((param, idx) => ({
                        id: idx + 1,
                        name: param.name,
                        description: param.usage || '',
                        dataType: mapCEDataType(param.typeName),
                        value: '',
                        parameter: false,
                        lastModification: now,
                      }));
                      tpl = { id: maxTplId, name: group.fbTypeName, description: '', attributes: attrs, instances: [], profiles: [], lastModification: now };
                      tmpls.push(tpl);
                    }
                    const existingNames = new Set(tpl.instances.map(i => i.name));
                    let maxInstId = tpl.instances.length ? Math.max(...tpl.instances.map(i => i.id)) : 0;
                    for (const name of selNames) {
                      if (!existingNames.has(name)) {
                        maxInstId++;
                        tpl.instances.push({ id: maxInstId, name, attributes: [], lastModification: now });
                      }
                    }
                    return { ...p, templates: tmpls };
                  });
                  toast.success(`Imported ${selNames.length} instance${selNames.length !== 1 ? 's' : ''} from Control Expert`);
                  setShowImportControlExpert(false);
                  setCeSelected(new Set());
                }}
              >
                <Download size={13} /> Import
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {ceGroups[0] && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 5 }}>
                FB Type: <strong style={{ color: 'var(--text-primary)' }}>{ceGroups[0].fbTypeName}</strong>
                {' '}· {ceGroups[0].parameters?.length || 0} parameters
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                Instance Names
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Enter the names of the instances to import, one per line. These become instance names in the template.
              </div>
              <textarea
                rows={6}
                placeholder="PUMP_01&#10;PUMP_02&#10;PUMP_03"
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                onChange={e => {
                  const names = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                  const fbTypeName = ceGroups[0]?.fbTypeName || '';
                  setCeGroups(prev => prev.map((g, i) => i === 0 ? { ...g, instances: names } : g));
                  setCeSelected(new Set(names.map(n => `${fbTypeName}::${n}`)));
                }}
              />
              {ceGroups[0]?.instances?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {ceGroups[0].instances.length} instance{ceGroups[0].instances.length !== 1 ? 's' : ''} ready to import
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Import from Ignition Modal */}
      {showImportIgnition && (
        <Modal
          title="Import from Ignition"
          onClose={() => setShowImportIgnition(false)}
          width={520}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowImportIgnition(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleImportIgnitionUdts}
                disabled={selectedUdts.size === 0 || ignitionFetch.loading}
              >
                Import Selected ({selectedUdts.size})
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1">Tag Folder Path (optional)</label>
                <input
                  type="text"
                  value={ignitionPath}
                  onChange={e => setIgnitionPath(e.target.value)}
                  placeholder="e.g. Devices or leave blank for root"
                  onKeyDown={e => e.key === 'Enter' && handleFetchFromIgnition()}
                />
              </div>
              <div style={{ paddingTop: 18 }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleFetchFromIgnition}
                  disabled={ignitionFetch.loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {ignitionFetch.loading ? 'Fetching…' : 'Fetch UDTs'}
                </button>
              </div>
            </div>

            {ignitionFetch.error && (
              <div style={{ color: '#e55353', fontSize: 12, padding: '6px 10px', background: 'rgba(229,83,83,0.1)', borderRadius: 4 }}>
                {ignitionFetch.error}
              </div>
            )}

            {!ignitionFetch.loading && !ignitionFetch.error && ignitionFetch.udts.length === 0 && (
              <div className="text-text-muted text-xs text-center py-4">
                {ignitionFetch.udts.length === 0 && !ignitionFetch.error
                  ? 'Click "Fetch UDTs" to discover UDT types from Ignition.'
                  : 'No UDT types found at the specified path.'}
              </div>
            )}

            {ignitionFetch.udts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-muted">
                    Found {ignitionFetch.udts.length} UDT type(s) — select to import:
                  </label>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => setSelectedUdts(new Set(ignitionFetch.udts.map(r => `${r.folderPath}/${r.udtType.name}`)))}
                    >
                      All
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => setSelectedUdts(new Set())}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="relative mb-1">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={ignitionFilter}
                    onChange={e => setIgnitionFilter(e.target.value)}
                    placeholder="Filter by name or folder…"
                    style={{ paddingLeft: 24, fontSize: 12, padding: '4px 4px 4px 24px' }}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                  {ignitionFetch.udts.filter(r => {
                    if (!ignitionFilter.trim()) return true;
                    const q = ignitionFilter.toLowerCase();
                    return r.udtType.name.toLowerCase().includes(q) || r.folderPath.toLowerCase().includes(q);
                  }).map(r => {
                    const name = r.udtType.name;
                    const udtKey = `${r.folderPath}/${name}`;
                    const paramCount = Object.keys(r.udtType.parameters || {}).length;
                    const tagCount = (r.udtType.tags || []).length;
                    const instCount = r.siblingInstances.length;
                    const checked = selectedUdts.has(udtKey);
                    return (
                      <label
                        key={udtKey}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border-subtle)',
                          background: checked ? 'var(--bg-hover)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            setSelectedUdts(prev => {
                              const s = new Set(prev);
                              if (e.target.checked) s.add(udtKey); else s.delete(udtKey);
                              return s;
                            });
                          }}
                          style={{ flexShrink: 0 }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-text-primary text-sm truncate">{name}</div>
                          <div className="text-text-muted" style={{ fontSize: 11 }}>
                            {r.folderPath && <span className="font-mono" style={{ marginRight: 6 }}>{r.folderPath}/</span>}
                            {paramCount} parameter{paramCount !== 1 ? 's' : ''} · {tagCount} tag{tagCount !== 1 ? 's' : ''} · {instCount} instance{instCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
