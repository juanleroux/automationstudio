/**
 * Generates and opens a commissioning documentation report as a printable HTML page.
 * Columns are driven by project.documentationColumns (falls back to defaults).
 * Last Modified is always rendered last if present.
 * Flagged rows are shown in red.
 */

const DEFAULT_DOC_COLS = [
  { id: 'description',  label: 'Description',  colType: 'text',     builtin: true },
  { id: 'area',         label: 'Area',          colType: 'text',     builtin: true },
  { id: 'lastModified', label: 'Last Modified', colType: 'text',     builtin: true },
  { id: 'io',           label: 'I/O',           colType: 'checkbox', builtin: true },
  { id: 'plc',          label: 'PLC',           colType: 'checkbox', builtin: true },
  { id: 'scada',        label: 'SCADA',         colType: 'checkbox', builtin: true },
  { id: 'mes',          label: 'MES',           colType: 'checkbox', builtin: true },
  { id: 'notes',        label: 'Notes',         colType: 'text',     builtin: true },
];

export function openCommissioningReport(project) {
  // Resolve enabled columns from project settings or defaults, lastModified always last
  let docCols = (project?.documentationColumns?.length)
    ? project.documentationColumns
    : DEFAULT_DOC_COLS.map(c => ({ ...c, enabled: true }));
  docCols = docCols.filter(c => c.enabled !== false && c.id !== 'flagged');
  const lmIdx = docCols.findIndex(c => c.id === 'lastModified');
  if (lmIdx >= 0 && lmIdx < docCols.length - 1) {
    const [lm] = docCols.splice(lmIdx, 1);
    docCols.push(lm);
  }

  const templates = (project?.templates || [])
    .filter(t => (t.instances?.length || 0) > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const now     = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const checkData = project?.checkData || {};
  const areas     = project?.areas     || [];

  function getAreaLabel(areaId) {
    if (!areaId) return '';
    const parts = [];
    let cur = areas.find(a => a.id === areaId);
    while (cur) { parts.unshift(cur.name); cur = cur.parentId != null ? areas.find(a => a.id === cur.parentId) : null; }
    return parts.join(' / ');
  }

  // ── Measure flexible columns ─────────────────────────────────────
  let maxNameLen = 8;
  const hasDesc  = docCols.some(c => c.id === 'description');
  let maxDescLen = hasDesc ? 11 : 0;

  for (const tmpl of templates) {
    for (const inst of tmpl.instances || []) {
      maxNameLen = Math.max(maxNameLen, inst.name.length);
      if (hasDesc) maxDescLen = Math.max(maxDescLen, (inst.description || '').length);
    }
  }

  // ── Column widths (mm) ───────────────────────────────────────────
  // Landscape A4 content width ≈ 265mm
  const CONTENT_MM  = 265;
  const CELL_PAD_MM = 4.2;
  const AVG_CHAR_MM = 1.65;

  function fixedWidthMM(col) {
    if (col.id === 'description') return 0; // flex
    if (col.colType === 'checkbox' || col.id === 'flagged') return 12;
    if (col.id === 'area')         return 28;
    if (col.id === 'lastModified') return 24;
    if (col.id === 'notes')        return 40;
    return 28; // custom text columns
  }

  const fixedMM = docCols.reduce((s, c) => s + fixedWidthMM(c), 0);
  const flexMM  = CONTENT_MM - fixedMM;

  const rawNameMM = maxNameLen * AVG_CHAR_MM + CELL_PAD_MM * 2;
  const rawDescMM = hasDesc ? (maxDescLen * AVG_CHAR_MM + CELL_PAD_MM * 2) : 0;
  let nameMM, descMM;
  if (rawNameMM + rawDescMM <= flexMM) {
    nameMM = rawNameMM;
    descMM = flexMM - nameMM;
  } else {
    const ratio = flexMM / (rawNameMM + rawDescMM || 1);
    nameMM = rawNameMM * ratio;
    descMM = rawDescMM * ratio;
  }

  const pct = v => (v / CONTENT_MM * 100).toFixed(2) + '%';

  function getCellHtml(col, inst, c) {
    if (col.id === 'description') return esc(inst.description || '');
    if (col.id === 'area')        return esc(getAreaLabel(inst.areaId));
    if (col.id === 'lastModified')
      return inst.lastModification
        ? esc(new Date(inst.lastModification).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))
        : '';
    if (col.colType === 'checkbox') return c[col.id] ? '<span class="checkbox checked">✓</span>' : '<span class="checkbox"></span>';
    return esc(c[col.id] || '');
  }

  // ── Build template sections ──────────────────────────────────────
  const colgroup = `
    <col style="width:${pct(nameMM)}">
    ${docCols.map(col => `<col style="width:${pct(col.id === 'description' ? descMM : fixedWidthMM(col))}">`).join('')}
  `;

  const thead = `
    <tr>
      <th>Instance</th>
      ${docCols.map(col => `<th class="${col.colType === 'checkbox' || col.id === 'flagged' ? 'col-check' : ''}">${esc(col.label)}</th>`).join('')}
    </tr>
  `;

  let body = '';
  for (const tmpl of templates) {
    const instances = (tmpl.instances || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const rows = instances.map((inst, idx) => {
      const c   = checkData[`${tmpl.id}:${inst.id}`] || {};
      const red = inst.isFlagged ? ' style="color:#c0392b;"' : '';
      const cells = docCols.map(col => {
        const val = getCellHtml(col, inst, c);
        const cls = col.colType === 'checkbox' || col.id === 'flagged' ? ' class="col-check"' : col.id === 'notes' ? ' class="col-notes"' : '';
        return `<td${cls}>${val}</td>`;
      }).join('');
      return `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}"${red}><td>${esc(inst.name)}</td>${cells}</tr>`;
    }).join('');

    body += `
      <div class="template-section">
        <div class="template-header">
          <span class="template-name">${esc(tmpl.name)}</span>
          <span class="template-meta">${instances.length} instance${instances.length !== 1 ? 's' : ''}</span>
        </div>
        ${tmpl.description ? `<div class="template-desc">${esc(tmpl.description)}</div>` : ''}
        <table>
          <colgroup>${colgroup}</colgroup>
          <thead>${thead}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  if (templates.length === 0) {
    body = '<p style="text-align:center;color:#aaa;margin-top:60px">No templates with instances found in this project.</p>';
  }

  const totalInstances = templates.reduce((n, t) => n + (t.instances?.length || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Documentation Report — ${esc(project?.name || 'Project')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 landscape; margin: 14mm 16mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }

    .report-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 18px;
    }
    .report-title   { font-size: 18px; font-weight: 700; }
    .report-project { font-size: 13px; color: #444; margin-top: 2px; }
    .report-meta    { text-align: right; font-size: 10px; color: #666; line-height: 1.8; }

    .template-section { margin-bottom: 24px; }
    .template-header {
      display: flex; align-items: baseline; gap: 12px;
      background: #1a1a1a; color: #fff; padding: 5px 10px; border-radius: 3px 3px 0 0;
    }
    .template-name { font-size: 12px; font-weight: 700; }
    .template-meta { font-size: 10px; opacity: 0.6; }
    .template-desc { font-size: 10px; color: #555; padding: 4px 10px; background: #f5f5f5; border-left: 1px solid #ccc; border-right: 1px solid #ccc; }

    table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; table-layout: fixed; }
    thead tr { background: #f0f0f0; }
    th { padding: 5px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #ccc; white-space: nowrap; overflow: hidden; }
    td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    tr.even { background: #fff; }
    tr.odd  { background: #fafafa; }

    .col-check { text-align: center; }
    .col-notes { white-space: normal; }

    .checkbox { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #555; border-radius: 2px; line-height: 13px; font-size: 11px; text-align: center; }
    .checkbox.checked { background: #1a1a1a; border-color: #1a1a1a; color: #fff; font-weight: 700; }

    @media print { .template-header { page-break-after: avoid; } thead { display: table-header-group; } }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="report-title">Documentation Report</div>
      <div class="report-project">${esc(project?.name || 'Unnamed Project')}</div>
    </div>
    <div class="report-meta">
      <div style="font-weight:700;font-size:11px;color:#1a1a1a;">Automation Studio &mdash; One Technology Limited &copy;</div>
      <div>Date: ${dateStr}</div>
      <div>Templates: ${templates.length} &nbsp;·&nbsp; Instances: ${totalInstances}</div>
    </div>
  </div>

  ${body}

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
    setTimeout(() => URL.revokeObjectURL(url), 300_000);
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
