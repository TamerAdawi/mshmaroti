import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Shift } from '../types'
import { HEBREW_FONT_REGULAR, HEBREW_FONT_BOLD } from './hebrewFont'
import type { Settings } from './settings'
import { aggregate, jobSplit, filterByDateRange } from './calc'
import { calcMonthlyBreakdown, monthlyRestaurantTiers } from './payroll'
import { t } from '../strings'

export interface ReportOptions {
  monthOffset: number // 0 = current, -1 = last month
  job: 'all' | 'wedding' | 'hourly' // scope the report to one job (or both)
  includeSummary: boolean
  includeJobBreakdown: boolean
  includeDeductions: boolean
  includeHourTiers: boolean
  includeEffectiveRate: boolean
  includeShifts: boolean
  includeTimes: boolean
  includeTips: boolean
  includeExpenses: boolean
  includeNotes: boolean
}

// Brand colors (RGB for jsPDF) — earthy palette
const COLORS = {
  indigo: [96, 108, 56] as [number, number, number], // olive
  violet: [221, 161, 94] as [number, number, number], // tan
  pink: [188, 108, 37] as [number, number, number], // burnt orange
  coral: [188, 108, 37] as [number, number, number], // burnt orange
  lime: [111, 125, 51] as [number, number, number], // green
  ink: [40, 54, 24] as [number, number, number], // dark green
  body: [74, 80, 53] as [number, number, number],
  muted: [138, 130, 95] as [number, number, number],
  line: [230, 220, 192] as [number, number, number],
  bg: [254, 250, 224] as [number, number, number], // cream
}

/** Reverse a string so jsPDF renders RTL Hebrew correctly. jsPDF doesn't support BiDi. */
function rev(s: string | number): string {
  const str = String(s)
  // Don't reverse numbers/latin — only Hebrew text
  // Simple heuristic: if any Hebrew char, reverse the whole string for RTL rendering
  if (/[\u0590-\u05FF]/.test(str)) {
    return str.split('').reverse().join('')
  }
  return str
}

/** Format currency in a PDF-safe way (no RTL issues). */
function fmtPdfIls(n: number): string {
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(n)} ILS`
}

function fmtPdfHours(h: number): string {
  const r = Math.round(h * 10) / 10
  return `${r}h`
}

function fmtPdfDate(iso: string): string {
  // Keep date numeric to avoid Hebrew month name bidi issues
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function monthRange(offset: number): { from: string; to: string; label: string } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const iso = (dd: Date) =>
    `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
  const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(first)
  return { from: iso(first), to: iso(last), label: monthName }
}

export async function generateReport(
  shifts: Shift[],
  settings: Settings,
  options: ReportOptions,
): Promise<Blob> {
  const range = monthRange(options.monthOffset)
  let filtered = filterByDateRange(shifts, range.from, range.to)
  if (options.job !== 'all') filtered = filtered.filter((s) => s.jobType === options.job)
  filtered = filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return a.createdAt - b.createdAt
  })

  // A4 portrait in mm
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // Register Hebrew fonts
  doc.addFileToVFS('NotoSansHebrew-Regular.ttf', HEBREW_FONT_REGULAR)
  doc.addFont('NotoSansHebrew-Regular.ttf', 'Hebrew', 'normal')
  doc.addFileToVFS('NotoSansHebrew-Bold.ttf', HEBREW_FONT_BOLD)
  doc.addFont('NotoSansHebrew-Bold.ttf', 'Hebrew', 'bold')
  doc.setFont('Hebrew', 'normal')

  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 15
  let y = 18

  // ===== HEADER — gradient band =====
  drawGradientBand(doc, 0, 0, pageW, 38)

  // App name (Hebrew) — right side for RTL feel
  doc.setTextColor(255, 255, 255)
  doc.setFont('Hebrew', 'bold')
  doc.setFontSize(22)
  doc.text(rev('משמרותי'), pageW - marginX, 17, { align: 'right' })

  // Subtitle — job scope of this report
  doc.setFont('Hebrew', 'normal')
  doc.setFontSize(10)
  const subtitle = options.job === 'wedding' ? settings.weddingName
    : options.job === 'hourly' ? settings.hourlyName
    : 'דוח חודשי'
  doc.text(rev(subtitle), pageW - marginX, 25, { align: 'right' })

  // Report period (left side)
  doc.setFontSize(9)
  // Two separate text calls avoids any bidi confusion
  const labelParts = range.label.split(' ')
  const monthPart = labelParts.find((p) => /[\u0590-\u05FF]/.test(p)) ?? ''
  const yearPart = labelParts.find((p) => /^\d+$/.test(p)) ?? ''
  // Render year and reversed-month on separate text calls so bidi doesn't confuse them
  doc.text(yearPart, marginX, 17)
  doc.text(rev(monthPart), marginX + 12, 17)
  doc.text(new Date().toLocaleDateString('en-GB'), marginX, 25)

  y = 48

  // ===== Empty state =====
  if (filtered.length === 0) {
    doc.setTextColor(...COLORS.muted)
    doc.setFont('Hebrew', 'normal')
    doc.setFontSize(14)
    doc.text(rev('אין נתונים בחודש זה'), pageW / 2, y + 40, { align: 'center' })
    doc.save()
    return doc.output('blob')
  }

  const agg = aggregate(filtered)
  const split = jobSplit(filtered)
  const breakdown = calcMonthlyBreakdown(filtered, settings)
  const expensesTotal = filtered.reduce((sum, s) => sum + (s.expenses ?? 0), 0)

  // ===== SUMMARY =====
  if (options.includeSummary) {
    sectionTitle(doc, rev(t.report.summary), marginX, y, pageW)
    y += 8

    // Up to 8 stat boxes laid out 4 per row.
    const summaryCells: Array<[string, string, [number, number, number]]> = [
      [rev(t.report.totalGross), fmtPdfIls(agg.total), COLORS.indigo],
      [rev(t.report.totalHours), fmtPdfHours(agg.hours), COLORS.violet],
      [rev(t.report.shiftCount), String(agg.count), COLORS.coral],
      [rev(t.report.avgPerHour), fmtPdfIls(agg.effectiveRate), COLORS.lime],
      [rev(t.report.totalTips), fmtPdfIls(agg.tips), COLORS.pink],
      [rev(t.report.totalExpenses), fmtPdfIls(expensesTotal), COLORS.coral],
      [rev(t.report.totalNet), fmtPdfIls(breakdown.totalNet), COLORS.indigo],
      [rev(t.report.avgPerShift), fmtPdfIls(agg.avgPerShift), COLORS.violet],
    ]

    const perRow = 4
    const boxW = (pageW - marginX * 2 - (perRow - 1) * 2) / perRow
    const boxH = 22
    summaryCells.forEach(([label, value, color], i) => {
      const col = i % perRow
      const rowIdx = Math.floor(i / perRow)
      const x = marginX + col * (boxW + 2)
      const by = y + rowIdx * (boxH + 2)
      // Box
      doc.setFillColor(...COLORS.bg)
      doc.setDrawColor(...COLORS.line)
      doc.roundedRect(x, by, boxW, boxH, 2, 2, 'FD')
      // Colored dot
      doc.setFillColor(...color)
      doc.circle(x + 3, by + 4, 1.3, 'F')
      // Label
      doc.setTextColor(...COLORS.muted)
      doc.setFont('Hebrew', 'normal')
      doc.setFontSize(8)
      doc.text(label, x + boxW - 2, by + 5, { align: 'right' })
      // Value — use regular Hebrew font (bold may lack Latin glyphs)
      doc.setTextColor(...COLORS.ink)
      doc.setFont('Hebrew', 'normal')
      doc.setFontSize(13)
      doc.text(value, x + boxW - 2, by + 15, { align: 'right' })
    })
    const rowsUsed = Math.ceil(summaryCells.length / perRow)
    y += rowsUsed * (boxH + 2) + 6
  }

  // ===== JOB BREAKDOWN (only when both jobs are in scope) =====
  if (options.includeJobBreakdown && options.job === 'all') {
    sectionTitle(doc, rev('פילוח לפי עבודה'), marginX, y, pageW)
    y += 8

    const jobs: Array<{ name: string; agg: typeof split.wedding; color: [number, number, number] }> = [
      { name: settings.weddingName, agg: split.wedding, color: COLORS.indigo },
      { name: settings.hourlyName, agg: split.hourly, color: COLORS.coral },
    ]

    jobs.forEach((job) => {
      if (job.agg.count === 0) return
      // Colored left bar
      doc.setFillColor(...job.color)
      doc.rect(marginX, y, 2, 20, 'F')
      // Box background
      doc.setFillColor(...COLORS.bg)
      doc.setDrawColor(...COLORS.line)
      doc.roundedRect(marginX + 2, y, pageW - marginX * 2 - 2, 20, 0, 0, 'FD')
      // Job name
      doc.setTextColor(...COLORS.ink)
      doc.setFont('Hebrew', 'bold')
      doc.setFontSize(11)
      doc.text(rev(job.name), pageW - marginX - 3, y + 6, { align: 'right' })
      // Totals line
      doc.setFont('Hebrew', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.body)
      const line = `${fmtPdfIls(job.agg.total)}   ${fmtPdfHours(job.agg.hours)}   ${job.agg.count} ${rev('משמרות')}`
      doc.text(line, pageW - marginX - 3, y + 13, { align: 'right' })
      // Effective rate chip
      doc.setTextColor(...job.color)
      doc.setFont('Hebrew', 'bold')
      doc.setFontSize(10)
      doc.text(`${fmtPdfIls(job.agg.effectiveRate)}/h`, marginX + 6, y + 13)
      y += 22
    })
    y += 4
  }

  // ===== DEDUCTIONS / NET =====
  if (options.includeDeductions && (breakdown.hourlyShifts > 0 || breakdown.weddingShifts > 0)) {
    if (y > 235) {
      doc.addPage()
      y = 20
    }
    sectionTitle(doc, rev(t.report.deductions), marginX, y, pageW)
    y += 8

    interface DedLine {
      header?: string
      label?: string
      value?: string
      color?: [number, number, number]
      bold?: boolean
      rule?: boolean
    }
    const lines: DedLine[] = []

    if (breakdown.hourlyShifts > 0) {
      lines.push({ header: settings.hourlyName })
      lines.push({ label: t.report.grossWages, value: fmtPdfIls(breakdown.hourlyWages), color: COLORS.ink })
      if (breakdown.hourlyTravel > 0)
        lines.push({ label: t.report.travel, value: `+${fmtPdfIls(breakdown.hourlyTravel)}`, color: COLORS.lime })
      if (breakdown.hourlyBituach > 0)
        lines.push({ label: t.report.bituach, value: `-${fmtPdfIls(breakdown.hourlyBituach)}  (${(settings.bituachRate * 100).toFixed(2)}%)`, color: COLORS.coral })
      if (breakdown.hourlyPension > 0)
        lines.push({ label: t.report.pension, value: `-${fmtPdfIls(breakdown.hourlyPension)}  (${(settings.pensionRate * 100).toFixed(1)}%)`, color: COLORS.coral })
      if (breakdown.hourlyTax > 0)
        lines.push({ label: t.report.incomeTax, value: `-${fmtPdfIls(breakdown.hourlyTax)}  (${(settings.incomeTaxRate * 100).toFixed(1)}%)`, color: COLORS.coral })
      const mandatory = breakdown.hourlyBituach + breakdown.hourlyPension + breakdown.hourlyTax
      if (mandatory > 0)
        lines.push({ label: t.report.mandatoryDeductions, value: `-${fmtPdfIls(mandatory)}`, color: COLORS.coral, rule: true })
      lines.push({ label: t.report.netWage, value: fmtPdfIls(breakdown.hourlyNet), color: COLORS.indigo, bold: true })
    }
    if (breakdown.weddingShifts > 0) {
      lines.push({ header: settings.weddingName })
      lines.push({ label: t.report.cashNoDeductions, value: fmtPdfIls(breakdown.weddingTotal), color: COLORS.ink, bold: true })
    }

    const rowH = 7
    const boxW = pageW - marginX * 2
    const boxH = lines.length * rowH + 6
    doc.setFillColor(...COLORS.bg)
    doc.setDrawColor(...COLORS.line)
    doc.roundedRect(marginX, y, boxW, boxH, 2, 2, 'FD')

    let ly = y + 7
    lines.forEach((ln) => {
      if (ln.rule) {
        doc.setDrawColor(...COLORS.line)
        doc.setLineWidth(0.2)
        doc.line(marginX + 4, ly - 4, marginX + boxW - 4, ly - 4)
      }
      if (ln.header) {
        doc.setTextColor(...COLORS.ink)
        doc.setFont('Hebrew', 'bold')
        doc.setFontSize(10)
        doc.text(rev(ln.header), marginX + boxW - 4, ly, { align: 'right' })
      } else {
        // Label on the right (RTL), value on the left (LTR numbers)
        doc.setTextColor(...COLORS.body)
        doc.setFont('Hebrew', ln.bold ? 'bold' : 'normal')
        doc.setFontSize(ln.bold ? 10 : 9)
        doc.text(rev(ln.label ?? ''), marginX + boxW - 4, ly, { align: 'right' })
        doc.setTextColor(...(ln.color ?? COLORS.body))
        doc.text(ln.value ?? '', marginX + 4, ly, { align: 'left' })
      }
      ly += rowH
    })
    y += boxH + 4

    // Combined net band when both jobs are present
    if (breakdown.hourlyShifts > 0 && breakdown.weddingShifts > 0) {
      drawGradientBand(doc, marginX, y, boxW, 12)
      doc.setTextColor(255, 255, 255)
      doc.setFont('Hebrew', 'bold')
      doc.setFontSize(10)
      doc.text(rev(t.report.combinedNet), pageW - marginX - 5, y + 7.5, { align: 'right' })
      doc.text(fmtPdfIls(breakdown.totalNet), marginX + 5, y + 7.5, { align: 'left' })
      y += 16
    }
  }

  // ===== RESTAURANT HOUR TIERS (days, hours, OT/rest-day multipliers) =====
  const tiers = monthlyRestaurantTiers(filtered, settings)
  if (options.includeHourTiers && tiers.shifts > 0) {
    if (y > 235) {
      doc.addPage()
      y = 20
    }
    sectionTitle(doc, rev(t.report.hourTiersTitle), marginX, y, pageW)
    y += 8

    interface TierLine { label: string; value: string; color?: [number, number, number]; bold?: boolean; rule?: boolean }
    const rows: TierLine[] = [
      { label: t.report.days, value: String(tiers.days) },
      { label: t.report.shifts, value: String(tiers.shifts) },
      { label: t.report.totalHours, value: fmtPdfHours(tiers.totalHours), bold: true },
    ]
    // Buckets are computed from the OT threshold and the configured rest-day rate,
    // so the rows here follow whatever rates were actually paid.
    // Percentage lives in the LTR value (right-side Hebrew labels get reversed).
    const tierPalette: Array<[number, number, number]> = [
      COLORS.body, COLORS.violet, COLORS.coral, COLORS.pink, COLORS.pink,
    ]
    let firstTier = true
    tiers.tiers.forEach((bucket, i) => {
      if (bucket.hours <= 0.001) return
      const label = bucket.restDay
        ? t.report.restDayHours
        : bucket.mult > 1.0
          ? t.report.overtimeHours
          : t.report.regularHours
      const pct = Math.round(bucket.mult * 100)
      rows.push({
        label,
        value: `${fmtPdfHours(bucket.hours)}  (${pct}%)`,
        color: tierPalette[Math.min(i, tierPalette.length - 1)],
        rule: firstTier,
      })
      firstTier = false
    })
    if (tiers.overrideHours > 0.001) {
      rows.push({ label: t.report.manualMultiplier, value: fmtPdfHours(tiers.overrideHours), color: COLORS.body, rule: firstTier })
    }

    const rowH = 7
    const boxW = pageW - marginX * 2
    const boxH = rows.length * rowH + 6
    doc.setFillColor(...COLORS.bg)
    doc.setDrawColor(...COLORS.line)
    doc.roundedRect(marginX, y, boxW, boxH, 2, 2, 'FD')

    let ly = y + 7
    rows.forEach((ln) => {
      if (ln.rule) {
        doc.setDrawColor(...COLORS.line)
        doc.setLineWidth(0.2)
        doc.line(marginX + 4, ly - 4, marginX + boxW - 4, ly - 4)
      }
      doc.setTextColor(...COLORS.body)
      doc.setFont('Hebrew', ln.bold ? 'bold' : 'normal')
      doc.setFontSize(ln.bold ? 10 : 9)
      doc.text(rev(ln.label), marginX + boxW - 4, ly, { align: 'right' })
      doc.setTextColor(...(ln.color ?? COLORS.body))
      doc.text(ln.value, marginX + 4, ly, { align: 'left' })
      ly += rowH
    })
    y += boxH + 6
  }

  // ===== EFFECTIVE RATE COMPARISON (only when both jobs are in scope) =====
  if (options.includeEffectiveRate && options.job === 'all' && split.wedding.effectiveRate > 0 && split.hourly.effectiveRate > 0) {
    sectionTitle(doc, rev('שכר שעתי אפקטיבי'), marginX, y, pageW)
    y += 8

    const wRate = split.wedding.effectiveRate
    const hRate = split.hourly.effectiveRate
    const winner = wRate >= hRate ? 'wedding' : 'hourly'
    const diff = Math.abs(wRate - hRate)
    const winnerName = winner === 'wedding' ? settings.weddingName : settings.hourlyName

    // Visual bars
    const maxRate = Math.max(wRate, hRate)
    const barAreaW = pageW - marginX * 2 - 60
    const rows = [
      { name: settings.weddingName, rate: wRate, color: COLORS.indigo, isWin: winner === 'wedding' },
      { name: settings.hourlyName, rate: hRate, color: COLORS.coral, isWin: winner === 'hourly' },
    ]
    rows.forEach((r) => {
      // Job name
      doc.setTextColor(...COLORS.ink)
      doc.setFont('Hebrew', 'bold')
      doc.setFontSize(10)
      doc.text(rev(r.name) + (r.isWin ? ' *' : ''), pageW - marginX, y + 4, { align: 'right' })
      // Rate value
      doc.setTextColor(...r.color)
      doc.setFont('Hebrew', 'bold')
      doc.setFontSize(11)
      doc.text(`${fmtPdfIls(r.rate)}/h`, marginX + 5, y + 4)
      // Bar track
      const barY = y + 6
      const barX = marginX + 50
      doc.setFillColor(...COLORS.line)
      doc.roundedRect(barX, barY, barAreaW, 3, 1, 1, 'F')
      // Bar fill
      doc.setFillColor(...r.color)
      const fillW = (r.rate / maxRate) * barAreaW
      doc.roundedRect(barX, barY, fillW, 3, 1, 1, 'F')
      y += 13
    })

    // Winner banner
    y += 2
    drawGradientBand(doc, marginX, y, pageW - marginX * 2, 12, true)
    doc.setTextColor(255, 255, 255)
    doc.setFont('Hebrew', 'bold')
    doc.setFontSize(10)
    // Render as two pieces: Hebrew phrase (reversed for RTL) on right, LTR amount on left
    const amountStr = `+${fmtPdfIls(diff)}/h`
    const phraseStr = `${rev('משתלמת יותר ב')} ${rev(winnerName)}`
    doc.text(phraseStr, pageW - marginX - 5, y + 7.5, { align: 'right' })
    doc.text(amountStr, marginX + 5, y + 7.5, { align: 'left' })
    y += 16
  }

  // ===== SHIFTS TABLE =====
  if (options.includeShifts) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    sectionTitle(doc, rev('משמרות'), marginX, y, pageW)
    y += 6

    const headCells = [rev(t.report.colDate), rev(t.report.colJob)]
    if (options.includeTimes) headCells.push(rev(t.report.colTime))
    headCells.push(rev(t.report.colHours), rev(t.report.colBase))
    if (options.includeTips) headCells.push(rev(t.report.colTips))
    if (options.includeExpenses) headCells.push(rev(t.report.colExpenses))
    headCells.push(rev(t.report.colTotal))
    if (options.includeNotes) headCells.push(rev(t.report.colNotes))

    const body = filtered.map((s) => {
      const jobName = s.jobType === 'wedding' ? settings.weddingName : settings.hourlyName
      // Show multiplier indicator in base column when != 1.0
      const mult = s.rateMultiplier ?? 1.0
      const baseCell = mult !== 1.0 && s.jobType === 'hourly'
        ? `${fmtPdfIls(s.base)} (x${mult})`
        : fmtPdfIls(s.base)
      const totalCell = fmtPdfIls(s.total)
      // Show unpaid break alongside paid hours
      const brk = s.breakMinutes ?? 0
      const hoursCell = brk > 0 ? `${fmtPdfHours(s.hours)} (-${brk}m)` : fmtPdfHours(s.hours)
      const timeCell = s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : '—'
      const row: Array<string> = [fmtPdfDate(s.date), rev(jobName)]
      if (options.includeTimes) row.push(timeCell)
      row.push(hoursCell, baseCell)
      if (options.includeTips) row.push(fmtPdfIls(s.tips))
      if (options.includeExpenses) row.push(fmtPdfIls(s.expenses ?? 0))
      row.push(totalCell)
      if (options.includeNotes) row.push(s.notes ? rev(s.notes) : '—')
      return row
    })

    const columnStyles: { [k: number]: { halign: 'left' | 'center' | 'right' } } = {
      0: { halign: 'center' },
      1: { halign: 'right' },
    }
    if (options.includeTimes) columnStyles[2] = { halign: 'center' }

    autoTable(doc, {
      head: [headCells],
      body,
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: {
        font: 'Hebrew',
        fontSize: 8,
        cellPadding: 2,
        textColor: COLORS.body,
        lineColor: COLORS.line,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: COLORS.indigo,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: { fillColor: COLORS.bg },
      columnStyles,
    })
  }

  // ===== FOOTER on all pages =====
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setTextColor(...COLORS.muted)
    doc.setFont('Hebrew', 'normal')
    doc.setFontSize(7)
    // Left: generated by — full credit
    doc.text('Mshmaroti · built by Tamer Adawi · linkedin.com/in/tamer-adawi-36a6a91a6', marginX, pageH - 8)
    // Right: page x of y
    doc.text(`${p} / ${totalPages}`, pageW - marginX, pageH - 8, { align: 'right' })
  }

  return doc.output('blob')
}

// ==================== helpers ====================

function sectionTitle(doc: jsPDF, textRev: string, x: number, y: number, pageW: number) {
  doc.setTextColor(...COLORS.ink)
  doc.setFont('Hebrew', 'bold')
  doc.setFontSize(12)
  doc.text(textRev, pageW - x, y, { align: 'right' })
  // Underline accent
  doc.setDrawColor(...COLORS.indigo)
  doc.setLineWidth(0.6)
  doc.line(pageW - x - 20, y + 1.5, pageW - x, y + 1.5)
}

/** Draw a gradient band simulating the indigo→violet→pink brand gradient. */
function drawGradientBand(doc: jsPDF, x: number, y: number, w: number, h: number, rounded = false) {
  // jsPDF doesn't support native gradients; simulate with 80 vertical strips
  const strips = 80
  const sw = w / strips
  for (let i = 0; i < strips; i++) {
    const t = i / strips
    let r: number, g: number, b: number
    if (t < 0.5) {
      // olive #606c38 → tan #dda15e
      const u = t * 2
      r = Math.round(96 + (221 - 96) * u)
      g = Math.round(108 + (161 - 108) * u)
      b = Math.round(56 + (94 - 56) * u)
    } else {
      // tan #dda15e → burnt orange #bc6c25
      const u = (t - 0.5) * 2
      r = Math.round(221 + (188 - 221) * u)
      g = Math.round(161 + (108 - 161) * u)
      b = Math.round(94 + (37 - 94) * u)
    }
    doc.setFillColor(r, g, b)
    doc.rect(x + i * sw, y, sw + 0.3, h, 'F')
  }
  if (rounded) {
    // Mask corners by drawing tiny white triangles (cheap rounded effect skipped; keep as-is)
  }
}
