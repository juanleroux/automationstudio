// Maps our internal numeric dataType to Ignition DataType enum names
const DATA_TYPE_MAP = {
  0: 'String', 1: 'Boolean', 2: 'Int1', 3: 'Int2', 4: 'Int4',
  5: 'Int1', 6: 'Int2', 7: 'Int4', 8: 'Float4', 9: 'String', 10: 'Int4',
};

function ignitionDataType(val) {
  return DATA_TYPE_MAP[Number(val)] || 'String';
}

// Reverse map: Ignition DataType enum → our numeric dataType
const IGNITION_TYPE_MAP = {
  'boolean': 1, 'bool': 1,
  'int1': 2, 'byte': 2,
  'int2': 3, 'short': 3, 'int16': 3,
  'int4': 4, 'integer': 4, 'int': 4, 'int32': 4,
  'int8': 4,
  'uint8': 5,
  'uint16': 6,
  'uint32': 7,
  'float4': 8, 'float': 8, 'float8': 8, 'double': 8, 'real': 8,
  'string': 9,
  'dataset': 11,
};

export function internalDataType(ignType) {
  return IGNITION_TYPE_MAP[(ignType || '').toLowerCase()] ?? 9;
}

// Resolve an instance's areaId to a slash-separated folder path using the areas list.
// Exported so callers can resolve paths for grouping before upload.
export function buildAreaPath(areaId, areas) {
  if (!areaId || areaId === 0) return '';
  const area = (areas || []).find(a => a.id === areaId);
  if (!area) return '';
  const parentPath = area.parentId != null ? buildAreaPath(area.parentId, areas) : '';
  return parentPath ? `${parentPath}/${area.name}` : area.name;
}

function buildUdtType(template) {
  const udtType = {
    name: template.name,
    tagType: 'UdtType',
    parameters: {},
    tags: [],
  };
  const folderItems = (template.attributes || []).filter(a => a.folder);

  // Recursively find or create a Folder tag for the given folder item id,
  // building nested containers as needed.
  function getOrCreateFolderTag(folderId) {
    const folderItem = folderItems.find(f => f.id === folderId);
    if (!folderItem) return null;
    const parentContainer = folderItem.parentFolderId != null
      ? (getOrCreateFolderTag(folderItem.parentFolderId) || udtType)
      : udtType;
    let ft = parentContainer.tags.find(t => t.tagType === 'Folder' && t.name === folderItem.name);
    if (!ft) {
      ft = { name: folderItem.name, tagType: 'Folder', tags: [] };
      parentContainer.tags.push(ft);
    }
    return ft;
  }

  (template.attributes || []).forEach(attr => {
    if (attr.folder) return;
    const dt = ignitionDataType(attr.dataType);
    if (attr.parameter) {
      const p = { dataType: dt, value: attr.value ?? '' };
      if (attr.description) p.documentation = attr.description;
      udtType.parameters[attr.name] = p;
    } else if (attr.folderId != null) {
      const folderTag = getOrCreateFolderTag(attr.folderId) || udtType;
      const tag = { name: attr.name, tagType: 'AtomicTag', dataType: dt, value: attr.value ?? '' };
      if (attr.description) tag.documentation = attr.description;
      folderTag.tags.push(tag);
    } else {
      const tag = { name: attr.name, tagType: 'AtomicTag', dataType: dt, value: attr.value ?? '' };
      if (attr.description) tag.documentation = attr.description;
      udtType.tags.push(tag);
    }
  });
  return udtType;
}

/**
 * Builds the Ignition tag import payload for a template.
 * instances: optional subset of template.instances to include (e.g. only unassigned ones).
 * Returns { tags: [...] } — the body expected by POST /data/api/v1/tags/import.
 */
export function buildIgnitionPayload(template, instances = null) {
  const udtType = buildUdtType(template);
  const insts = instances ?? template.instances ?? [];

  const instanceTags = insts.map(inst => {
    const overrides = {};
    (inst.attributes || []).forEach(ia => {
      const ta = (template.attributes || []).find(a => a.id === ia.id);
      if (ta?.parameter) {
        overrides[ta.name] = { dataType: ignitionDataType(ta.dataType), value: ia.value ?? '' };
      }
    });
    return { name: inst.name, tagType: 'UdtInstance', typeId: template.name, parameters: overrides };
  });

  return {
    tags: [
      { name: '_types_', tagType: 'Folder', tags: [udtType] },
      ...instanceTags,
    ],
  };
}

/**
 * Builds the Ignition import payload for a flat list of UDT instances.
 * instanceList: [{ template, instance }]
 * All instances must share the same target folder — callers group by area first.
 * Returns { tags: [...UdtInstances] } — no _types_ wrapper needed.
 */
export function buildInstancesPayload(instanceList) {
  const tags = instanceList.map(({ template, instance }) => {
    const overrides = {};
    (instance.attributes || []).forEach(ia => {
      const ta = (template.attributes || []).find(a => a.id === ia.id);
      if (ta?.parameter) {
        overrides[ta.name] = { dataType: ignitionDataType(ta.dataType), value: ia.value ?? '' };
      }
    });
    return { name: instance.name, tagType: 'UdtInstance', typeId: template.name, parameters: overrides };
  });
  return { tags };
}

/**
 * Recursively walk Ignition tag trees and collect UdtType entries together
 * with any UdtInstance siblings that reference them.
 */
function collectUdtTypes(tags, bucket = [], currentPath = '') {
  if (!Array.isArray(tags)) return bucket;
  const udtTypes  = tags.filter(t => t.tagType === 'UdtType');
  const instances = tags.filter(t => t.tagType === 'UdtInstance');
  udtTypes.forEach(udt => {
    const siblings = instances.filter(i =>
      i.typeId === udt.name || (i.typeId || '').endsWith('/' + udt.name)
    );
    bucket.push({ udtType: udt, siblingInstances: siblings, folderPath: currentPath });
  });
  tags.filter(t => t.tagType === 'Folder').forEach(f => {
    const childPath = currentPath ? `${currentPath}/${f.name}` : f.name;
    collectUdtTypes(f.tags || [], bucket, childPath);
  });
  return bucket;
}

/**
 * Convert one Ignition UdtType (+ its sibling instances) to our template format.
 */
// Ignition's documentation field is a string or { value: "..." }
export function extractDoc(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (typeof doc === 'object' && doc.value != null) return String(doc.value);
  return '';
}

function convertUdt(udtType, siblingInstances, templateId, folderPath) {
  const now = new Date().toISOString();
  let attrId = 1;
  const attributes = [];
  const cleanPath = (folderPath || '').replace(/^_types_\/?/i, '');
  const templateName = cleanPath ? `${cleanPath}/${udtType.name}` : udtType.name;

  Object.entries(udtType.parameters || {}).forEach(([name, param]) => {
    attributes.push({
      id: attrId++, name, description: extractDoc(param.documentation),
      dataType: internalDataType(param.dataType),
      value: String(param.value ?? ''),
      parameter: true,
    });
  });

  function addTags(tagList, folderId) {
    for (const tag of (tagList || [])) {
      if (tag.tagType === 'Folder') {
        const folder = { id: attrId++, folder: true, name: tag.name };
        if (folderId != null) folder.parentFolderId = folderId;
        attributes.push(folder);
        addTags(tag.tags || [], folder.id);
      } else if (tag.tagType === 'AtomicTag' || !tag.tagType) {
        const attr = {
          id: attrId++, name: tag.name, description: extractDoc(tag.documentation),
          dataType: internalDataType(tag.dataType),
          value: String(tag.value ?? ''),
          parameter: false,
        };
        if (folderId != null) attr.folderId = folderId;
        attributes.push(attr);
      }
    }
  }
  addTags(udtType.tags || [], null);

  let instId = 1;
  const instances = siblingInstances.map(inst => {
    const instAttrs = [];
    Object.entries(inst.parameters || {}).forEach(([paramName, paramVal]) => {
      const ta = attributes.find(a => a.name === paramName && a.parameter);
      if (ta) instAttrs.push({ id: ta.id, value: String(paramVal?.value ?? '') });
    });
    return { id: instId++, areaId: 0, name: inst.name, description: extractDoc(inst.documentation), isFlagged: false, lastModification: now, attributes: instAttrs };
  });

  return { id: templateId, name: templateName, description: extractDoc(udtType.documentation), lastModification: now, attributes, instances, profiles: [] };
}

/**
 * Parse the raw Ignition gateway response and return discovered UDT info.
 */
export function parseIgnitionResponse(rawData) {
  const tags = Array.isArray(rawData) ? rawData : (rawData?.tags || []);
  return collectUdtTypes(tags);
}

/**
 * Convert an array of { udtType, siblingInstances } results to template objects.
 */
export function convertUdtsToTemplates(udtResults, startId) {
  return udtResults.map(({ udtType, siblingInstances, folderPath }, i) =>
    convertUdt(udtType, siblingInstances, startId + i, folderPath)
  );
}

/**
 * Walk an Ignition tag tree and return { tag, folderPath } for every UDT instance
 * whose name is in nameSet and whose typeId matches templateName.
 */
export function findUdtInstancesWithPath(tags, nameSet, templateName, basePath = '') {
  const results = [];
  function walk(tagList, currentPath) {
    for (const tag of (tagList || [])) {
      if (
        tag.tagType === 'UdtInstance' &&
        nameSet.has(tag.name) &&
        (tag.typeId === templateName || (tag.typeId || '').endsWith('/' + templateName))
      ) {
        results.push({ tag, folderPath: currentPath });
      }
      if (tag.tags?.length) {
        const childPath = tag.tagType === 'Folder'
          ? (currentPath ? `${currentPath}/${tag.name}` : tag.name)
          : currentPath;
        walk(tag.tags, childPath);
      }
    }
  }
  walk(Array.isArray(tags) ? tags : (tags?.tags || []), basePath);
  return results;
}

/**
 * Resolve a full Ignition folder path back to a local areaId.
 * Strips the configured base prefix, then walks project.areas by name.
 * Returns 0 (unassigned) if the path cannot be resolved.
 */
export function resolveIgnitionPathToAreaId(fullIgnPath, base, areas) {
  let subPath = (fullIgnPath === '(unassigned)' ? '' : fullIgnPath) || '';
  if (base && subPath === base) subPath = '';
  else if (base && subPath.startsWith(base + '/')) subPath = subPath.slice(base.length + 1);
  if (!subPath) return 0;
  const parts = subPath.split('/');
  let parentId = null;
  let areaId = 0;
  for (const name of parts) {
    const area = (areas || []).find(a => a.name === name && a.parentId === parentId);
    if (!area) return 0;
    areaId = area.id;
    parentId = area.id;
  }
  return areaId;
}

/**
 * Like resolveIgnitionPathToAreaId but auto-creates missing area nodes.
 * Returns { areaId, areas } where areas may include newly created entries.
 */
export function resolveOrCreateAreaPath(fullIgnPath, base, areas) {
  let subPath = (fullIgnPath === '(unassigned)' ? '' : fullIgnPath) || '';
  if (base && subPath === base) subPath = '';
  else if (base && subPath.startsWith(base + '/')) subPath = subPath.slice(base.length + 1);
  if (!subPath) return { areaId: 0, areas };
  const parts = subPath.split('/');
  let currentAreas = [...(areas || [])];
  let parentId = null;
  let areaId = 0;
  for (const name of parts) {
    const existing = currentAreas.find(a => a.name === name && a.parentId === parentId);
    if (existing) {
      areaId = existing.id;
      parentId = existing.id;
    } else {
      const newId = currentAreas.length > 0 ? Math.max(...currentAreas.map(a => a.id)) + 1 : 1;
      currentAreas = [...currentAreas, { id: newId, name, parentId }];
      areaId = newId;
      parentId = newId;
    }
  }
  return { areaId, areas: currentAreas };
}
