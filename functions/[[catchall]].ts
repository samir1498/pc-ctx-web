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

app.get('/api/:folder', async (c) => {
  const { folder } = c.req.param()
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return c.notFound()
  }

  let entries: FolderEntry[] | null
  try {
    entries = await fetchFolder(c.env, folder)
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }

  // Folder not present in the context repo yet (e.g. handoffs/ or archive/
  // not created yet). Treat as an empty domain rather than an error.
  return c.json(entries ?? [])
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

  let entries: FolderEntry[] | null
  try {
    entries = await fetchFolder(c.env, folder)
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}: ${err instanceof Error ? err.message : err}`, status: 502 }, 502)
  }

  const file = entries?.find((e) => e.slug === slug)
  if (!file) return c.json({ error: 'Not found' }, 404)

  return c.json(file)
})

app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export const onRequest = (ctx: PagesContext): Response | Promise<Response> => {
  return app.fetch(ctx.request, ctx.env)
}
