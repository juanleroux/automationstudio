// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeTagName(name) {
  let s = (name || '').replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^\d/.test(s)) s = '_' + s;
  return s || 'Tag';
}

// Extract raw AOI XML using string slicing (avoids XMLSerializer namespace junk).
// Must match the SINGULAR <AddOnInstructionDefinition (not the plural wrapper).
function extractAOIXml(xmlContent) {
  // [^s] prevents matching <AddOnInstructionDefinitions> (the plural wrapper)
  const startMatch = xmlContent.match(/<AddOnInstructionDefinition[^s]/);
  if (!startMatch) return '';
  const startIdx = startMatch.index;
  const endIdx = xmlContent.lastIndexOf('</AddOnInstructionDefinition>');
  if (endIdx === -1) return '';
  const raw = xmlContent.slice(startIdx, endIdx + '</AddOnInstructionDefinition>'.length);
  // Strip any Use="..." attribute that may be present on the definition element
  return raw.replace(/\s+Use="[^"]*"/, '');
}

function parseAOI(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const aoiDef = doc.querySelector('AddOnInstructionDefinition');
  if (!aoiDef) throw new Error('No AddOnInstructionDefinition found in L5X file');

  const aoiName = aoiDef.getAttribute('Name');

  // Visible+Required params (appear in the rung call signature)
  const visibleParams = [...doc.querySelectorAll('Parameter')]
    .filter(p => p.getAttribute('Required') === 'true' && p.getAttribute('Visible') === 'true')
    .map(p => ({ name: p.getAttribute('Name'), dataType: p.getAttribute('DataType'), usage: p.getAttribute('Usage') }));

  // All params (for Decorated Structure — Parameters only, NOT LocalTags)
  const allParams = [...doc.querySelectorAll('Parameter')]
    .map(p => ({ name: p.getAttribute('Name'), dataType: p.getAttribute('DataType'), usage: p.getAttribute('Usage') }));

  // Local tags (for L5K data only — not included in Decorated Structure)
  const localTags = [...doc.querySelectorAll('LocalTag')]
    .map(lt => {
      const obj = { name: lt.getAttribute('Name'), dataType: lt.getAttribute('DataType') };
      const pre = lt.querySelector('DataValueMember[Name="PRE"]');
      if (pre) obj.pre = pre.getAttribute('Value') || '0';
      return obj;
    });

  const aoiDefXml = extractAOIXml(xmlContent);

  return { aoiName, visibleParams, allParams, localTags, aoiDefXml };
}

// Generate L5K data: [EnableIn=1, localTag1, localTag2, ...]
// TIMER/COUNTER: [status_bits, PRE, ACC]; scalar types: 0
function generateL5KData(localTags) {
  const parts = ['1']; // EnableIn always 1
  for (const lt of localTags) {
    const dt = lt.dataType;
    if (dt === 'BOOL' || dt === 'DINT' || dt === 'INT' || dt === 'SINT') {
      parts.push('0');
    } else if (dt === 'REAL') {
      parts.push('0.0');
    } else if (dt === 'TIMER' || dt === 'COUNTER') {
      const pre = lt.pre || '0';
      parts.push(`[0,${pre},0]`);
    } else {
      parts.push('0');
    }
  }
  return `[${parts.join(',')}]`;
}

function memberXml(name, dataType, indent = '      ') {
  if (dataType === 'BOOL') {
    const val = name === 'EnableIn' ? '1' : '0';
    return `${indent}<DataValueMember Name="${name}" DataType="BOOL" Value="${val}"/>`;
  }
  if (dataType === 'DINT') {
    return `${indent}<DataValueMember Name="${name}" DataType="DINT" Radix="Decimal" Value="0"/>`;
  }
  if (dataType === 'INT' || dataType === 'SINT') {
    return `${indent}<DataValueMember Name="${name}" DataType="${dataType}" Radix="Decimal" Value="0"/>`;
  }
  if (dataType === 'REAL') {
    return `${indent}<DataValueMember Name="${name}" DataType="REAL" Radix="Float" Value="0.0"/>`;
  }
  // Unknown — skip
  return '';
}

// ── Main export function ───────────────────────────────────────────────────────

export function generateStudio5000Routine({ template, aoiConfig, controllerName = 'Controller' }) {
  const { aoiName, visibleParams, allParams, localTags, aoiDefXml } = parseAOI(aoiConfig.content);

  const instances = template.instances || [];
  const now = new Date().toUTCString();
  const routineName = sanitizeTagName(template.name) || 'Routine';

  // ── Tags (one per instance) ────────────────────────────────────────────────
  const l5kData = generateL5KData(localTags);
  const tagsXml = instances.map(inst => {
    const tagName = sanitizeTagName(inst.name);
    // Decorated Structure: Parameters only (no LocalTags)
    const members = allParams.map(p => memberXml(p.name, p.dataType)).filter(Boolean);

    return `  <Tag Name="${tagName}" TagType="Base" DataType="${aoiName}" Constant="false" ExternalAccess="Read/Write">
    <Data Format="L5K">
      <![CDATA[${l5kData}]]>
    </Data>
    <Data Format="Decorated">
      <Structure DataType="${aoiName}">
${members.join('\n')}
      </Structure>
    </Data>
  </Tag>`;
  }).join('\n');

  // ── Rungs (one per instance) ───────────────────────────────────────────────
  const rungsXml = instances.map((inst, i) => {
    const tagName = sanitizeTagName(inst.name);
    const args = [tagName, ...visibleParams.map(p => `${tagName}.${p.name}`)].join(',');
    return `            <Rung Number="${i}" Type="N">
              <Text>
                <![CDATA[${aoiName}(${args});]]>
              </Text>
            </Rung>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="37.00" TargetName="${routineName}" TargetType="Routine" TargetSubType="RLL" ContainsContext="true" ExportDate="${now}" ExportOptions="References NoRawData L5KData DecoratedData Context Dependencies ForceProtectedEncoding AllProjDocTrans">
<Controller Use="Context" Name="${controllerName}">
<DataTypes Use="Context">
</DataTypes>
<AddOnInstructionDefinitions Use="Context">
${aoiDefXml}
</AddOnInstructionDefinitions>
<Tags Use="Context">
${tagsXml}
</Tags>
<Programs Use="Context">
  <Program Use="Context" Name="MainProgram">
    <Routines Use="Context">
      <Routine Use="Target" Name="${routineName}" Type="RLL">
        <RLLContent>
${rungsXml}
        </RLLContent>
      </Routine>
    </Routines>
  </Program>
</Programs>
</Controller>
</RSLogix5000Content>`;
}

// ── Project L5X parser ────────────────────────────────────────────────────────
// Extracts AOI definitions (with their visible Input/Output parameters) and
// tag instances from a controller-level L5X file.
export function parseProjectL5X(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const aoiDefs = [...doc.querySelectorAll('AddOnInstructionDefinition')];
  if (!aoiDefs.length) return [];

  // Build aoiName → visible parameters (Input + Output)
  const aoiParamsMap = new Map();
  for (const def of aoiDefs) {
    const name = def.getAttribute('Name');
    if (!name) continue;
    const params = [...def.querySelectorAll('Parameter')]
      .filter(p => p.getAttribute('Visible') === 'true')
      .map(p => ({
        name: p.getAttribute('Name'),
        dataType: p.getAttribute('DataType') || 'BOOL',
        usage: p.getAttribute('Usage'), // 'Input' or 'Output'
      }));
    aoiParamsMap.set(name, params);
  }

  const aoiNames = new Set(aoiParamsMap.keys());
  const allTags = [...doc.querySelectorAll('Tag')];
  const baseTags = allTags.filter(t =>
    t.getAttribute('TagType') === 'Base' &&
    aoiNames.has(t.getAttribute('DataType'))
  );
  const aliasTags = allTags.filter(t => t.getAttribute('TagType') === 'Alias');

  const aoiMap = new Map(); // aoiName → { aoiName, parameters, instances }

  for (const baseTag of baseTags) {
    const aoiName = baseTag.getAttribute('DataType');
    const tagName = baseTag.getAttribute('Name');
    const dimensions = baseTag.getAttribute('Dimensions');

    if (!aoiMap.has(aoiName)) {
      aoiMap.set(aoiName, {
        aoiName,
        parameters: aoiParamsMap.get(aoiName) || [],
        instances: [],
      });
    }
    const group = aoiMap.get(aoiName);

    if (dimensions) {
      const count = parseInt(dimensions, 10);
      const indexAliases = new Map();
      const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const alias of aliasTags) {
        const aliasFor = alias.getAttribute('AliasFor') || '';
        const m = aliasFor.match(new RegExp(`^${escaped}\\[(\\d+)\\]$`));
        if (m) {
          const idx = parseInt(m[1], 10);
          if (!indexAliases.has(idx)) indexAliases.set(idx, alias.getAttribute('Name'));
        }
      }
      for (let i = 0; i < count; i++) {
        const alias = indexAliases.get(i);
        group.instances.push({
          name: alias || `${tagName}[${i}]`,
          tagRef: `${tagName}[${i}]`,
          isNamed: !!alias,
        });
      }
    } else {
      group.instances.push({ name: tagName, tagRef: tagName, isNamed: true });
    }
  }

  return [...aoiMap.values()];
}

export function downloadStudio5000Routine({ template, aoiConfig, controllerName }) {
  const xml = generateStudio5000Routine({ template, aoiConfig, controllerName });
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeTagName(template.name)}_Routine_RLL.L5X`;
  a.click();
  URL.revokeObjectURL(url);
}
