import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createApi } from './api.js'
import { createConfigApi } from './config-api.js'
import type { ConfigStore } from './config-store.js'
import { diskSource } from './disk.js'
import { fileConfigStore } from './file-config-store.js'
import { listDirectories } from './fs-browser.js'
import { githubSource } from './github.js'
import type { ContextSource } from './source.js'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

// Rebuilt on every request (not cached at startup) so a settings save through
// /api/config/projects takes effect immediately, with no server restart.
async function buildContextApi(store: ConfigStore): Promise<Hono> {
  const configs = await store.getProjects()
  const projects = configs.map((p) => ({ id: p.id, name: p.name, sourceKind: p.source }))
  const sources = new Map<string, ContextSource>()
  for (const p of configs) {
    if (p.source === 'disk') {
      sources.set(p.id, diskSource(p.dir))
    } else {
      const token = (await store.getToken(p.owner)) || ''
      sources.set(p.id, githubSource({ token, owner: p.owner, repo: p.repo, branch: p.branch, folder: p.folder }))
    }
  }
  return createApi({ projects, sourceFor: (id) => sources.get(id) ?? null })
}

function main(): void {
  const configPath = process.argv[2] || join(homedir(), '.config', 'pc-ctx', 'hub.json')
  const store = fileConfigStore(configPath)
  const staticDir = resolve(process.cwd(), 'client/dist')

  const app = new Hono()

  app.route('/', createConfigApi({ store, mode: 'local', github: fetch, listLocalDirectories: listDirectories }))

  app.use('/api/*', async (c, next) => {
    const api = await buildContextApi(store)
    const res = await api.fetch(c.req.raw)
    if (res.status !== 404) return res
    await next()
  })

  // Same containment check as the CLI's ui-server.ts: never serve a path resolved outside staticDir.
  app.get('*', (c) => {
    const url = new URL(c.req.url)
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname
    const diskPath = join(staticDir, filePath)
    const resolved = resolve(diskPath)
    if (resolved !== resolve(staticDir) && !resolved.startsWith(resolve(staticDir) + sep)) {
      return c.notFound()
    }
    try {
      const content = readFileSync(resolved)
      const ext = filePath.slice(filePath.lastIndexOf('.'))
      return c.body(content, 200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    } catch {
      const index = readFileSync(join(staticDir, 'index.html'))
      return c.body(index, 200, { 'Content-Type': 'text/html; charset=utf-8' })
    }
  })

  const port = Number.parseInt(process.env.PORT || '4780', 10)
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' })
  console.log(`\n  Hub running at http://127.0.0.1:${port}`)
  console.log(`  Config: ${configPath}`)
  console.log('  Press Ctrl+C to stop\n')
}

main()
