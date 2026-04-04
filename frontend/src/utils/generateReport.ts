/**
 * generateReport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a beautiful, print-ready EDI Validation Report in a new window.
 * Uses the browser's native Print → Save as PDF.
 * Styled to match the EdiFix doodle theme (Nunito, JetBrains Mono, ink shadows).
 */

interface ReportData {
  fileName: string
  transactionType: string | null
  parseResult: Record<string, unknown>
}

function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0'
  return Number(n).toLocaleString()
}

function severityBadge(type: string): string {
  const isWarning = type.toLowerCase().includes('situational') || type.toLowerCase().includes('unverified')
  const bg = isWarning ? 'rgba(255,230,109,0.3)' : 'rgba(255,107,107,0.15)'
  const color = isWarning ? '#8A6F00' : '#C0392B'
  const label = isWarning ? 'WARN' : 'ERROR'
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;background:${bg};color:${color};letter-spacing:0.05em;">${label}</span>`
}

export function generateReport({ fileName, transactionType, parseResult }: ReportData): void {
  const tree = (parseResult as Record<string, unknown>)?.data as Record<string, unknown> || parseResult
  const metadata = (tree?.metadata || {}) as Record<string, unknown>
  const errors = (tree?.errors || []) as Record<string, unknown>[]
  const warnings = (tree?.warnings || []) as Record<string, unknown>[]
  const metrics = (tree?.metrics || {}) as Record<string, unknown>

  const txn = transactionType || (metadata.transaction_type as string) || 'Unknown'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const txnLabels: Record<string, string> = {
    '837': '837 Professional/Institutional Claim',
    '835': '835 Remittance Advice',
    '834': '834 Benefit Enrollment & Maintenance',
  }

  // ── Build error rows ────────────────────────────────────────────────────
  const errorRows = errors.map((e, i) => `
    <tr style="border-top:1.5px solid rgba(26,26,46,0.08);">
      <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(26,26,46,0.5);vertical-align:top;">${i + 1}</td>
      <td style="padding:10px 14px;vertical-align:top;">${severityBadge(String(e.type || ''))}</td>
      <td style="padding:10px 14px;vertical-align:top;">
        <code style="font-family:'JetBrains Mono',monospace;font-size:11px;background:rgba(78,205,196,0.1);padding:2px 6px;border-radius:4px;">${esc(String(e.segment || 'N/A'))}</code>
        ${e.loop ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(26,26,46,0.4);margin-left:6px;">Loop ${esc(String(e.loop))}</span>` : ''}
      </td>
      <td style="padding:10px 14px;font-size:12px;color:#1A1A2E;line-height:1.5;vertical-align:top;">
        ${esc(String(e.message || ''))}
        ${e.suggestion ? `<div style="margin-top:4px;font-size:11px;color:rgba(26,26,46,0.5);font-style:italic;">💡 ${esc(String(e.suggestion))}</div>` : ''}
      </td>
      <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(26,26,46,0.45);vertical-align:top;">${e.line ?? '—'}</td>
    </tr>
  `).join('')

  const warningRows = warnings.map((w, i) => `
    <tr style="border-top:1.5px solid rgba(26,26,46,0.08);">
      <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(26,26,46,0.5);vertical-align:top;">${i + 1}</td>
      <td style="padding:10px 14px;vertical-align:top;">${severityBadge(String(w.type || 'Situational'))}</td>
      <td style="padding:10px 14px;vertical-align:top;">
        <code style="font-family:'JetBrains Mono',monospace;font-size:11px;background:rgba(255,230,109,0.15);padding:2px 6px;border-radius:4px;">${esc(String(w.segment || 'N/A'))}</code>
        ${w.loop ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(26,26,46,0.4);margin-left:6px;">Loop ${esc(String(w.loop))}</span>` : ''}
      </td>
      <td style="padding:10px 14px;font-size:12px;color:#1A1A2E;line-height:1.5;vertical-align:top;">
        ${esc(String(w.message || ''))}
        ${w.suggestion ? `<div style="margin-top:4px;font-size:11px;color:rgba(26,26,46,0.5);font-style:italic;">💡 ${esc(String(w.suggestion))}</div>` : ''}
      </td>
      <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(26,26,46,0.45);vertical-align:top;">${w.line ?? '—'}</td>
    </tr>
  `).join('')

  // ── Verdict ─────────────────────────────────────────────────────────────
  const errorCount = errors.length
  const warningCount = warnings.length
  let verdictBg: string, verdictBorder: string, verdictIcon: string, verdictText: string
  if (errorCount === 0 && warningCount === 0) {
    verdictBg = 'rgba(46,204,113,0.08)'; verdictBorder = 'rgba(46,204,113,0.4)'; verdictIcon = '✅'; verdictText = 'File passed all validation checks with zero errors and zero warnings.'
  } else if (errorCount === 0) {
    verdictBg = 'rgba(255,230,109,0.12)'; verdictBorder = 'rgba(200,160,0,0.35)'; verdictIcon = '⚠️'; verdictText = `File has no errors but ${warningCount} situational warning(s) were detected. Review recommended.`
  } else {
    verdictBg = 'rgba(255,107,107,0.07)'; verdictBorder = 'rgba(255,107,107,0.4)'; verdictIcon = '🚨'; verdictText = `File has ${errorCount} error(s) and ${warningCount} warning(s). Corrections required before submission.`
  }

  // ── Full HTML ───────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EDI Validation Report — ${esc(fileName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Nunito', sans-serif;
      background: #FDFAF4;
      color: #1A1A2E;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page { margin: 0.6in 0.5in; size: letter; }
    .page { max-width: 820px; margin: 0 auto; padding: 40px 0; }
    @media print {
      .page { padding: 0; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    table { width: 100%; border-collapse: collapse; }
    .kpi { display: inline-block; min-width: 140px; padding: 14px 18px; background: #FFFFFF; border: 2px solid #1A1A2E; border-radius: 10px; box-shadow: 3px 3px 0px rgba(26,26,46,0.15); margin: 0 10px 10px 0; vertical-align: top; }
    .kpi-label { font-size: 10px; font-weight: 800; color: rgba(26,26,46,0.45); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }
    .kpi-value { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; }
    .section-bar { display: flex; align-items: center; gap: 8px; margin: 36px 0 14px; }
    .section-bar .dot { width: 4px; height: 18px; border-radius: 2px; flex-shrink: 0; }
    .section-bar h2 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.07em; margin: 0; }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Print button (hidden in PDF) ──────────────────────────────────── -->
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="
      font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;
      background:#4ECDC4;color:#1A1A2E;border:2.5px solid #1A1A2E;
      border-radius:8px;padding:10px 24px;cursor:pointer;
      box-shadow:3px 3px 0px #1A1A2E;
    ">📄 Save as PDF</button>
  </div>

  <!-- ── Header ────────────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;padding-bottom:24px;border-bottom:2.5px solid #1A1A2E;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#4ECDC4;border:2.5px solid #1A1A2E;box-shadow:3px 3px 0px rgba(26,26,46,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;">📋</div>
        <div>
          <h1 style="font-size:22px;font-weight:900;margin:0;">EDI Validation Report</h1>
          <div style="font-size:11px;color:rgba(26,26,46,0.45);margin-top:2px;">Generated by EdiFix — Open Source X12 Parser & Validator</div>
        </div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(26,26,46,0.5);">${esc(dateStr)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(26,26,46,0.4);">${esc(timeStr)}</div>
    </div>
  </div>

  <!-- ── File Info ─────────────────────────────────────────────────────── -->
  <div style="background:#FFFFFF;border:2px solid #1A1A2E;border-radius:12px;box-shadow:4px 4px 0px rgba(26,26,46,0.1);padding:20px 24px;margin-bottom:28px;">
    <table>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:13px;color:rgba(26,26,46,0.55);width:180px;">File Name</td>
        <td style="padding:6px 0;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;">${esc(fileName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:13px;color:rgba(26,26,46,0.55);">Transaction Type</td>
        <td style="padding:6px 0;font-size:13px;">
          <code style="font-family:'JetBrains Mono',monospace;font-size:12px;background:rgba(78,205,196,0.12);padding:3px 10px;border-radius:5px;border:1px solid rgba(78,205,196,0.3);">${esc(txn)}</code>
          <span style="font-size:12px;color:rgba(26,26,46,0.5);margin-left:8px;">${esc(txnLabels[txn] || '')}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:13px;color:rgba(26,26,46,0.55);">Sender ID</td>
        <td style="padding:6px 0;font-family:'JetBrains Mono',monospace;font-size:13px;">${esc(String(metadata.sender_id || 'N/A'))}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:13px;color:rgba(26,26,46,0.55);">Receiver ID</td>
        <td style="padding:6px 0;font-family:'JetBrains Mono',monospace;font-size:13px;">${esc(String(metadata.receiver_id || 'N/A'))}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:13px;color:rgba(26,26,46,0.55);">Control Number</td>
        <td style="padding:6px 0;font-family:'JetBrains Mono',monospace;font-size:13px;">${esc(String(metadata.control_number || 'N/A'))}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:13px;color:rgba(26,26,46,0.55);">Implementation Ref</td>
        <td style="padding:6px 0;font-family:'JetBrains Mono',monospace;font-size:13px;">${esc(String(metadata.implementation_reference || 'N/A'))}</td>
      </tr>
    </table>
  </div>

  <!-- ── KPI Cards ─────────────────────────────────────────────────────── -->
  <div class="section-bar"><div class="dot" style="background:#4ECDC4;"></div><h2>Parse Metrics</h2></div>
  <div style="margin-bottom:28px;">
    <div class="kpi"><div class="kpi-label">Segments</div><div class="kpi-value" style="color:#1A1A2E;">${fmt(metrics.total_segments as number)}</div></div>
    <div class="kpi"><div class="kpi-label">Claims</div><div class="kpi-value" style="color:#4ECDC4;">${fmt(metrics.total_claims as number)}</div></div>
    <div class="kpi"><div class="kpi-label">Errors</div><div class="kpi-value" style="color:${errorCount > 0 ? '#FF6B6B' : '#27AE60'};">${fmt(errorCount)}</div></div>
    <div class="kpi"><div class="kpi-label">Warnings</div><div class="kpi-value" style="color:${warningCount > 0 ? '#B89000' : '#27AE60'};">${fmt(warningCount)}</div></div>
  </div>

  <!-- ── Verdict ───────────────────────────────────────────────────────── -->
  <div class="section-bar"><div class="dot" style="background:#FFE66D;"></div><h2>Validation Verdict</h2></div>
  <div style="background:${verdictBg};border:2px solid ${verdictBorder};border-radius:12px;padding:18px 22px;margin-bottom:32px;display:flex;align-items:flex-start;gap:14px;">
    <span style="font-size:26px;line-height:1;flex-shrink:0;">${verdictIcon}</span>
    <p style="font-size:14px;line-height:1.6;margin:0;">${esc(verdictText)}</p>
  </div>

  <!-- ── Errors Table ──────────────────────────────────────────────────── -->
  ${errorCount > 0 ? `
  <div class="section-bar"><div class="dot" style="background:#FF6B6B;"></div><h2>Errors (${errorCount})</h2></div>
  <div style="border:2px solid #1A1A2E;border-radius:12px;overflow:hidden;box-shadow:4px 4px 0px rgba(26,26,46,0.08);margin-bottom:32px;">
    <table>
      <thead>
        <tr style="background:#1A1A2E;">
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#4ECDC4;text-align:left;width:36px;">#</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#4ECDC4;text-align:left;width:70px;">Severity</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#4ECDC4;text-align:left;width:120px;">Segment</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#4ECDC4;text-align:left;">Description</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#4ECDC4;text-align:left;width:50px;">Line</th>
        </tr>
      </thead>
      <tbody style="background:#FFFFFF;">${errorRows}</tbody>
    </table>
  </div>
  ` : ''}

  <!-- ── Warnings Table ────────────────────────────────────────────────── -->
  ${warningCount > 0 ? `
  <div class="section-bar"><div class="dot" style="background:#FFE66D;"></div><h2>Warnings (${warningCount})</h2></div>
  <div style="border:2px solid rgba(26,26,46,0.3);border-radius:12px;overflow:hidden;box-shadow:3px 3px 0px rgba(26,26,46,0.06);margin-bottom:32px;">
    <table>
      <thead>
        <tr style="background:#1A1A2E;">
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#FFE66D;text-align:left;width:36px;">#</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#FFE66D;text-align:left;width:70px;">Severity</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#FFE66D;text-align:left;width:120px;">Segment</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#FFE66D;text-align:left;">Description</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#FFE66D;text-align:left;width:50px;">Line</th>
        </tr>
      </thead>
      <tbody style="background:#FFFFFF;">${warningRows}</tbody>
    </table>
  </div>
  ` : ''}

  <!-- ── Footer ────────────────────────────────────────────────────────── -->
  <div style="margin-top:40px;padding-top:20px;border-top:1.5px solid rgba(26,26,46,0.12);display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:11px;color:rgba(26,26,46,0.35);">
      Generated by <strong style="color:rgba(26,26,46,0.55);">EdiFix</strong> — Open Source X12 Parser & Validator
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(26,26,46,0.3);">
      ${esc(dateStr)} ${esc(timeStr)}
    </div>
  </div>

</div>
</body>
</html>`

  // ── Open in new window ──────────────────────────────────────────────────
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}