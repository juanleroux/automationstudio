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
  'float4': 8, 'float': 8, 'float8': 8, 'double': 8,
  'string': 9,
};

function internalDataType(ignType) {
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
  (template.attributes || []).forEach(attr => {
    const dt = ignitionDataType(attr.dataType);
    if (attr.parameter) {
      udtType.parameters[attr.name] = { dataType: dt, value: attr.value ?? '' };
    } else {
      udtType.tags.push({ name: attr.name, tagType: 'AtomicTag', dataType: dt, value: attr.value ?? '' });
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
function extractDoc(doc) {
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

  (udtType.tags || []).filter(t => t.tagType === 'AtomicTag' || !t.tagType).forEach(tag => {
    attributes.push({
      id: attrId++, name: tag.name, description: extractDoc(tag.documentation),
      dataType: internalDataType(tag.dataType),
      value: String(tag.value ?? ''),
      parameter: false,
    });
  });

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
