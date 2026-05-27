/**
 * Generates and opens a commissioning check sheet as a printable HTML page.
 * The browser's File > Print (or Ctrl+P) can save it as PDF.
 */
export function openCommissioningReport(project) {
  const templates = (project?.templates || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const areas = project?.areas || [];

  function areaName(areaId) {
    if (!areaId || areaId === 0) return '—';
    function search(nodes) {
      for (const n of nodes) {
        if (n.id === areaId) return n.name;
        if (n.children) {
          const found = search(n.children);
          if (found) return found;
        }
      }
      return null;
    }
    return search(areas) || '—';
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  let body = '';

  for (const tmpl of templates) {
    const attrs = tmpl.attributes || [];
    const instances = (tmpl.instances || []).slice().sort((a, b) => a.name.localeCompare(b.name));

    // Column headers: Instance, Area, each attribute, Checked, Notes
    const attrHeaders = attrs.map(a => `<th>${esc(a.name)}</th>`).join('');

    const rows = instances.map((inst, idx) => {
      const attrCells = attrs.map(ta => {
        const ia = (inst.attributes || []).find(a => a.id === ta.id);
        const val = (ia?.value ?? ta.value) || '';
        return `<td>${esc(val)}</td>`;
      }).join('');

      const flagDot = inst.isFlagged
        ? '<span style="color:#e55353;margin-right:4px;">●</span>'
        : '';

      return `
        <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
          <td>${flagDot}${esc(inst.name)}</td>
          <td>${esc(areaName(inst.areaId))}</td>
          ${attrCells}
          <td class="check-cell"><span class="checkbox"></span></td>
          <td class="notes-cell"></td>
        </tr>`;
    }).join('');

    const emptyNote = instances.length === 0
      ? `<tr><td colspan="${4 + attrs.length}" style="text-align:center;color:#aaa;font-style:italic;padding:12px">No instances</td></tr>`
      : '';

    body += `
      <div class="template-section">
        <div class="template-header">
          <span class="template-name">${esc(tmpl.name)}</span>
          <span class="template-meta">${instances.length} instance${instances.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${attrs.length} attribute${attrs.length !== 1 ? 's' : ''}</span>
        </div>
        ${tmpl.description ? `<div class="template-desc">${esc(tmpl.description)}</div>` : ''}
        <table>
          <thead>
            <tr>
              <th>Instance</th>
              <th>Area</th>
              ${attrHeaders}
              <th class="check-cell">Done</th>
              <th class="notes-cell">Notes / Sign-off</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${emptyNote}
          </tbody>
        </table>
      </div>`;
  }

  if (templates.length === 0) {
    body = '<p style="text-align:center;color:#aaa;margin-top:60px">No templates defined in this project.</p>';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Commissioning Report — ${esc(project?.name || 'Project')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      background: #fff;
      padding: 20mm 15mm;
    }

    /* ── Report header ── */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .report-title { font-size: 18px; font-weight: 700; }
    .report-project { font-size: 13px; color: #444; margin-top: 2px; }
    .report-meta { text-align: right; font-size: 10px; color: #666; line-height: 1.6; }

    /* ── Template sections ── */
    .template-section { margin-bottom: 28px; page-break-inside: avoid; }
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
    .template-meta { font-size: 10px; opacity: 0.65; }
    .template-desc {
      font-size: 10px;
      color: #555;
      padding: 4px 10px;
      background: #f5f5f5;
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ccc;
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
    }
    td {
      padding: 5px 8px;
      border: 1px solid #ddd;
      vertical-align: middle;
      white-space: nowrap;
    }
    tr.even { background: #fff; }
    tr.odd  { background: #fafafa; }
    tr:hover { background: #f0f7ff; }

    /* ── Special columns ── */
    .check-cell { width: 40px; text-align: center; }
    .notes-cell { width: 160px; min-width: 120px; }

    .checkbox {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 1.5px solid #555;
      border-radius: 2px;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 30px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 9px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }

    /* ── Print rules ── */
    @media print {
      body { padding: 10mm 12mm; }
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
      <div>Templates: ${templates.length}</div>
      <div>Total instances: ${templates.reduce((n, t) => n + (t.instances?.length || 0), 0)}</div>
    </div>
  </div>

  ${body}

  <div class="report-footer">
    <span>Automation Studio &mdash; Commissioning Report</span>
    <span>Generated ${now.toLocaleString()}</span>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
