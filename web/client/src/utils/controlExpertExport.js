// ── Helpers ───────────────────────────────────────────────────────────────────

// Data type values must match DataTypeSelect.jsx: 0=None,1=Bool,2=Int8,3=Int16,
// 4=Int32,5=UInt8,6=UInt16,7=UInt32,8=Float,9=String,10=Int4
export function mapCEDataType(ceType) {
  switch ((ceType || '').toUpperCase()) {
    case 'BOOL':   return 1;
    case 'SINT':   return 2;
    case 'INT':    return 3;
    case 'DINT':   return 4;
    case 'LINT':   return 4;
    case 'USINT':  return 5;
    case 'UINT':   return 6;
    case 'UDINT':  return 7;
    case 'ULINT':  return 7;
    case 'REAL':   return 8;
    case 'LREAL':  return 8;
    case 'STRING': return 9;
    case 'WORD':   return 6;
    case 'DWORD':  return 7;
    case 'BYTE':   return 5;
    default:       return 9;
  }
}

// ── XDB parser ────────────────────────────────────────────────────────────────
// Parses a Schneider Control Expert Derived Function Block definition (.XDB)
// Returns { fbTypeName, version, parameters: [{name, typeName, usage}] }
export function parseXDB(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const fbSource = doc.querySelector('FBSource');
  if (!fbSource) throw new Error('No FBSource element found in XDB file');

  const fbTypeName = fbSource.getAttribute('nameOfFBType') || 'UnknownFB';
  const version = fbSource.getAttribute('version') || '1.0';

  const parameters = [];

  const addVars = (selector, usage) => {
    const container = fbSource.querySelector(selector);
    if (!container) return;
    [...container.querySelectorAll('variables')].forEach(v => {
      parameters.push({
        name: v.getAttribute('name') || '',
        typeName: v.getAttribute('typeName') || 'BOOL',
        usage,
      });
    });
  };

  addVars('inputParameters', 'Input');
  addVars('inOutParameters', 'InOut');
  addVars('outputParameters', 'Output');

  return { fbTypeName, version, parameters };
}

// ── XBD generator ─────────────────────────────────────────────────────────────
// Generates a Control Expert variable instance export file (.XBD) for a
// template with multiple instances of a single FB type.
export function generateXBD({ fbTypeName, fbVersion = '1.0', instanceNames, projectName = 'Export' }) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateTimeStr = `date_and_time#${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const instancesXml = instanceNames
    .map(name => `    <FBInstance nameOfInstance="${name}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<FBExchangeFile>
\t<fileHeader company="Schneider Automation" product="Control Expert" dateTime="${dateTimeStr}" content="Variables exchange file" DTDVersion="41"></fileHeader>
\t<contentHeader name="${projectName}" version="0.0.1" dateTime="${dateTimeStr}"></contentHeader>
\t<FBInstances nameOfFBType="${fbTypeName}" version="${fbVersion}">
${instancesXml}
\t</FBInstances>
</FBExchangeFile>`;
}

export function downloadXBD({ template, fbConfig, projectName }) {
  const instanceNames = (template.instances || []).map(i => i.name);
  if (!instanceNames.length) return;
  const xml = generateXBD({
    fbTypeName: fbConfig.fbTypeName,
    fbVersion: fbConfig.fbVersion || '1.0',
    instanceNames,
    projectName: projectName || template.name,
  });
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.name.replace(/[^a-zA-Z0-9_]/g, '_')}_Instances.XBD`;
  a.click();
  URL.revokeObjectURL(url);
}
