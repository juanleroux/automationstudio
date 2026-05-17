function csvCell(value, delimiter) {
  const str = value == null ? '' : String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function lookupAttribute(name, inst, template) {
  const ta = (template.attributes || []).find(a => a.name.toLowerCase() === name.toLowerCase());
  if (!ta) return '';
  const ia = (inst.attributes || []).find(a => a.id === ta.id);
  return (ia != null && ia.value != null) ? ia.value : (ta.value || '');
}

/**
 * Resolve a single keyword token (no operators).
 *
 * Supports:
 *   Instance.Name | Instance.Description | Template.Name   — built-in
 *   <AttrName>                                              — attribute value
 *   <AttrName>.Value                                        — attribute value (explicit)
 *   <AttrName>.Description                                  — attribute description
 *   <AttrName>.Name                                         — attribute name
 */
function resolveKeyword(keyword, attr, inst, template) {
  const k = keyword.trim();
  if (!k) return '';
  const kl = k.toLowerCase();

  // Built-in keywords
  if (kl === 'instance.name')        return inst.name || '';
  if (kl === 'instance.description') return inst.description || '';
  if (kl === 'template.name')        return template.name || '';
  if (kl === 'instance.area')        return '';
  if (kl === 'attribute.name')       return attr?.name || '';
  if (kl === 'attribute.value')      return lookupAttribute(attr?.name || '', inst, template);

  // AttributeName.Property — e.g. "Attribute 1.Description", "Speed.Value"
  const PROP_SUFFIXES = ['.value', '.description', '.name'];
  for (const suffix of PROP_SUFFIXES) {
    if (kl.endsWith(suffix)) {
      const attrName = k.slice(0, k.length - suffix.length).trim();
      const ta = (template.attributes || []).find(a => a.name.toLowerCase() === attrName.toLowerCase());
      if (!ta) return '';
      if (suffix === '.value') {
        const ia = (inst.attributes || []).find(a => a.id === ta.id);
        return (ia != null && ia.value != null) ? ia.value : (ta.value || '');
      }
      if (suffix === '.description') return ta.description || '';
      if (suffix === '.name')        return ta.name || '';
    }
  }

  // Bare attribute name — return its value for the current instance
  return lookupAttribute(k, inst, template);
}

/**
 * Evaluate an expression that may contain:
 *   - keyword references:  Instance.Name, Instance.Description, Template.Name, <AttributeName>
 *   - string literals:     "some text"  or  'some text'
 *   - concatenation:       Instance.Name + " " + Instance.Description
 */
function evaluateExpression(expression, attr, inst, template) {
  if (!expression || !expression.trim()) return '';

  const parts = [];
  let i = 0;
  const expr = expression.trim();

  while (i < expr.length) {
    // Skip whitespace
    while (i < expr.length && expr[i] === ' ') i++;
    if (i >= expr.length) break;

    const ch = expr[i];

    if (ch === '"' || ch === "'") {
      // String literal
      const quote = ch;
      i++;
      let str = '';
      while (i < expr.length && expr[i] !== quote) {
        str += expr[i++];
      }
      i++; // closing quote
      parts.push(str);
    } else if (ch === '+') {
      i++; // concatenation operator — just advance
    } else {
      // Keyword / attribute reference — read until +, quote, or end
      let ref = '';
      while (i < expr.length && expr[i] !== '+' && expr[i] !== '"' && expr[i] !== "'") {
        ref += expr[i++];
      }
      ref = ref.trim();
      if (ref) parts.push(resolveKeyword(ref, attr, inst, template));
    }
  }

  return parts.join('');
}

/**
 * Resolve the rule for one profile column against one instance.
 * Falls back to the column name as the expression when no rule is set.
 */
function resolveRule(rule, attr, inst, template) {
  const expression = (rule && rule.trim()) || (attr?.name?.trim()) || '';
  return evaluateExpression(expression, attr, inst, template);
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
      .replace(/\{Instance\.Name\}/gi,        inst.name || '')
      .replace(/\{Instance\.Description\}/gi, inst.description || '')
      .replace(/\{Template\.Name\}/gi,        template.name || '')
  ).join('\n---\n');
}

const FORMAT_EXT = { 0: 'csv', 1: 'txt', 2: 'xml', 3: 'txt' };

/**
 * Run a profile export and trigger a file download.
 * Returns an error string on validation failure, null on success.
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
