// T1/T10 timing: node scripts/measure-hub.mjs <base-url> /path [/path...]. Two loads per path, cold then warm.
import { chromium } from '@playwright/test'
const B = process.argv[2]
const pages = process.argv.slice(3)
const b = await chromium.launch()
for (const path of pages) {
  const out = []
  const ctx = await b.newContext()
  for (const run of ['first', 'second']) {
    const p = await ctx.newPage()
    const api = []
    p.on('requestfinished', async (r) => { if (r.url().includes('/api/')) { const t = r.timing(); api.push(Math.round(t.responseEnd)) } })
    let bytes = 0
    p.on('response', async (r) => { try { const h = await r.headerValue('content-length'); bytes += Number(h || 0) } catch {} })
    const t0 = Date.now()
    const doc = await p.goto(B + path, { waitUntil: 'domcontentloaded' })
    const gh = (await doc?.headerValue('x-hub-github-calls')) ?? '?'
    const dcl = Date.now() - t0
    await p.waitForLoadState('networkidle', { timeout: 60000 })
    const idle = Date.now() - t0
    const lcp = await p.evaluate(() => new Promise((res) => { new PerformanceObserver((l) => { const e = l.getEntries(); res(Math.round(e[e.length - 1]?.startTime ?? -1)) }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => res(-1), 1000) }))
    out.push(`${run}: dcl ${dcl}ms, lcp ${lcp}ms, settled ${idle}ms, api calls ${api.length} (slowest ${Math.max(0, ...api)}ms), github ${gh}, status ${doc?.status()}`)
    await p.close()
  }
  console.log(path, '\n  ' + out.join('\n  '))
  await ctx.close()
}
await b.close()
