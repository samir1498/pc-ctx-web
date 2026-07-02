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

// One GraphQL request returns the folder listing AND every file's content —
// replaces an N+1 REST fan-out that blew Cloudflare's per-invocation subrequest limit.
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
    body: JSON.stringify({ query: TREE_QUERY, variables: { owner, repo, expr: `${BRANCH}:${folder}` } }),
  })
  if (!res.ok) throw new Error(`GitHub GraphQL request failed: ${res.status}`)
  const json = await res.json<GqlResponse>()
  if (json.errors?.length) throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`)

  const tree = json.data?.repository?.object
  if (!tree) return null // folder doesn't exist in the repo yet

  const results: FolderEntry[] = []
  for (const entry of tree.entries) {
    if (entry.type !== 'blob' || !entry.object || entry.object.isBinary || entry.object.text == null) continue
    const slug = entry.name.replace(/\.\w+$/, '')
    const parsed = parseFrontmatter(entry.object.text)
    results.push({
      slug,
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

  try {
    const entries = await fetchFolder(c.env, folder)
    // Folder not present in the context repo yet (e.g. handoffs/ or archive/
    // not created). Treat as an empty domain rather than an error.
    return c.json(entries ?? [])
  } catch (err) {
    return c.json({ error: `Failed to fetch ${folder}`, message: (err as Error).message }, 500)
  }
})

app.get('/api/:folder/:slug', async (c) => {
  const { folder, slug } = c.req.param()
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return c.notFound()
  }

  try {
    const entries = await fetchFolder(c.env, folder)
    const file = entries?.find((e) => e.slug === slug)
    if (!file) return c.json({ error: 'Not found' }, 404)
    return c.json(file)
  } catch (err) {
    return c.json({ error: 'Failed to read file', message: (err as Error).message }, 500)
  }
})

app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export const onRequest = (ctx: PagesContext): Response | Promise<Response> => {
  return app.fetch(ctx.request, ctx.env)
}
