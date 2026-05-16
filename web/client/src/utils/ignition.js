// Maps our internal numeric dataType to Ignition string data type names
const DATA_TYPE_MAP = {
  0: 'String', 1: 'Boolean', 2: 'Byte', 3: 'Short', 4: 'Integer',
  5: 'Byte', 6: 'Short', 7: 'Integer', 8: 'Float', 9: 'String', 10: 'Integer',
};

function ignitionDataType(val) {
  return DATA_TYPE_MAP[Number(val)] || 'String';
}

// Reverse map: Ignition string type → our numeric dataType
const IGNITION_TYPE_MAP = {
  'boolean': 1, 'bool': 1,
  'byte': 2,
  'short': 3, 'int16': 3,
  'integer': 4, 'int': 4, 'int32': 4,
  'uint8': 5, 'int8': 2,
  'uint16': 6,
  'uint32': 7,
  'float': 8, 'float4': 8, 'float8': 8, 'double': 8,
  'string': 9,
  'int4': 10,
};

function internalDataType(ignType) {
  return IGNITION_TYPE_MAP[(ignType || '').toLowerCase()] ?? 9;
}

/**
 * Builds an Ignition UDT type tag object for the given template.
 */
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
 * UDT type definitions must reside under the _types_ folder; instances go
 * at the root (or under the folder path supplied as a query param).
 * Returns { tags: [...] } — the body expected by POST /data/api/v1/tags/import.
 */
export function buildIgnitionPayload(template) {
  const udtType = buildUdtType(template);

  const instances = (template.instances || []).map(inst => {
    const overrides = {};
    (inst.attributes || []).forEach(ia => {
      const ta = (template.attributes || []).find(a => a.id === ia.id);
      if (ta?.parameter) {
        overrides[ta.name] = { dataType: ignitionDataType(ta.dataType), value: ia.value ?? '' };
      }
    });
    return {
      name: inst.name,
      tagType: 'UdtInstance',
      typeId: template.name,
      parameters: overrides,
    };
  });

  return {
    tags: [
      { name: '_types_', tagType: 'Folder', tags: [udtType] },
      ...instances,
    ],
  };
}

// ─── Import: Ignition → Templates ───────────────────────────────────────────

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
function convertUdt(udtType, siblingInstances, templateId) {
  const now = new Date().toISOString();
  let attrId = 1;
  const attributes = [];

  // Parameters → parameter: true attributes
  Object.entries(udtType.parameters || {}).forEach(([name, param]) => {
    attributes.push({
      id: attrId++, name, description: '',
      dataType: internalDataType(param.dataType),
      value: String(param.value ?? ''),
      parameter: true,
    });
  });

  // AtomicTag children → parameter: false attributes
  (udtType.tags || []).filter(t => t.tagType === 'AtomicTag' || !t.tagType).forEach(tag => {
    attributes.push({
      id: attrId++, name: tag.name, description: '',
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
    return { id: instId++, areaId: 0, name: inst.name, description: '', isFlagged: false, lastModification: now, attributes: instAttrs };
  });

  return { id: templateId, name: udtType.name, description: '', lastModification: now, attributes, instances, profiles: [] };
}

/**
 * Parse the raw Ignition gateway response and return discovered UDT info.
 * Each item: { udtType, siblingInstances }
 */
export function parseIgnitionResponse(rawData) {
  // rawData may be { version, tagGroup, tags } or a bare array
  const tags = Array.isArray(rawData) ? rawData : (rawData?.tags || []);
  return collectUdtTypes(tags);
}

/**
 * Convert an array of { udtType, siblingInstances } results to template objects.
 * startId: next available template id.
 */
export function convertUdtsToTemplates(udtResults, startId) {
  return udtResults.map(({ udtType, siblingInstances }, i) =>
    convertUdt(udtType, siblingInstances, startId + i)
  );
}
