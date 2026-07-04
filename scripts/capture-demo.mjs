#!/usr/bin/env node
/**
 * Captures screenshots of pc-ctx-web UI in demo mode.
 * Run: node scripts/capture-demo.mjs
 * Requires: playwright (npm install @playwright/test)
 *
 * Output: screenshots/ directory with PNG files
 */

import { chromium } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'screenshots')

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const DEMO_URL = process.env.DEMO_URL || 'http://localhost:5173'

const PAGES = [
  { path: '/?demo=true', name: '01-dashboard', wait: '[data-testid="dashboard"]' },
  { path: '/plans?demo=true', name: '02-plans-list', wait: 'text=Auth:' },
  { path: '/plans/auth-email-verification-password-reset-social-login?demo=true', name: '03-plan-detail', wait: 'text=Tasks' },
  { path: '/roadmaps?demo=true', name: '04-roadmaps', wait: 'text=Green Algeria Map' },
  { path: '/progress?demo=true', name: '05-progress', wait: 'text=Archived' },
]

async function main() {
  const browser = await chromium.launch({ headless: true })

  for (const page of PAGES) {
    console.log(`Capturing: ${page.name}...`)
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    })
    const pwPage = await context.newPage()

    try {
      await pwPage.goto(`${DEMO_URL}${page.path}`, { waitUntil: 'networkidle', timeout: 15000 })
      await pwPage.waitForSelector(page.wait, { timeout: 10000 })
      await pwPage.waitForTimeout(500) // let animations finish
      await pwPage.screenshot({
        path: join(OUT, `${page.name}.png`),
        fullPage: false,
      })
      console.log(`  ✓ ${page.name}.png`)
    } catch (err) {
      console.error(`  ✗ ${page.name}: ${err.message}`)
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log(`\nDone. ${PAGES.length} screenshots in ${OUT}`)
}

main().catch(console.error)