// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeTagName(name) {
  let s = (name || '').replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^\d/.test(s)) s = '_' + s;
  return s || 'Tag';
}

function parseAOI(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const aoiDef = doc.querySelector('AddOnInstructionDefinition');
  if (!aoiDef) throw new Error('No AddOnInstructionDefinition found in L5X file');

  const aoiName = aoiDef.getAttribute('Name');

  // Visible+Required params (the ones that appear in the rung call signature)
  const visibleParams = [...doc.querySelectorAll('Parameter')]
    .filter(p => p.getAttribute('Required') === 'true' && p.getAttribute('Visible') === 'true')
    .map(p => ({ name: p.getAttribute('Name'), dataType: p.getAttribute('DataType'), usage: p.getAttribute('Usage') }));

  // All params (for tag structure generation)
  const allParams = [...doc.querySelectorAll('Parameter')]
    .map(p => ({ name: p.getAttribute('Name'), dataType: p.getAttribute('DataType'), usage: p.getAttribute('Usage') }));

  // Local tags (for tag structure generation)
  const localTags = [...doc.querySelectorAll('LocalTag')]
    .map(lt => {
      const obj = { name: lt.getAttribute('Name'), dataType: lt.getAttribute('DataType') };
      // Capture TIMER/COUNTER defaults
      const pre = lt.querySelector('DataValueMember[Name="PRE"]');
      if (pre) obj.pre = pre.getAttribute('Value') || '0';
      return obj;
    });

  // Extract raw AOI XML to embed as context (without the outer RSLogix5000Content wrapper)
  const serializer = new XMLSerializer();
  const aoiClone = aoiDef.cloneNode(true);
  aoiClone.removeAttribute('Use'); // strip Use="Target"
  const aoiDefXml = serializer.serializeToString(aoiClone);

  return { aoiName, visibleParams, allParams, localTags, aoiDefXml };
}

function memberXml(name, dataType, pre = '10000', indent = '      ') {
  if (dataType === 'BOOL') {
    const val = name === 'EnableIn' ? '1' : '0';
    return `${indent}<DataValueMember Name="${name}" DataType="BOOL" Value="${val}"/>`;
  }
  if (dataType === 'DINT') {
    return `${indent}<DataValueMember Name="${name}" DataType="DINT" Radix="Decimal" Value="0"/>`;
  }
  if (dataType === 'INT') {
    return `${indent}<DataValueMember Name="${name}" DataType="INT" Radix="Decimal" Value="0"/>`;
  }
  if (dataType === 'REAL') {
    return `${indent}<DataValueMember Name="${name}" DataType="REAL" Radix="Float" Value="0.0"/>`;
  }
  if (dataType === 'TIMER') {
    return `${indent}<StructureMember Name="${name}" DataType="TIMER">
${indent}  <DataValueMember Name="PRE" DataType="DINT" Radix="Decimal" Value="${pre}"/>
${indent}  <DataValueMember Name="ACC" DataType="DINT" Radix="Decimal" Value="0"/>
${indent}  <DataValueMember Name="EN" DataType="BOOL" Value="0"/>
${indent}  <DataValueMember Name="TT" DataType="BOOL" Value="0"/>
${indent}  <DataValueMember Name="DN" DataType="BOOL" Value="0"/>
${indent}</StructureMember>`;
  }
  if (dataType === 'COUNTER') {
    return `${indent}<StructureMember Name="${name}" DataType="COUNTER">
${indent}  <DataValueMember Name="PRE" DataType="DINT" Radix="Decimal" Value="0"/>
${indent}  <DataValueMember Name="ACC" DataType="DINT" Radix="Decimal" Value="0"/>
${indent}  <DataValueMember Name="CU" DataType="BOOL" Value="0"/>
${indent}  <DataValueMember Name="CD" DataType="BOOL" Value="0"/>
${indent}  <DataValueMember Name="DN" DataType="BOOL" Value="0"/>
${indent}  <DataValueMember Name="OV" DataType="BOOL" Value="0"/>
${indent}  <DataValueMember Name="UN" DataType="BOOL" Value="0"/>
${indent}</StructureMember>`;
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
  const tagsXml = instances.map(inst => {
    const tagName = sanitizeTagName(inst.name);
    const members = [
      ...allParams.map(p => memberXml(p.name, p.dataType)),
      ...localTags.map(lt => memberXml(lt.name, lt.dataType, lt.pre || '10000')),
    ].filter(Boolean);

    return `  <Tag Name="${tagName}" TagType="Base" DataType="${aoiName}" Constant="false" ExternalAccess="Read/Write">
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
