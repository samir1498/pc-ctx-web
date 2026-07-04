import { Hono } from 'hono'
import { load as parseYaml } from 'js-yaml'

type Env = {
  GITHUB_TOKEN?: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  GITHUB_PATH_PREFIX?: string
  AUTH_GATE?: string
  ASSETS: { fetch: (req: Request) => Response | Promise<Response> }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(req: Request, env: Env): boolean {
  const gate = env.AUTH_GATE?.trim()
  if (!gate) return true
  const header = req.headers.get('Authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false
  let decoded: string
  try {
    decoded = atob(encoded)
  } catch {
    return false
  }
  return gate
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .some((pair) => timingSafeEqual(pair, decoded))
}

interface PagesContext {
  request: Request
  env: Env
  params: Record<string, string>
  next: () => Promise<Response>
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  if (!isAuthorized(c.req.raw, c.env)) {
    return c.body('Authentication required', 401, {
      'WWW-Authenticate': 'Basic realm="pc-ctx", charset="UTF-8"',
    })
  }
  await next()
})

const OWNER = 'samir1498'
const REPO = 'personal-context'
const BRANCH = 'main'

const FOLDERS = ['plans', 'roadmaps', 'references', 'progress', 'ideas', 'processes', 'handoffs', 'archive'] as const

function ghPath(path: string, env: Env): string {
  const prefix = env.GITHUB_PATH_PREFIX || ''
  return prefix ? `${prefix.replace(/\/+$/, '')}/${path}` : path
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

interface FolderEntry {
  slug: string
  name: string
  path: string
  frontmatter?: Record<string, unknown>
  body?: string
}

const TREE_QUERY = `
  query($owner: String!, $repo: String!, $expr: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expr) {
        ... on Tree {
          entries {
            name
            type
            object {
              ... on Blob {
                text
                isBinary
              }
            }
          }
        }
      }
    }
  }
`

interface GqlTreeEntry {
  name: string
  type: string
  object: { text: string | null; isBinary: boolean } | null
}

interface GqlResponse {
  data?: { repository?: { object: { entries: GqlTreeEntry[] } | null } }
  errors?: { message: string }[]
}

async function fetchFolder(env: Env, folder: string): Promise<FolderEntry[] | null> {
  const owner = env.GITHUB_OWNER || OWNER
  const repo = env.GITHUB_REPO || REPO

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN || ''}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pc-ctx-web/1.0',
    },
    body: JSON.stringify({ query: TREE_QUERY, variables: { owner, repo, expr: `${BRANCH}:${ghPath(folder, env)}` } }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${body}`)
  }

  const json = await res.json<GqlResponse>()
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  const tree = json.data?.repository?.object
  if (!tree) return null

  const results: FolderEntry[] = []
  for (const entry of tree.entries) {
    if (entry.type !== 'blob' || !entry.object || entry.object.isBinary || entry.object.text == null) continue
    const parsed = parseFrontmatter(entry.object.text)
    results.push({
      slug: entry.name.replace(/\.\w+$/, ''),
      name: entry.name,
      path: `${folder}/${entry.name}`,
      ...(parsed ? { frontmatter: parsed.frontmatter, body: parsed.body } : { body: entry.object.text }),
    })
  }
  return results
}

interface ListEntry {
  slug: string
  name: string
  path: string
}

function leadingDateMs(name: string): number | null {
  const m = name.match(/^(\d{4})-?(\d{2})-?(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`)
  const ms = dt.getTime()
  if (Number.isNaN(ms)) return null
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(mo) || dt.getUTCDate() !== Number(d)) {
    return null
  }
  return ms
}

const LIST_QUERY = `
  query($owner: String!, $repo: String!, $expr: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expr) {
        ... on Tree { entries { name type } }
      }
    }
  }
`

async function listFolder(env: Env, folder: string): Promise<ListEntry[] | null> {
  const owner = env.GITHUB_OWNER || OWNER
  const repo = env.GITHUB_REPO || REPO

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN || ''}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pc-ctx-web/1.0',
    },
    body: JSON.stringify({ query: LIST_QUERY, variables: { owner, repo, expr: `${BRANCH}:${ghPath(folder, env)}` } }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${body}`)
  }

  const json = await res.json<GqlResponse>()
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  const tree = json.data?.repository?.object
  if (!tree) return null
  return tree.entries
    .filter((e) => e.type === 'blob' && isMarkdown(e.name))
    .map((e) => ({ slug: e.name.replace(/\.\w+$/, ''), name: e.name, path: `${folder}/${e.name}`, date: leadingDateMs(e.name) }))
    .sort((a, b) => {
      if (a.date !== null && b.date !== null) return b.date - a.date
      if (a.date !== null) return -1
      if (b.date !== null) return 1
      return a.name.localeCompare(b.name)
    })
    .map(({ date: _date, ...rest }) => rest)
}

async function fetchBlobsByName(env: Env, folder: string, names: string[]): Promise<FolderEntry[]> {
  if (names.length === 0) return []
  const owner = env.GITHUB_OWNER || OWNER
  const repo = env.GITHUB_REPO || REPO

  const aliases = names
    .map((name, i) => `f${i}: object(expression: ${JSON.stringify(`${BRANCH}:${ghPath(folder, env)}/${name}`)}) { ... on Blob { text isBinary } }`)
    .join('\n')
  const query = `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${aliases} } }`

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN || ''}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pc-ctx-web/1.0',
    },
    body: JSON.stringify({ query, variables: { owner, repo } }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${body}`)
  }

  const json = await res.json<{
    data?: { repository?: Record<string, { text: string | null; isBinary: boolean } | null> }
    errors?: { message: string }[]
  }>()
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  const repoData = json.data?.repository ?? {}
  const out: FolderEntry[] = []
  names.forEach((name, i) => {
    const blob = repoData[`f${i}`]
    if (!blob || blob.isBinary || blob.text == null) return
    const parsed = parseFrontmatter(blob.text)
    out.push({
      slug: name.replace(/\.\w+$/, ''),
      name,
      path: `${folder}/${name}`,
      ...(parsed ? { frontmatter: parsed.frontmatter, body: parsed.body } : { body: blob.text }),
    })
  })
  return out
}

function buildCountsQuery(env: Env): string {
  return `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
${FOLDERS.map((f) => `      ${f}: object(expression: "${BRANCH}:${ghPath(f, env)}") { ... on Tree { entries { name type } } }`).join('\n')}
    }
  }
`
}

interface GqlCountEntry {
  name: string
  type: string
}

interface GqlCountsResponse {
  data?: { repository?: Record<string, { entries: GqlCountEntry[] } | null> }
  errors?: { message: string }[]
}

function isMarkdown(name: string): boolean {
  return name.endsWith('.md') || name.endsWith('.mdx')
}

async function fetchCounts(env: Env): Promise<Record<string, number>> {
  const owner = env.GITHUB_OWNER || OWNER
  const repo = env.GITHUB_REPO || REPO

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN || ''}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pc-ctx-web/1.0',
    },
    body: JSON.stringify({ query: buildCountsQuery(env), variables: { owner, repo } }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${body}`)
  }

  const json = await res.json<GqlCountsResponse>()
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  const repoData = json.data?.repository ?? {}
  const counts: Record<string, number> = {}
  for (const f of FOLDERS) {
    const tree = repoData[f]
    counts[f] = tree ? tree.entries.filter((e) => e.type === 'blob' && isMarkdown(e.name)).length : 0
  }
  return counts
}

app.get('/api/counts', async (c) => {
  try {
    return c.json(await fetchCounts(c.env))
  } catch (err) {
    return c.json({ error: `Failed to fetch counts: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }
})

app.get('/api/:folder', async (c) => {
  const { folder } = c.req.param()
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return c.notFound()
  }

  const wantMeta = !!c.req.query('meta')
  const pageParam = c.req.query('page')

  if (c.req.query('list')) {
    try {
      return c.json((await listFolder(c.env, folder)) ?? [])
    } catch (err) {
      return c.json({ error: `Failed to list ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
    }
  }

  if (pageParam != null) {
    const page = Math.max(0, Number.parseInt(pageParam, 10) || 0)
    const size = Math.min(100, Math.max(1, Number.parseInt(c.req.query('size') || '30', 10)))
    let names: ListEntry[] | null
    try {
      names = await listFolder(c.env, folder)
    } catch (err) {
      return c.json({ error: `Failed to list ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
    }
    const all = names ?? []
    const slice = all.slice(page * size, page * size + size)
    let items: FolderEntry[]
    try {
      items = await fetchBlobsByName(c.env, folder, slice.map((e) => e.name))
    } catch (err) {
      return c.json({ error: `Failed to fetch ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
    }
    const payload = wantMeta ? items.map(({ body: _body, ...rest }) => rest) : items
    return c.json({ total: all.length, page, size, items: payload })
  }

  let entries: FolderEntry[] | null
  try {
    entries = await fetchFolder(c.env, folder)
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }

  const list = entries ?? []
  if (wantMeta) {
    return c.json(list.map(({ body: _body, ...rest }) => rest))
  }
  return c.json(list)
})

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error', message: err instanceof Error ? err.message : String(err) }, 500)
})

app.get('/api/:folder/:slug', async (c) => {
  const { folder, slug } = c.req.param()
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return c.notFound()
  }

  let names: ListEntry[] | null
  try {
    names = await listFolder(c.env, folder)
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }

  const entry = names?.find((e) => e.slug === slug)
  if (!entry) return c.json({ error: 'Not found' }, 404)

  let blobs: FolderEntry[]
  try {
    blobs = await fetchBlobsByName(c.env, folder, [entry.name])
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}/${slug}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }

  const file = blobs[0]
  if (!file) return c.json({ error: 'Not found' }, 404)

  return c.json(file)
})

app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export const onRequest = (ctx: PagesContext): Response | Promise<Response> => {
  return app.fetch(ctx.request, ctx.env)
}
