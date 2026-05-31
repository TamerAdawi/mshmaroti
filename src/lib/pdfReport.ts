import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Shift } from '../types'
import { HEBREW_FONT_REGULAR, HEBREW_FONT_BOLD } from './hebrewFont'
import type { Settings } from './settings'
import { aggregate, jobSplit } from './calc'
import { filterByDateRange } from './calc'

export interface ReportOptions {
  monthOffset: number // 0 = current, -1 = last month
  includeSummary: boolean
  includeJobBreakdown: boolean
  includeEffectiveRate: boolean
  includeShifts: boolean
  includeTips: boolean
  includeExpenses: boolean
  includeNotes: boolean
}

// Brand colors (RGB for jsPDF)
const COLORS = {
  indigo: [99, 102, 241] as [number, number, number],
  violet: [168, 85, 247] as [number, number, number],
  pink: [236, 72, 153] as [number, number, number],
  coral: [251, 113, 133] as [number, number, number],
  lime: [132, 204, 22] as [number, number, number],
  ink: [15, 16, 32] as [number, number, number],
  body: [61, 66, 88] as [number, number, number],
  muted: [138, 143, 168] as [number, number, number],
  line: [229, 231, 240] as [number, number, number],
  bg: [250, 251, 255] as [number, number, number],
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
  const filtered = filterByDateRange(shifts, range.from, range.to).sort((a, b) => {
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

  // Subtitle
  doc.setFont('Hebrew', 'normal')
  doc.setFontSize(10)
  doc.text(rev('דוח חודשי'), pageW - marginX, 25, { align: 'right' })

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

  // ===== SUMMARY =====
  if (options.includeSummary) {
    sectionTitle(doc, rev('סיכום'), marginX, y, pageW)
    y += 8

    const summaryRows: Array<[string, string, [number, number, number]]> = [
      [rev('סך ברוטו'), fmtPdfIls(agg.total), COLORS.indigo],
      [rev('סך שעות'), fmtPdfHours(agg.hours), COLORS.violet],
      [rev('משמרות'), String(agg.count), COLORS.coral],
      [rev('ממוצע לשעה'), fmtPdfIls(agg.effectiveRate), COLORS.lime],
    ]

    const boxW = (pageW - marginX * 2 - 6) / 4
    const boxH = 22
    summaryRows.forEach(([label, value, color], i) => {
      const x = marginX + i * (boxW + 2)
      // Box
      doc.setFillColor(...COLORS.bg)
      doc.setDrawColor(...COLORS.line)
      doc.roundedRect(x, y, boxW, boxH, 2, 2, 'FD')
      // Colored dot
      doc.setFillColor(...color)
      doc.circle(x + 3, y + 4, 1.3, 'F')
      // Label
      doc.setTextColor(...COLORS.muted)
      doc.setFont('Hebrew', 'normal')
      doc.setFontSize(8)
      doc.text(label, x + boxW - 2, y + 5, { align: 'right' })
      // Value — use regular Hebrew font (bold may lack Latin glyphs)
      doc.setTextColor(...COLORS.ink)
      doc.setFont('Hebrew', 'normal')
      doc.setFontSize(14)
      doc.text(value, x + boxW - 2, y + 15, { align: 'right' })
    })
    y += boxH + 8
  }

  // ===== JOB BREAKDOWN =====
  if (options.includeJobBreakdown) {
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
      const line = `${fmtPdfIls(job.agg.total)}  ·  ${fmtPdfHours(job.agg.hours)}  ·  ${job.agg.count} ${rev('משמרות')}`
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

  // ===== EFFECTIVE RATE COMPARISON =====
  if (options.includeEffectiveRate && split.wedding.effectiveRate > 0 && split.hourly.effectiveRate > 0) {
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
      doc.text(rev(r.name) + (r.isWin ? ' ★' : ''), pageW - marginX, y + 4, { align: 'right' })
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

    const headCells = [rev('תאריך'), rev('עבודה'), rev('שעות'), rev('בסיס')]
    if (options.includeTips) headCells.push(rev('טיפים'))
    if (options.includeExpenses) headCells.push(rev('הוצאות'))
    headCells.push(rev('סך הכל'))
    if (options.includeNotes) headCells.push(rev('הערות'))

    const body = filtered.map((s) => {
      const jobName = s.jobType === 'wedding' ? settings.weddingName : settings.hourlyName
      // Show multiplier indicator in base column when != 1.0
      const mult = s.rateMultiplier ?? 1.0
      const baseCell = mult !== 1.0 && s.jobType === 'hourly'
        ? `${fmtPdfIls(s.base)} (×${mult})`
        : fmtPdfIls(s.base)
      // Tips winner indicator: for hourly shifts where tips > base, mark with ★
      const tipsWon = s.jobType === 'hourly' && s.tips > s.base
      const totalCell = tipsWon ? `${fmtPdfIls(s.total)} ★` : fmtPdfIls(s.total)
      const row: Array<string> = [
        fmtPdfDate(s.date),
        rev(jobName),
        fmtPdfHours(s.hours),
        baseCell,
      ]
      if (options.includeTips) row.push(fmtPdfIls(s.tips))
      if (options.includeExpenses) row.push(fmtPdfIls(s.expenses ?? 0))
      row.push(totalCell)
      if (options.includeNotes) row.push(s.notes ? rev(s.notes) : '—')
      return row
    })

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
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'right' } },
    })

    // Legend if any tips-won shifts in the period
    const hasTipsWon = filtered.some(s => s.jobType === 'hourly' && s.tips > s.base)
    if (hasTipsWon) {
      const tableEnd = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y
      doc.setTextColor(...COLORS.muted)
      doc.setFont('Hebrew', 'normal')
      doc.setFontSize(7)
      doc.text(rev('טיפים גבוהים מהחישוב השעתי - חוק שירות וטיפים') + ' = ★', pageW - marginX, tableEnd + 4, { align: 'right' })
    }
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
      const u = t * 2
      r = Math.round(99 + (168 - 99) * u)
      g = Math.round(102 + (85 - 102) * u)
      b = Math.round(241 + (247 - 241) * u)
    } else {
      const u = (t - 0.5) * 2
      r = Math.round(168 + (236 - 168) * u)
      g = Math.round(85 + (72 - 85) * u)
      b = Math.round(247 + (153 - 247) * u)
    }
    doc.setFillColor(r, g, b)
    doc.rect(x + i * sw, y, sw + 0.3, h, 'F')
  }
  if (rounded) {
    // Mask corners by drawing tiny white triangles (cheap rounded effect skipped; keep as-is)
  }
}
