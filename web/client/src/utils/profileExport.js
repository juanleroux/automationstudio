function csvCell(value, delimiter) {
  const str = value == null ? '' : String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function lookupAttribute(name, inst, template) {
  const ta = (template.attributes || []).find(a => a.name.toLowerCase() === name);
  if (!ta) return '';
  const ia = (inst.attributes || []).find(a => a.id === ta.id);
  return (ia != null && ia.value != null) ? ia.value : (ta.value || '');
}

function resolveRule(rule, attr, inst, template) {
  // When no rule is set, fall back to the column name as the expression.
  // This means a column named "Instance.Name" or an attribute name like "Speed"
  // will resolve automatically without the user having to type a rule.
  const expression = (rule && rule.trim()) || (attr?.name?.trim()) || '';
  if (!expression) return '';

  const r = expression.toLowerCase();

  if (r === 'instance.name')        return inst.name || '';
  if (r === 'instance.description') return inst.description || '';
  if (r === 'template.name')        return template.name || '';
  if (r === 'attribute.name')       return attr?.name || '';

  // "Attribute.Value" — resolve against the template attribute whose name
  // matches the column name (since there is no single "current attribute" in
  // tabular context, we use the column name as the attribute lookup key).
  if (r === 'attribute.value') {
    return lookupAttribute((attr?.name || '').toLowerCase(), inst, template);
  }

  // instance.area — would need project areas; return empty until wired up
  if (r === 'instance.area') return '';

  // Otherwise treat the expression as a template attribute name
  return lookupAttribute(r, inst, template);
}

function buildTabularCSV(profile, template) {
  const delimiter = profile.tabularExportDelimiter || ',';
  const cols = profile.attributes || [];
  const header = cols.map(a => csvCell(a.name, delimiter)).join(delimiter);
  const rows = (template.instances || []).map(inst =>
    cols.map(attr => csvCell(resolveRule(attr.rule, attr, inst, template), delimiter)).join(delimiter)
  );
  return [header, ...rows].join('\r\n');
}

function buildStructuralText(profile, template) {
  const tmpl = profile.structuralExportTemplate || '';
  return (template.instances || []).map(inst =>
    tmpl
      .replace(/\{Instance\.Name\}/gi, inst.name || '')
      .replace(/\{Instance\.Description\}/gi, inst.description || '')
      .replace(/\{Template\.Name\}/gi, template.name || '')
  ).join('\n---\n');
}

const FORMAT_EXT = { 0: 'csv', 1: 'txt', 2: 'xml', 3: 'txt' };

/**
 * Run a profile export and trigger a file download.
 * Returns an error string if validation fails, null on success.
 */
export function runProfileExport(profile, template) {
  if (!profile || !template) return 'No profile or template';
  if (!(template.instances?.length)) return 'No instances to export';
  if (profile.exportType === 0 && !(profile.attributes?.length)) return 'No columns configured for this profile';

  const content = profile.exportType === 0
    ? buildTabularCSV(profile, template)
    : buildStructuralText(profile, template);

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

  return null;
}
