#!/usr/bin/env node
import { chromium } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'screenshots')

const DEMO_URL = 'https://demo-pc-ctx-web.pages.dev'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const pwPage = await context.newPage()

  await pwPage.goto(`${DEMO_URL}/plan/auth-email-verification-password-reset-social-login?demo=true`, { waitUntil: 'networkidle', timeout: 15000 })
  await pwPage.waitForTimeout(3000)
  await pwPage.screenshot({ path: join(OUT, '03-plan-detail.png'), fullPage: false })
  console.log('✓ plan-detail.png')

  await browser.close()
}

main().catch(console.error)
