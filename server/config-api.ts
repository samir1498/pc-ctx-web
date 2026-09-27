import type { Context } from 'hono'
import { Hono } from 'hono'
import type { ConfigStore, ProjectConfig } from './config-store.js'
import { isProjectConfig } from './config-store.js'
import { isRecord } from './source.js'

export type FetchLike = typeof fetch

// Deliberately not a literal `node:fs` dependency (see fs-browser.ts) — config-api.ts must
// stay importable from the Workers bundle, where this is simply never supplied.
export interface FsListing {
  path: string
  parent: string | null
  dirs: string[]
  isContextStore: boolean
}

export interface CreateConfigApiOptions {
  store: ConfigStore
  mode: 'local' | 'deployed'
  github: FetchLike
  listLocalDirectories?: (path?: string) => Promise<FsListing>
}

const KEBAB_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// GitHub login rules: alphanumeric, single hyphens, never leading/trailing, max 39 chars.
const OWNER_RE = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/

function hasTraversal(segment: string): boolean {
  return segment.split('/').some((part) => part === '..')
}

function parseProjectsBody(body: unknown): ProjectConfig[] | null {
  if (!Array.isArray(body)) return null
  const out: ProjectConfig[] = []
  for (const item of body) {
    if (!isProjectConfig(item)) return null
    out.push(item)
  }
  return out
}

function validateProjects(projects: ProjectConfig[], mode: 'local' | 'deployed'): string | null {
  const ids = projects.map((p) => p.id)
  if (new Set(ids).size !== ids.length) return 'project ids must be unique'
  if (!ids.every((id) => KEBAB_ID_RE.test(id))) return 'project ids must be kebab-case'
  for (const p of projects) {
    if (p.source === 'disk' && mode === 'deployed') return 'disk projects are not supported in deployed mode'
    if (p.source === 'github' && hasTraversal(p.folder)) return 'github folder must not contain ..'
  }
  return null
}

function parseHostPort(value: string): { hostname: string; port: string | null } | null {
  const stripped = value.replace(/^[a-z]+:\/\//i, '')
  const match = stripped.match(/^([^/:?#]+)(?::(\d+))?/)
  if (!match?.[1]) return null
  return { hostname: match[1], port: match[2] ?? null }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

// CSRF guard for the local server: a random website's browser JS could otherwise PUT/DELETE
// against 127.0.0.1. Host must be loopback; a present Origin must match it exactly.
function isLoopbackRequest(c: Context): boolean {
  const hostHeader = c.req.header('host')
  if (!hostHeader) return false
  const host = parseHostPort(hostHeader)
  if (!host || !LOOPBACK_HOSTS.has(host.hostname)) return false

  const originHeader = c.req.header('origin')
  if (originHeader === undefined) return true
  const origin = parseHostPort(originHeader)
  return !!origin && LOOPBACK_HOSTS.has(origin.hostname) && origin.port === host.port
}

async function githubRequest(github: FetchLike, token: string, path: string): Promise<Response> {
  return github(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'pc-ctx-web/1.0',
    },
  })
}

function mapGithubStatus(status: number): 401 | 403 | 404 | 502 {
  if (status === 401) return 401
  if (status === 403) return 403
  if (status === 404) return 404
  return 502
}

function githubErrorMessage(status: number): string {
  if (status === 401) return 'GitHub rejected the stored token'
  if (status === 403) return 'GitHub token lacks permission for this request'
  if (status === 404) return 'not found'
  return `GitHub request failed with status ${status}`
}

export function createConfigApi(options: CreateConfigApiOptions): Hono {
  const { store, mode, github, listLocalDirectories } = options
  const app = new Hono()

  app.use('/api/config/*', async (c, next) => {
    if (c.req.method === 'PUT' || c.req.method === 'DELETE') {
      const contentType = c.req.header('content-type') || ''
      if (!contentType.toLowerCase().includes('application/json')) {
        return c.json({ error: 'Content-Type must be application/json' }, 400)
      }
      if (mode === 'local' && !isLoopbackRequest(c)) {
        return c.json({ error: 'forbidden origin' }, 403)
      }
    }
    await next()
  })

  app.get('/api/config', async (c) => {
    const projects = await store.getProjects()
    const owners = new Set<string>()
    for (const p of projects) if (p.source === 'github') owners.add(p.owner)
    for (const owner of await store.listTokenOwners()) owners.add(owner)

    const tokens: Record<string, 'set' | 'not set'> = {}
    for (const owner of owners) tokens[owner] = (await store.hasToken(owner)) ? 'set' : 'not set'

    return c.json({ mode, projects, tokens })
  })

  app.put('/api/config/projects', async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const projects = parseProjectsBody(body)
    if (!projects) return c.json({ error: 'projects must be an array of valid project configs' }, 400)
    const err = validateProjects(projects, mode)
    if (err) return c.json({ error: err }, 400)
    await store.saveProjects(projects)
    return c.json({ projects })
  })

  app.put('/api/config/tokens/:owner', async (c) => {
    const owner = c.req.param('owner')
    if (!OWNER_RE.test(owner)) return c.json({ error: 'invalid owner' }, 400)
    const body: unknown = await c.req.json().catch(() => null)
    const token = isRecord(body) && typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) return c.json({ error: 'token must not be empty' }, 400)
    await store.setToken(owner, token)
    return c.json({ owner, status: 'set' })
  })

  app.delete('/api/config/tokens/:owner', async (c) => {
    const owner = c.req.param('owner')
    if (!OWNER_RE.test(owner)) return c.json({ error: 'invalid owner' }, 400)
    await store.deleteToken(owner)
    return c.json({ owner, status: 'not set' })
  })

  app.get('/api/config/github/:owner/repos', async (c) => {
    const owner = c.req.param('owner')
    const token = await store.getToken(owner)
    if (!token) return c.json({ error: 'no token for owner' }, 409)
    const res = await githubRequest(github, token, '/user/repos?per_page=100&sort=full_name')
    if (!res.ok) return c.json({ error: githubErrorMessage(res.status) }, mapGithubStatus(res.status))
    const json: unknown = await res.json()
    if (!Array.isArray(json)) return c.json({ error: 'unexpected GitHub response' }, 502)
    const repos = json
      .filter(isRecord)
      .map((r) => ({
        name: typeof r.name === 'string' ? r.name : '',
        defaultBranch: typeof r.default_branch === 'string' ? r.default_branch : 'main',
      }))
      .filter((r) => r.name)
    return c.json(repos)
  })

  app.get('/api/config/github/:owner/:repo/branches', async (c) => {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')
    const token = await store.getToken(owner)
    if (!token) return c.json({ error: 'no token for owner' }, 409)
    const res = await githubRequest(
      github,
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    )
    if (!res.ok) return c.json({ error: githubErrorMessage(res.status) }, mapGithubStatus(res.status))
    const json: unknown = await res.json()
    if (!Array.isArray(json)) return c.json({ error: 'unexpected GitHub response' }, 502)
    const branches = json.filter(isRecord).map((b) => (typeof b.name === 'string' ? b.name : '')).filter(Boolean)
    return c.json(branches)
  })

  app.get('/api/config/github/:owner/:repo/tree', async (c) => {
    const owner = c.req.param('owner')
    const repo = c.req.param('repo')
    const branch = c.req.query('branch') || ''
    const path = c.req.query('path') || ''
    if (hasTraversal(path)) return c.json({ error: 'invalid path' }, 400)
    const token = await store.getToken(owner)
    if (!token) return c.json({ error: 'no token for owner' }, 409)

    const encodedPath = path
      ? `/${path
          .split('/')
          .filter(Boolean)
          .map(encodeURIComponent)
          .join('/')}`
      : ''
    const query = branch ? `?ref=${encodeURIComponent(branch)}` : ''
    const res = await githubRequest(
      github,
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${encodedPath}${query}`,
    )
    if (!res.ok) return c.json({ error: githubErrorMessage(res.status) }, mapGithubStatus(res.status))
    const json: unknown = await res.json()
    if (!Array.isArray(json)) return c.json({ error: 'not a directory' }, 400)
    const dirs = json
      .filter(isRecord)
      .filter((e) => e.type === 'dir' && typeof e.name === 'string')
      .map((e) => (typeof e.name === 'string' ? e.name : ''))
    return c.json(dirs)
  })

  app.get('/api/config/fs', async (c) => {
    if (mode !== 'local' || !listLocalDirectories) return c.notFound()
    try {
      const listing = await listLocalDirectories(c.req.query('path') || undefined)
      return c.json(listing)
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'failed to list directory' }, 400)
    }
  })

  app.onError((err, c) => {
    console.error('config-api error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}
