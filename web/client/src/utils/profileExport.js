function csvCell(value, delimiter) {
  const str = value == null ? '' : String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function resolveRule(rule, attr, inst, template) {
  if (!rule) return '';
  const r = rule.trim().toLowerCase();
  if (r === 'instance.name') return inst.name || '';
  if (r === 'instance.description') return inst.description || '';
  if (r === 'template.name') return template.name || '';
  if (r === 'instance.area') return '';
  if (r === 'attribute.name') return attr.name || '';
  const ta = (template.attributes || []).find(a => a.name.toLowerCase() === r);
  if (ta) {
    const ia = (inst.attributes || []).find(a => a.id === ta.id);
    return ia != null && ia.value != null ? ia.value : (ta.value || '');
  }
  return '';
}

function buildTabularCSV(profile, template) {
  const delimiter = profile.tabularExportDelimiter || ',';
  const cols = profile.attributes || [];
  const header = cols.map(a => csvCell(a.name, delimiter)).join(delimiter);
  const rows = (template.instances || []).map(inst =>
    cols.map(attr => csvCell(resolveRule(attr.rule || '', attr, inst, template), delimiter)).join(delimiter)
  );
  return [header, ...rows].join('\r\n');
}

function buildStructuralText(profile, template) {
  const tmpl = profile.structuralExportTemplate || '';
  return (template.instances || []).map(inst =>
    tmpl
      .replace(/\{Instance\.Name\}/gi, inst.name)
      .replace(/\{Instance\.Description\}/gi, inst.description || '')
      .replace(/\{Template\.Name\}/gi, template.name)
  ).join('\n---\n');
}

const FORMAT_EXT = { 0: 'csv', 1: 'txt', 2: 'xml', 3: 'txt' };

/**
 * Run a profile export and trigger a file download.
 * Returns an error string if validation fails, otherwise null.
 */
export function runProfileExport(profile, template) {
  if (!profile || !template) return 'No profile or template';
  if (!(template.instances?.length)) return 'No instances to export';
  if (profile.exportType === 0 && !(profile.attributes?.length)) return 'No columns configured for this profile';

  let content;
  if (profile.exportType === 0) {
    content = buildTabularCSV(profile, template);
  } else {
    content = buildStructuralText(profile, template);
  }

  const ext = FORMAT_EXT[profile.formatType] ?? 'txt';
  const safeName = (profile.name || 'profile').replace(/[^a-z0-9_\-]/gi, '_');
  const filename = `${template.name}_${safeName}.${ext}`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return null; // success
}
