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

// Extract raw <FBSource ...>...</FBSource> XML block as a string.
function extractFBSourceXml(xmlContent) {
  const startIdx = xmlContent.indexOf('<FBSource ');
  if (startIdx === -1) return '';
  const endTag = '</FBSource>';
  const endIdx = xmlContent.lastIndexOf(endTag);
  if (endIdx === -1) return '';
  return xmlContent.slice(startIdx, endIdx + endTag.length);
}

// ── XDB parser ────────────────────────────────────────────────────────────────
// Parses a Schneider Control Expert Derived Function Block definition (.XDB).
// Returns { fbTypeName, version, parameters: [{name, typeName, usage}], fbSourceXml }
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

  const fbSourceXml = extractFBSourceXml(xmlContent);

  return { fbTypeName, version, parameters, fbSourceXml };
}

// ── XBD generator ─────────────────────────────────────────────────────────────
// Generates a Schneider Control Expert FBD section export (.XBD) containing
// one FFBBlock per instance, a dataBlock with all wired parameter variables,
// and the full FBSource definition.
export function generateXBD({ fbTypeName, fbVersion = '1.0', fbSourceXml = '', instanceNames, parameters, projectName = 'Export', sectionName }) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dtStr = `date_and_time#${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const inputParams  = parameters.filter(p => p.usage === 'Input');
  const inOutParams  = parameters.filter(p => p.usage === 'InOut');
  const outputParams = parameters.filter(p => p.usage === 'Output');

  // Block dimensions — height matches the longer pin list plus padding
  const blockWidth  = 10;
  const blockHeight = Math.max(inputParams.length + inOutParams.length + 2, outputParams.length + inOutParams.length + 2) + 4;
  const startPosX   = 21;
  const posY        = 6;
  const stepX       = 36; // width(10) + gap(26)

  // ── FFBBlocks ─────────────────────────────────────────────────────────────
  const ffbBlocks = instanceNames.map((instName, idx) => {
    const posX = startPosX + idx * stepX;

    const inVars = [
      `\t\t\t\t\t<inputVariable invertedPin="false" formalParameter="EN"></inputVariable>`,
      ...inputParams.map(p =>
        `\t\t\t\t\t<inputVariable invertedPin="false" formalParameter="${p.name}" effectiveParameter="${instName}_${p.name}"></inputVariable>`),
      ...inOutParams.map(p =>
        `\t\t\t\t\t<inputVariable invertedPin="false" formalParameter="${p.name}" effectiveParameter="${instName}_${p.name}"></inputVariable>`),
    ].join('\n');

    const outVars = [
      `\t\t\t\t\t<outputVariable invertedPin="false" formalParameter="ENO"></outputVariable>`,
      ...inOutParams.map(p =>
        `\t\t\t\t\t<outputVariable invertedPin="false" formalParameter="${p.name}" effectiveParameter="${instName}_${p.name}"></outputVariable>`),
      ...outputParams.map(p =>
        `\t\t\t\t\t<outputVariable invertedPin="false" formalParameter="${p.name}" effectiveParameter="${instName}_${p.name}"></outputVariable>`),
    ].join('\n');

    return `\t\t\t\t<FFBBlock instanceName="${instName}" typeName="${fbTypeName}" additionnalPinNumber="0" enEnO="false" width="${blockWidth}" height="${blockHeight}">
\t\t\t\t\t<objPosition posX="${posX}" posY="${posY}"></objPosition>
\t\t\t\t\t<descriptionFFB execAfter="">
${inVars}
${outVars}
\t\t\t\t\t</descriptionFFB>
\t\t\t\t</FFBBlock>`;
  }).join('\n');

  // ── dataBlock variables ────────────────────────────────────────────────────
  const allParams = [...inputParams, ...inOutParams, ...outputParams];
  const dataVars = instanceNames.flatMap(instName => [
    ...allParams.map(p => `\t\t<variables name="${instName}_${p.name}" typeName="${p.typeName}"></variables>`),
    `\t\t<variables name="${instName}" typeName="${fbTypeName}"></variables>`,
  ]).join('\n');

  const section = sectionName || fbTypeName;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<FBDExchangeFile>
\t<fileHeader company="Schneider Automation" product="Control Expert" dateTime="${dtStr}" content="Derived Function Block source file" DTDVersion="41"></fileHeader>
\t<contentHeader name="${projectName}" version="0.0.1" dateTime="${dtStr}"></contentHeader>
\t<program>
\t\t<identProgram name="${section}" type="section" task="MAST" SectionOrder="1"></identProgram>
\t\t<FBDSource nbRows="${blockHeight}" nbColumns="36">
\t\t\t<networkFBD>
${ffbBlocks}
\t\t\t</networkFBD>
\t\t</FBDSource>
\t</program>
\t<dataBlock>
${dataVars}
\t</dataBlock>
\t${fbSourceXml}
</FBDExchangeFile>`;
}

export function downloadXBD({ template, fbConfig, projectName }) {
  const instanceNames = (template.instances || []).map(i => i.name);
  if (!instanceNames.length) return;

  const parsed = parseXDB(fbConfig.content);

  const xml = generateXBD({
    fbTypeName:   parsed.fbTypeName,
    fbVersion:    parsed.version,
    fbSourceXml:  parsed.fbSourceXml,
    instanceNames,
    parameters:   parsed.parameters,
    projectName:  projectName || template.name,
    sectionName:  template.name.replace(/[^a-zA-Z0-9_]/g, '_'),
  });

  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${template.name.replace(/[^a-zA-Z0-9_]/g, '_')}_Instances.XBD`;
  a.click();
  URL.revokeObjectURL(url);
}
