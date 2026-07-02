import { Hono } from 'hono'
import { load as parseYaml } from 'js-yaml'

type Env = {
  GITHUB_TOKEN?: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  // Optional access gate. Unset/empty → no auth (local, CLI, default deploys stay
  // open). Set to a comma-separated list of `user:pass` to require Basic Auth.
  AUTH_GATE?: string
  ASSETS: { fetch: (req: Request) => Response | Promise<Response> }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Returns true when the request is allowed through. When AUTH_GATE is unset the
// gate is disabled entirely, so this is opt-in per deploy.
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

// Optional Basic Auth gate in front of everything (assets + API). No-op unless
// AUTH_GATE is set on the deploy.
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

// One GraphQL request returns the folder listing AND every file's content.
// This replaces an N+1 REST fan-out (1 list call + 1 call per file) that blew
// Cloudflare's 50-subrequest-per-invocation limit once a folder held ~50+ files.
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

// Returns the parsed entries for a folder, or null if the folder does not
// exist in the repo (so callers can treat that as an empty domain).
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
    body: JSON.stringify({ query: TREE_QUERY, variables: { owner, repo, expr: `${BRANCH}:${folder}` } }),
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
  if (!tree) return null // folder not present in the repo yet

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

// Parse a leading YYYY-MM-DD / YYYYMMDD off a filename into a timestamp, or null
// if it doesn't start with a real calendar date. Uses the built-in Date parser
// (Temporal isn't exposed in the Workers runtime) and rejects rollovers like
// 2026-13-40. Lets the listing sort dated files newest-first without a regex
// guess at validity.
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

// Names-only listing for one folder — no blob text, so it stays cheap no matter
// how many files the folder holds. Powers pagination: list the page's filenames
// first, then fetch only that page's bodies. Sorted name-descending so
// date-prefixed files (e.g. archive) come back newest-first.
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
    body: JSON.stringify({ query: LIST_QUERY, variables: { owner, repo, expr: `${BRANCH}:${folder}` } }),
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
  // Newest dated files first (progress, dated archive entries), then topic-named
  // files alphabetically. Ordering comes from the filenames alone, so no blob is
  // ever opened just to sort a page.
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

// Fetch the blob text for a specific set of files in ONE aliased GraphQL request,
// then parse frontmatter. Lets a paginated list pull only the current page's
// bodies instead of the whole folder.
async function fetchBlobsByName(env: Env, folder: string, names: string[]): Promise<FolderEntry[]> {
  if (names.length === 0) return []
  const owner = env.GITHUB_OWNER || OWNER
  const repo = env.GITHUB_REPO || REPO

  const aliases = names
    .map((name, i) => `f${i}: object(expression: ${JSON.stringify(`${BRANCH}:${folder}/${name}`)}) { ... on Blob { text isBinary } }`)
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

// Count-only query: one request, aliased tree per folder, entry names only (no
// blob text) — so counting a folder never downloads its file bodies.
const COUNTS_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
${FOLDERS.map((f) => `      ${f}: object(expression: "${BRANCH}:${f}") { ... on Tree { entries { name type } } }`).join('\n')}
    }
  }
`

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
    body: JSON.stringify({ query: COUNTS_QUERY, variables: { owner, repo } }),
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

// Count entries for every folder in ONE GraphQL request (aliased trees, names
// only — no blob text). Powers the sidebar + KPI counts without downloading any
// file bodies. Registered before /api/:folder so "counts" isn't treated as one.
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

  // List path: filenames/slugs only, no blobs — cheap regardless of folder size.
  // Powers client-side search over the whole folder without downloading bodies.
  if (c.req.query('list')) {
    try {
      return c.json((await listFolder(c.env, folder)) ?? [])
    } catch (err) {
      return c.json({ error: `Failed to list ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
    }
  }

  // Paginated path: list filenames cheaply (no bodies), then fetch only the
  // current page's blobs. Keeps large folders (e.g. archive) fast — cost scales
  // with page size, not folder size. Returns { total, page, size, items }.
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

  // Full path (unchanged shape): every entry at once, used by the graph and
  // dashboard which need the whole set to resolve references/counts.
  let entries: FolderEntry[] | null
  try {
    entries = await fetchFolder(c.env, folder)
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }

  // Folder not present in the context repo yet (e.g. handoffs/ or archive/
  // not created yet). Treat as an empty domain rather than an error.
  // ?meta=1 drops the body from each entry — list/dashboard views only need
  // frontmatter, and bodies are the bulk of the payload.
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

  // Resolve the slug to a filename via the cheap listing, then fetch just that
  // one blob — avoids downloading the whole folder to return a single item.
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
