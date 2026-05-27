/**
 * Generates and opens a commissioning check sheet as a printable HTML page.
 * Column widths are calculated from the actual max name/description lengths
 * so every instance row fits on a single line.
 */
export function openCommissioningReport(project) {
  const templates = (project?.templates || [])
    .filter(t => (t.instances?.length || 0) > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Measure max column content across ALL templates ──────────────
  let maxNameLen = 8;   // minimum sensible widths (chars)
  let maxDescLen = 11;  // "Description" header text

  for (const tmpl of templates) {
    for (const inst of tmpl.instances || []) {
      maxNameLen = Math.max(maxNameLen, inst.name.length);
      maxDescLen = Math.max(maxDescLen, (inst.description || '').length);
    }
  }

  // ── Compute column widths ────────────────────────────────────────
  // Landscape A4 content width ≈ 265mm (297mm − 2×16mm padding).
  // Fixed columns: 4 checkbox cols + Notes.
  // Arial 11px ≈ 1.65mm average char width (measured at 96dpi→print).
  const CONTENT_MM   = 265;
  const CHECK_MM     = 13;   // per checkbox column (I/O, PLC, SCADA, MES)
  const NOTES_MM     = 48;
  const CELL_PAD_MM  = 4.2;  // 8px padding each side × 0.264mm/px
  const AVG_CHAR_MM  = 1.65;

  const fixedMM   = (4 * CHECK_MM) + NOTES_MM;
  const flexMM    = CONTENT_MM - fixedMM;

  const rawNameMM = maxNameLen * AVG_CHAR_MM + CELL_PAD_MM * 2;
  const rawDescMM = maxDescLen * AVG_CHAR_MM + CELL_PAD_MM * 2;

  let nameMM, descMM;
  if (rawNameMM + rawDescMM <= flexMM) {
    // Content fits — use exact measured widths, give remainder to description
    nameMM = rawNameMM;
    descMM = flexMM - nameMM;
  } else {
    // Scale proportionally to fill available space
    const ratio = flexMM / (rawNameMM + rawDescMM);
    nameMM = rawNameMM * ratio;
    descMM = rawDescMM * ratio;
  }

  // Convert mm → percentage of content width for CSS
  const pct = v => (v / CONTENT_MM * 100).toFixed(2) + '%';

  // ── Build template sections ──────────────────────────────────────
  let body = '';

  for (const tmpl of templates) {
    const instances = (tmpl.instances || []).slice().sort((a, b) => a.name.localeCompare(b.name));

    const rows = instances.map((inst, idx) => {
      const flagDot = inst.isFlagged
        ? '<span style="color:#e55353;margin-right:4px;">●</span>'
        : '';
      return `
        <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
          <td class="col-name">${flagDot}${esc(inst.name)}</td>
          <td class="col-desc">${esc(inst.description || '')}</td>
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-notes"></td>
        </tr>`;
    }).join('');

    body += `
      <div class="template-section">
        <div class="template-header">
          <span class="template-name">${esc(tmpl.name)}</span>
          <span class="template-meta">${instances.length} instance${instances.length !== 1 ? 's' : ''}</span>
        </div>
        ${tmpl.description ? `<div class="template-desc">${esc(tmpl.description)}</div>` : ''}
        <table>
          <colgroup>
            <col style="width:${pct(nameMM)}">
            <col style="width:${pct(descMM)}">
            <col style="width:${pct(CHECK_MM)}">
            <col style="width:${pct(CHECK_MM)}">
            <col style="width:${pct(CHECK_MM)}">
            <col style="width:${pct(CHECK_MM)}">
            <col style="width:${pct(NOTES_MM)}">
          </colgroup>
          <thead>
            <tr>
              <th class="col-name">Instance</th>
              <th class="col-desc">Description</th>
              <th class="col-check">I/O</th>
              <th class="col-check">PLC</th>
              <th class="col-check">SCADA</th>
              <th class="col-check">MES</th>
              <th class="col-notes">Notes</th>
            </tr>
          </thead>
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
  <title>Commissioning Check Sheet — ${esc(project?.name || 'Project')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4 landscape;
      margin: 0;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      background: #fff;
      padding: 14mm 16mm;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 8px;
      margin-bottom: 18px;
    }
    .report-title   { font-size: 18px; font-weight: 700; }
    .report-project { font-size: 13px; color: #444; margin-top: 2px; }
    .report-meta    { text-align: right; font-size: 10px; color: #666; line-height: 1.8; }

    .template-section { margin-bottom: 24px; page-break-inside: avoid; }
    .template-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      background: #1a1a1a;
      color: #fff;
      padding: 5px 10px;
      border-radius: 3px 3px 0 0;
    }
    .template-name { font-size: 12px; font-weight: 700; }
    .template-meta { font-size: 10px; opacity: 0.6; }
    .template-desc {
      font-size: 10px;
      color: #555;
      padding: 4px 10px;
      background: #f5f5f5;
      border-left: 1px solid #ccc;
      border-right: 1px solid #ccc;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ccc;
      table-layout: fixed;
    }
    thead tr { background: #f0f0f0; }
    th {
      padding: 5px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid #ccc;
      white-space: nowrap;
      overflow: hidden;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #ddd;
      vertical-align: middle;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    tr.even { background: #fff; }
    tr.odd  { background: #fafafa; }

    .col-check { text-align: center; }
    .col-notes { white-space: normal; }

    .checkbox {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1.5px solid #555;
      border-radius: 2px;
    }

    .report-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 9px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      .template-section { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="report-title">Commissioning Check Sheet</div>
      <div class="report-project">${esc(project?.name || 'Unnamed Project')}</div>
    </div>
    <div class="report-meta">
      <div>Date: ${dateStr}</div>
      <div>Templates: ${templates.length} &nbsp;·&nbsp; Instances: ${totalInstances}</div>
    </div>
  </div>

  ${body}

  <div class="report-footer">
    <span>Automation Studio &mdash; One Technology Limited</span>
    <span>Generated ${now.toLocaleString()}</span>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
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
