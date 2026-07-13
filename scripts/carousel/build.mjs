// Build the marketing carousel PDF + OG image from the live seeded demo.
// Playwright captures each screen at a fixed mobile viewport, then we
// composite each capture into a 1200x1500 slide and assemble a PDF.
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { jsPDF } = require('jspdf')

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const BASE = 'http://localhost:4173/mshmaroti/'
const URL_LABEL = 'tameradawi.github.io/mshmaroti'

// Mobile capture size. The slide phone-frame inner <img> is sized to this exact
// aspect ratio, so nothing is ever clipped mid-button.
const VW = 390
const VH = 844

const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`

async function newAppContext(browser, theme) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })
  await ctx.addInitScript((th) => {
    try {
      sessionStorage.setItem('mshmaroti-demo', '1')
      localStorage.setItem('mshmaroti-theme', th)
    } catch (e) { /* ignore */ }
  }, theme)
  return ctx
}

async function settle(page, ms = 1600) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }) } catch { /* fonts */ }
  // Hide the demo banner for cleaner mockups (persists across SPA tab switches).
  await page.addStyleTag({ content: '[data-demo-banner]{display:none!important}' })
  await page.waitForTimeout(ms)
}

async function scrollTo(page, text) {
  const el = page.getByText(text, { exact: false }).first()
  await el.evaluate((node) => node.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(900)
}

async function clickTab(page, index) {
  await page.locator('[role="tab"]').nth(index).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1300)
}

async function capture() {
  const browser = await chromium.launch()
  const shots = {}

  // ---- light run ----
  let ctx = await newAppContext(browser, 'light')
  let page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await settle(page)
  shots.dashboard = await page.screenshot()

  await scrollTo(page, 'שכר שעתי אפקטיבי')
  shots.effrate = await page.screenshot()

  await scrollTo(page, 'ברוטו מול נטו')
  shots.grossnet = await page.screenshot()

  await clickTab(page, 2) // history
  shots.history = await page.screenshot()

  await clickTab(page, 3) // report
  shots.report = await page.screenshot()
  await ctx.close()

  // ---- dark run ----
  ctx = await newAppContext(browser, 'dark')
  page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await settle(page)
  shots.dark = await page.screenshot()
  await ctx.close()

  await browser.close()
  // keep copies for inspection
  for (const [k, v] of Object.entries(shots)) writeFileSync(join(outDir, `app-${k}.png`), v)
  return shots
}

// ---------------- slide composition ----------------
const CSS = `
  * { margin:0; box-sizing:border-box; }
  body {
    width:1200px; height:1500px; overflow:hidden;
    font-family:'Segoe UI', system-ui, -apple-system, sans-serif;
    color:#fefae0;
    background:
      radial-gradient(1000px 600px at 85% 0%, rgba(96,108,56,.35), transparent 60%),
      radial-gradient(900px 700px at 0% 100%, rgba(188,108,37,.22), transparent 60%),
      #17200f;
    display:flex; flex-direction:column; align-items:center;
  }
  .kicker { font-size:22px; font-weight:800; letter-spacing:4px; text-transform:uppercase; color:#dda15e; }
  .head { padding:104px 96px 0; text-align:center; }
  .head h1 { font-size:66px; font-weight:800; letter-spacing:-1.5px; line-height:1.06; margin-top:14px; }
  .head p { font-size:29px; font-weight:500; color:#cfc9a6; margin-top:20px; line-height:1.4; }
  .stage { flex:1; display:flex; align-items:center; justify-content:center; width:100%; }
  .phone { width:452px; padding:15px; background:#0e1408; border-radius:48px;
           box-shadow:0 50px 90px -20px rgba(0,0,0,.6); border:1px solid rgba(255,255,255,.08); }
  .phone img { width:100%; display:block; border-radius:34px; }
  .footer { padding-bottom:60px; font-size:24px; letter-spacing:1px; color:#a7a079; font-weight:600; }
  .closer { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:26px; padding:0 120px; }
  .closer h1 { font-size:82px; font-weight:800; letter-spacing:-2px; }
  .closer .url { font-size:40px; font-weight:800; color:#dda15e; }
  .closer p { font-size:28px; color:#cfc9a6; }
  .pill { display:inline-block; margin-top:8px; font-size:22px; color:#cfc9a6; border:1px solid rgba(255,255,255,.16);
          border-radius:999px; padding:12px 26px; }
`

function phoneSlide({ kicker, headline, sub, img }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="head"><div class="kicker">${kicker}</div><h1>${headline}</h1><p>${sub}</p></div>
    <div class="stage"><div class="phone"><img src="${img}"/></div></div>
    <div class="footer">${URL_LABEL}</div>
  </body></html>`
}

function closerSlide() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="closer">
      <div class="kicker">Live demo</div>
      <h1>Try it — no signup.</h1>
      <p>Tap <b style="color:#fefae0">"כניסה למצב הדגמה"</b> to explore a full seeded month.</p>
      <div class="url">${URL_LABEL}</div>
      <div><span class="pill">React + TypeScript</span> <span class="pill">Supabase</span> <span class="pill">33 unit tests</span></div>
    </div>
    <div class="footer">Built by Tamer Adawi</div>
  </body></html>`
}

function ogHTML(img) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; box-sizing:border-box; }
    body { width:1200px; height:630px; overflow:hidden; display:flex; align-items:center; gap:56px; padding:0 72px;
      font-family:'Segoe UI', system-ui, sans-serif; color:#fefae0;
      background: radial-gradient(800px 500px at 90% 10%, rgba(96,108,56,.4), transparent 60%), #17200f; }
    .l { flex:1; }
    .l .k { font-size:20px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:#dda15e; }
    .l h1 { font-size:60px; font-weight:800; letter-spacing:-1.5px; margin-top:12px; line-height:1.05; }
    .l p { font-size:26px; color:#cfc9a6; margin-top:16px; line-height:1.4; }
    .l .u { font-size:24px; font-weight:800; color:#dda15e; margin-top:22px; }
    .r { width:300px; padding:11px; background:#0e1408; border-radius:36px; border:1px solid rgba(255,255,255,.08);
      box-shadow:0 30px 60px -15px rgba(0,0,0,.6); }
    .r img { width:100%; display:block; border-radius:26px; }
  </style></head><body>
    <div class="l">
      <div class="k">Mshmaroti · משמרותי</div>
      <h1>Payroll-accurate shift tracking.</h1>
      <p>Israeli labour-law overtime, Shabbat premiums and deductions — computed per shift, for two-job waitressing.</p>
      <div class="u">${URL_LABEL}</div>
    </div>
    <div class="r"><img src="${img}"/></div>
  </body></html>`
}

async function renderPage(browser, html, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } })
  await ctx.close()
  return buf
}

async function main() {
  const shots = await capture()

  const slides = [
    phoneSlide({ kicker: 'Mshmaroti · משמרותי', headline: 'A shift tracker that gets the pay right.', sub: 'Two waitressing jobs, one honest number: what you actually earn per hour of your life.', img: b64(shots.dashboard) }),
    phoneSlide({ kicker: 'The payroll engine', headline: 'Israeli labour law, per shift.', sub: 'Daily overtime tiers, the Saturday-night Shabbat premium, and mandatory deductions — worked out to the shekel.', img: b64(shots.grossnet) }),
    phoneSlide({ kicker: 'Analytics', headline: 'Which job actually pays more?', sub: 'Effective ₪/hour across both jobs, month over month, in a bento dashboard.', img: b64(shots.effrate) }),
    phoneSlide({ kicker: 'History', headline: 'A month at a glance.', sub: 'An earnings heat-map calendar; tap any day to filter.', img: b64(shots.history) }),
    phoneSlide({ kicker: 'Reports', headline: 'Per-job PDF reports.', sub: 'Separate wedding-hall and restaurant reports, with the 125/150/175/200% hour breakdown.', img: b64(shots.report) }),
    phoneSlide({ kicker: 'Details', headline: 'Light & dark, true RTL.', sub: 'Hebrew-first, installable PWA, reduced-motion aware.', img: b64(shots.dark) }),
    closerSlide(),
  ]

  const browser = await chromium.launch()
  const doc = new jsPDF({ unit: 'px', format: [1200, 1500], compress: true })
  for (let i = 0; i < slides.length; i++) {
    const png = await renderPage(browser, slides[i], 1200, 1500)
    writeFileSync(join(outDir, `slide-${i + 1}.png`), png)
    if (i > 0) doc.addPage([1200, 1500], 'portrait')
    doc.addImage(b64(png), 'PNG', 0, 0, 1200, 1500)
  }
  writeFileSync(join(repoRoot, 'mshmaroti-carousel.pdf'), Buffer.from(doc.output('arraybuffer')))
  console.log('wrote mshmaroti-carousel.pdf', slides.length, 'pages')

  // OG image
  const og = await renderPage(browser, ogHTML(b64(shots.dashboard)), 1200, 630)
  mkdirSync(join(repoRoot, 'public'), { recursive: true })
  writeFileSync(join(repoRoot, 'public', 'og-image.png'), og)
  console.log('wrote public/og-image.png')

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
