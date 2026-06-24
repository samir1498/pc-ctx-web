import { Hono } from 'hono'
import { load as parseYaml } from 'js-yaml'

type Env = {
  GITHUB_TOKEN?: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  ASSETS: { fetch: (req: Request) => Response | Promise<Response> }
}

interface PagesContext {
  request: Request
  env: Env
  params: Record<string, string>
  next: () => Promise<Response>
}

const app = new Hono<{ Bindings: Env }>()

function ghHeaders(env: Env): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'personal-context/1.0',
  }
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`
  return h
}

const OWNER = 'samir1498'
const REPO = 'personal-context'
const BRANCH = 'main'

interface GhContent {
  name: string
  path: string
  sha: string
  type: 'file' | 'dir'
  download_url: string | null
}

async function ghFetch(env: Env, path: string): Promise<Response> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER || OWNER}/${env.GITHUB_REPO || REPO}/contents/${path}?ref=${BRANCH}`
  return fetch(url, { headers: ghHeaders(env) })
}

async function ghFetchRaw(env: Env, path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER || OWNER}/${env.GITHUB_REPO || REPO}/contents/${path}?ref=${BRANCH}`
  const res = await fetch(url, {
    headers: { ...ghHeaders(env), Accept: 'application/vnd.github.raw+json' },
  })
  if (!res.ok) return null
  return res.text()
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body?: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/)
  if (!match) return null
  try {
    const frontmatter = parseYaml(match[1]) as Record<string, unknown>
    return { frontmatter, body: match[2]?.trim() || undefined }
  } catch {
    return null
  }
}

const FOLDERS = ['plans', 'roadmaps', 'references', 'progress', 'ideas', 'processes', 'handoffs', 'archive'] as const

app.get('/api/:folder', async (c) => {
  const { folder } = c.req.param()
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return c.notFound()
  }

  const res = await ghFetch(c.env, folder)
  if (res.status === 404) {
    // Folder not present in the context repo yet (e.g. handoffs/ or archive/
    // not created). Treat as an empty domain rather than an error.
    return c.json([])
  }
  if (!res.ok) {
    return c.json({ error: `Failed to fetch ${folder}`, status: res.status }, 500)
  }

  const items = await res.json<GhContent[]>()
  const results = []

  for (const item of items) {
    if (item.type !== 'file') continue
    const raw = await ghFetchRaw(c.env, item.path)
    if (!raw) continue
    const parsed = parseFrontmatter(raw)
    results.push({
      slug: item.name.replace(/\.\w+$/, ''),
      name: item.name,
      path: item.path,
      ...(parsed ? { frontmatter: parsed.frontmatter, body: parsed.body } : { body: raw }),
    })
  }

  return c.json(results)
})

app.get('/api/:folder/:slug', async (c) => {
  const { folder, slug } = c.req.param()
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return c.notFound()
  }

  const res = await ghFetch(c.env, `${folder}`)
  if (!res.ok) return c.json({ error: 'Folder not found' }, 404)

  const items = await res.json<GhContent[]>()
  const file = items.find(
    (i) => i.type === 'file' && i.name.replace(/\.\w+$/, '') === slug
  )
  if (!file) return c.json({ error: 'Not found' }, 404)

  const raw = await ghFetchRaw(c.env, file.path)
  if (!raw) return c.json({ error: 'Failed to read file' }, 500)

  const parsed = parseFrontmatter(raw)
  const result: Record<string, unknown> = {
    slug,
    name: file.name,
    path: file.path,
  }
  if (parsed) {
    result.frontmatter = parsed.frontmatter
    result.body = parsed.body
  } else {
    result.body = raw
  }

  return c.json(result)
})

app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export const onRequest = (ctx: PagesContext): Response | Promise<Response> => {
  return app.fetch(ctx.request, ctx.env)
}
