import { db } from '@/lib/supabase-server'

// ─── Helpers ──────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#9CA3AF',
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued', in_progress: 'In Progress', qc: 'QC Review', done: 'Done', cancelled: 'Cancelled',
}

const STATUS_STYLE: Record<string, string> = {
  queued:      'background:#FEF3C7;color:#92400E',
  in_progress: 'background:#DBEAFE;color:#1E40AF',
  qc:          'background:#EDE9FE;color:#5B21B6',
  done:        'background:#D1FAE5;color:#065F46',
  cancelled:   'background:#F3F4F6;color:#6B7280',
}

// ─── GET /api/report/daily ─────────────────────────────────────
//
// Returns a standalone printable HTML document. Open in a new tab;
// Ctrl+P / Print → Save as PDF gives you a clean A4 report.
//
// Scale-up path: swap this for Puppeteer in a Lambda to generate real PDFs,
// then send via email through SES on a cron schedule.

export async function GET() {
  const sb = db()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // All three fetches run in parallel
  const [completedRes, consumptionsRes, pendingRes] = await Promise.all([
    // Orders completed today
    sb
      .from('work_orders')
      .select('order_number, quantity, actual_end, products(name, sku, unit)')
      .eq('status', 'done')
      .gte('actual_end', today.toISOString())
      .lt('actual_end', tomorrow.toISOString())
      .order('actual_end', { ascending: false }),

    // Material consumptions today
    sb
      .from('inventory_transactions')
      .select('quantity, raw_materials(name, unit)')
      .eq('type', 'consumption')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString()),

    // Active/pending orders
    sb
      .from('work_orders')
      .select('order_number, quantity, status, priority, scheduled_end, products(name, unit)')
      .neq('status', 'done')
      .neq('status', 'cancelled')
      .order('scheduled_end', { ascending: true }),
  ])

  // ── Aggregate completed by product ──────────────────────────

  type ProdMap = Map<string, { name: string; unit: string; orders: number; qty: number }>
  const byProduct: ProdMap = new Map()

  let totalUnits = 0

  for (const row of completedRes.data ?? []) {
    const prod = row.products as unknown as { name: string; unit: string } | null
    const key  = prod?.name ?? 'Unknown'
    const qty  = Number(row.quantity)
    totalUnits += qty

    const existing = byProduct.get(key)
    if (existing) {
      existing.orders += 1
      existing.qty    += qty
    } else {
      byProduct.set(key, { name: key, unit: prod?.unit ?? '', orders: 1, qty })
    }
  }

  // ── Aggregate materials consumed ─────────────────────────────

  type MatMap = Map<string, { name: string; unit: string; qty: number }>
  const byMaterial: MatMap = new Map()

  for (const row of consumptionsRes.data ?? []) {
    const mat = row.raw_materials as unknown as { name: string; unit: string } | null
    const key = mat?.name ?? 'Unknown'
    const qty = Number(row.quantity)

    const existing = byMaterial.get(key)
    if (existing) {
      existing.qty += qty
    } else {
      byMaterial.set(key, { name: key, unit: mat?.unit ?? '', qty })
    }
  }

  // ── Pending order stats ──────────────────────────────────────

  const pending    = pendingRes.data ?? []
  const overdueCount = pending.filter(wo =>
    wo.scheduled_end && new Date(wo.scheduled_end as string) < new Date()
  ).length

  // ── Build HTML ───────────────────────────────────────────────

  const completedCount = completedRes.data?.length ?? 0
  const reportDate = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  // Production table rows
  const prodRows = byProduct.size === 0
    ? `<tr><td colspan="4" style="padding:20px;text-align:center;color:#9CA3AF">No orders completed today</td></tr>`
    : Array.from(byProduct.values()).map(p => `
      <tr>
        <td>${esc(p.name)}</td>
        <td style="text-align:center">${p.orders}</td>
        <td style="text-align:right;font-family:monospace">${fmt(p.qty)}</td>
        <td>${esc(p.unit)}</td>
      </tr>`).join('')

  // Materials table rows
  const matRows = byMaterial.size === 0
    ? `<tr><td colspan="3" style="padding:20px;text-align:center;color:#9CA3AF">No consumptions recorded today</td></tr>`
    : Array.from(byMaterial.values())
        .sort((a, b) => b.qty - a.qty)
        .map(m => `
      <tr>
        <td>${esc(m.name)}</td>
        <td style="text-align:right;font-family:monospace">${fmt(m.qty)}</td>
        <td>${esc(m.unit)}</td>
      </tr>`).join('')

  // Pending orders table rows
  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  const sortedPending = [...pending].sort((a, b) =>
    (PRIORITY_ORDER[a.priority as string] ?? 9) - (PRIORITY_ORDER[b.priority as string] ?? 9)
  )

  const pendingRows = sortedPending.length === 0
    ? `<tr><td colspan="5" style="padding:20px;text-align:center;color:#9CA3AF">No active orders</td></tr>`
    : sortedPending.map(wo => {
        const prod    = wo.products as unknown as { name: string; unit: string } | null
        const overdue = wo.scheduled_end && new Date(wo.scheduled_end as string) < new Date()
        const priColor = PRIORITY_COLOR[wo.priority as string] ?? '#9CA3AF'
        const sStyle  = STATUS_STYLE[wo.status as string] ?? ''

        return `
      <tr${overdue ? ' style="background:#FFF5F5"' : ''}>
        <td style="font-family:monospace;font-weight:600;color:#1E3A5F">${esc(wo.order_number as string)}</td>
        <td>${esc(prod?.name ?? '—')}</td>
        <td style="text-align:right;font-family:monospace">${fmt(Number(wo.quantity))} ${esc(prod?.unit ?? '')}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600">
            <span style="width:7px;height:7px;border-radius:50%;background:${priColor};display:inline-block"></span>
            ${esc((wo.priority as string).charAt(0).toUpperCase() + (wo.priority as string).slice(1))}
          </span>
        </td>
        <td>
          <span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;${sStyle}">
            ${esc(STATUS_LABEL[wo.status as string] ?? wo.status as string)}
          </span>
        </td>
        <td style="${overdue ? 'color:#EF4444;font-weight:600' : 'color:#6B7280'}">${fmtDate(wo.scheduled_end as string | null)}</td>
      </tr>`
      }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Production Report · ${esc(reportDate)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #111827;
      background: #F9FAFB;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
      background: #fff;
      min-height: 100vh;
    }

    /* ── Print toolbar ── */
    .print-toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
      gap: 8px;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #1E3A5F;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-print:hover { background: #16305A; }

    /* ── Report header ── */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 16px;
      margin-bottom: 24px;
      border-bottom: 2.5px solid #1E3A5F;
    }
    .report-title { font-size: 22px; font-weight: 800; color: #1E3A5F; letter-spacing: -0.3px; }
    .report-subtitle { font-size: 12px; color: #6B7280; margin-top: 3px; }
    .report-brand { text-align: right; }
    .brand-name { font-size: 13px; font-weight: 700; color: #1E3A5F; }
    .brand-sub  { font-size: 10px; color: #9CA3AF; margin-top: 2px; }

    /* ── Summary cards ── */
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .card {
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 16px;
    }
    .card-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #9CA3AF;
    }
    .card-value {
      font-size: 30px;
      font-weight: 800;
      color: #111827;
      margin-top: 6px;
      line-height: 1;
    }
    .card-value.accent-green { color: #059669; }
    .card-value.accent-red   { color: #DC2626; }

    /* ── Sections ── */
    .section { margin-bottom: 28px; }
    .section-header {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #1E3A5F;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-header::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #E5E7EB;
    }

    /* ── Tables ── */
    .tbl-wrap { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #F9FAFB;
      padding: 9px 14px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6B7280;
      text-align: left;
      border-bottom: 1px solid #E5E7EB;
      white-space: nowrap;
    }
    tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 12.5px;
      color: #374151;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #FAFAFA; }

    /* ── Footer ── */
    .report-footer {
      margin-top: 40px;
      padding-top: 14px;
      border-top: 1px solid #E5E7EB;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #9CA3AF;
    }

    /* ── Print overrides ── */
    @media print {
      @page { margin: 18mm 14mm; size: A4 portrait; }
      body { background: #fff; font-size: 11px; }
      .page { padding: 0; min-height: unset; }
      .print-toolbar { display: none !important; }
      .card-value { font-size: 24px; }
      .cards { grid-template-columns: repeat(4, 1fr); }
      tbody tr:hover td { background: transparent; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Print toolbar (hidden on print) -->
    <div class="print-toolbar">
      <button class="btn-print" onclick="window.print()">
        &#128424; Print / Save as PDF
      </button>
    </div>

    <!-- Report header -->
    <div class="report-header">
      <div>
        <div class="report-title">Daily Production Report</div>
        <div class="report-subtitle">${esc(reportDate)}</div>
      </div>
      <div class="report-brand">
        <div class="brand-name">ShopFloor AI</div>
        <div class="brand-sub">Manufacturing Execution System</div>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="cards">
      <div class="card">
        <div class="card-label">Orders Completed</div>
        <div class="card-value${completedCount > 0 ? ' accent-green' : ''}">${completedCount}</div>
      </div>
      <div class="card">
        <div class="card-label">Total Units Produced</div>
        <div class="card-value">${fmt(totalUnits)}</div>
      </div>
      <div class="card">
        <div class="card-label">Active Orders</div>
        <div class="card-value">${pending.length}</div>
      </div>
      <div class="card">
        <div class="card-label">Overdue Orders</div>
        <div class="card-value${overdueCount > 0 ? ' accent-red' : ' accent-green'}">${overdueCount}</div>
      </div>
    </div>

    <!-- Production by product -->
    <div class="section">
      <div class="section-header">Production Output by Product</div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align:center">Orders</th>
              <th style="text-align:right">Qty Produced</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>${prodRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Materials consumed -->
    <div class="section">
      <div class="section-header">Materials Consumed Today</div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th style="text-align:right">Qty Consumed</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>${matRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Pending orders -->
    <div class="section">
      <div class="section-header">Active &amp; Pending Orders (${pending.length})</div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Product</th>
              <th style="text-align:right">Quantity</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Target Date</th>
            </tr>
          </thead>
          <tbody>${pendingRows}</tbody>
        </table>
      </div>
      ${overdueCount > 0 ? `<p style="margin-top:8px;font-size:11px;color:#EF4444">&#9888; ${overdueCount} order${overdueCount !== 1 ? 's are' : ' is'} past target date (highlighted above).</p>` : ''}
    </div>

    <!-- Footer -->
    <div class="report-footer">
      <span>Generated: ${esc(generatedAt)}</span>
      <span>ShopFloor AI &middot; Portfolio Demo</span>
    </div>

  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
