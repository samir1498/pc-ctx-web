import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createApi } from './api.js'
import { diskSource } from './disk.js'
import { githubSource } from './github.js'
import type { ContextSource } from './source.js'
import { isRecord } from './source.js'

interface DiskProjectConfig {
  id: string
  name: string
  source: 'disk'
  dir: string
}

interface GithubProjectConfig {
  id: string
  name: string
  source: 'github'
  owner: string
  repo: string
  branch: string
  folder: string
}

type ProjectConfig = DiskProjectConfig | GithubProjectConfig

interface HubConfig {
  projects: ProjectConfig[]
  tokens?: Record<string, string>
}

function isDiskProjectConfig(v: unknown): v is DiskProjectConfig {
  return isRecord(v) && v.source === 'disk' && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.dir === 'string'
}

function isGithubProjectConfig(v: unknown): v is GithubProjectConfig {
  return (
    isRecord(v) &&
    v.source === 'github' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.owner === 'string' &&
    typeof v.repo === 'string' &&
    typeof v.branch === 'string' &&
    typeof v.folder === 'string'
  )
}

function isProjectConfig(v: unknown): v is ProjectConfig {
  return isDiskProjectConfig(v) || isGithubProjectConfig(v)
}

function isHubConfig(v: unknown): v is HubConfig {
  if (!isRecord(v) || !Array.isArray(v.projects) || !v.projects.every(isProjectConfig)) return false
  if (v.tokens !== undefined) {
    if (!isRecord(v.tokens)) return false
    if (!Object.values(v.tokens).every((t) => typeof t === 'string')) return false
  }
  return true
}

function loadConfig(path: string): HubConfig {
  const raw = readFileSync(path, 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  if (!isHubConfig(parsed)) throw new Error(`Invalid hub config at ${path}`)
  return parsed
}

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

function main(): void {
  const configPath = process.argv[2] || join(homedir(), '.config', 'pc-ctx', 'hub.json')
  const config = loadConfig(configPath)
  const staticDir = resolve(process.cwd(), 'client/dist')

  const projects = config.projects.map((p) => ({ id: p.id, name: p.name, sourceKind: p.source }))
  const sources = new Map<string, ContextSource>()
  for (const p of config.projects) {
    if (p.source === 'disk') {
      sources.set(p.id, diskSource(p.dir))
    } else {
      sources.set(
        p.id,
        githubSource({
          token: config.tokens?.[p.owner] || '',
          owner: p.owner,
          repo: p.repo,
          branch: p.branch,
          folder: p.folder,
        }),
      )
    }
  }

  const app = new Hono()
  app.route('/', createApi({ projects, sourceFor: (id) => sources.get(id) ?? null }))

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
