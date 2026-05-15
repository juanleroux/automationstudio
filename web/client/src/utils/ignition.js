// Maps our internal numeric dataType to Ignition string data type names
const DATA_TYPE_MAP = {
  0: 'String',
  1: 'Boolean',
  2: 'Byte',
  3: 'Short',
  4: 'Integer',
  5: 'Byte',
  6: 'Short',
  7: 'Integer',
  8: 'Float',
  9: 'String',
  10: 'Integer',
};

function ignitionDataType(val) {
  return DATA_TYPE_MAP[Number(val)] || 'String';
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
 * Builds the Ignition Tag CI/CD import payload for a template.
 * Returns the native Ignition tag export format:
 *   { version, tagGroup, tags: [ Folder containing UdtType + instances ] }
 */
export function buildIgnitionPayload(template, folderPath) {
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

  const tags = folderPath
    ? [{ name: folderPath, tagType: 'Folder', tags: [udtType, ...instances] }]
    : [udtType, ...instances];

  // Native Ignition tag export format (same structure the gateway exports)
  return { version: '8.1.0', tagGroup: 'default', tags };
}
