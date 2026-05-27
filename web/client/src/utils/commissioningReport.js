/**
 * Generates and opens a commissioning check sheet as a printable HTML page.
 * Columns: Instance, Description, I/O, PLC, SCADA, MES, Notes.
 * Landscape orientation. Templates with no instances are excluded.
 */
export function openCommissioningReport(project) {
  const templates = (project?.templates || [])
    .filter(t => (t.instances?.length || 0) > 0)   // skip empty templates
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  let body = '';

  for (const tmpl of templates) {
    const instances = (tmpl.instances || []).slice().sort((a, b) => a.name.localeCompare(b.name));

    const rows = instances.map((inst, idx) => {
      const flagDot = inst.isFlagged
        ? '<span style="color:#e55353;margin-right:4px;">●</span>'
        : '';
      return `
        <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
          <td>${flagDot}${esc(inst.name)}</td>
          <td class="desc-cell">${esc(inst.description || '')}</td>
          <td class="check-cell"><span class="checkbox"></span></td>
          <td class="check-cell"><span class="checkbox"></span></td>
          <td class="check-cell"><span class="checkbox"></span></td>
          <td class="check-cell"><span class="checkbox"></span></td>
          <td class="notes-cell"></td>
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
          <thead>
            <tr>
              <th>Instance</th>
              <th class="desc-cell">Description</th>
              <th class="check-cell">I/O</th>
              <th class="check-cell">PLC</th>
              <th class="check-cell">SCADA</th>
              <th class="check-cell">MES</th>
              <th class="notes-cell">Notes</th>
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

    /* Landscape, zero @page margin so the browser doesn't inject its own
       header/footer chrome (URL, date, page number). Content margin is
       handled by body padding instead. */
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

    /* ── Report header ── */
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

    /* ── Template sections ── */
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

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; }
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
    }
    td {
      padding: 6px 8px;
      border: 1px solid #ddd;
      vertical-align: middle;
    }
    tr.even { background: #fff; }
    tr.odd  { background: #fafafa; }

    /* ── Column widths ── */
    .desc-cell  { width: 30%; }
    .check-cell { width: 48px; text-align: center; }
    .notes-cell { width: 24%; }

    .checkbox {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1.5px solid #555;
      border-radius: 2px;
    }

    /* ── Report footer ── */
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
    <span>Automation Studio &mdash; Commissioning Check Sheet</span>
    <span>Generated ${now.toLocaleString()}</span>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  // Use a Blob URL so the browser doesn't show "about:blank" in print headers/footers
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
    // Fallback cleanup after 5 minutes
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
