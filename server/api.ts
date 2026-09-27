import type { Context } from 'hono'
import { Hono } from 'hono'
import type { ContextSource, FolderKey } from './source.js'
import { FOLDERS, isFolderKey } from './source.js'

export interface ProjectInfo {
  id: string
  name: string
  sourceKind: 'disk' | 'github'
  audience?: 'plain' | 'engineering'
}

export interface CreateApiOptions {
  projects: ProjectInfo[]
  sourceFor(projectId: string): ContextSource | null
}

function errorPayload(action: string, err: unknown): { error: string; status: 502 } {
  return { error: `Failed to ${action}: ${err instanceof Error ? err.message : String(err)}`, status: 502 }
}

async function handleFolder(c: Context, source: ContextSource, folder: FolderKey): Promise<Response> {
  const wantMeta = !!c.req.query('meta')
  const pageParam = c.req.query('page')

  if (c.req.query('list')) {
    try {
      return c.json((await source.list(folder)) ?? [])
    } catch (err) {
      return c.json(errorPayload(`list ${folder}`, err), 502)
    }
  }

  let names: Awaited<ReturnType<ContextSource['list']>>
  try {
    names = await source.list(folder)
  } catch (err) {
    return c.json(errorPayload(`list ${folder}`, err), 502)
  }
  const all = names ?? []

  if (pageParam != null) {
    const page = Math.max(0, Number.parseInt(pageParam, 10) || 0)
    const size = Math.min(100, Math.max(1, Number.parseInt(c.req.query('size') || '30', 10)))
    const slice = all.slice(page * size, page * size + size)
    let items: FolderEntryList
    try {
      items = await source.read(folder, slice.map((e) => e.name))
    } catch (err) {
      return c.json(errorPayload(`fetch ${folder}`, err), 502)
    }
    const payload = wantMeta ? items.map(({ body: _body, ...rest }) => rest) : items
    return c.json({ total: all.length, page, size, items: payload })
  }

  let items: FolderEntryList
  try {
    items = await source.read(folder, all.map((e) => e.name))
  } catch (err) {
    return c.json(errorPayload(`fetch ${folder}`, err), 502)
  }
  if (wantMeta) return c.json(items.map(({ body: _body, ...rest }) => rest))
  return c.json(items)
}

type FolderEntryList = Awaited<ReturnType<ContextSource['read']>>

async function handleSlug(c: Context, source: ContextSource, folder: FolderKey, slug: string): Promise<Response> {
  let names: Awaited<ReturnType<ContextSource['list']>>
  try {
    names = await source.list(folder)
  } catch (err) {
    return c.json(errorPayload(`fetch ${folder}`, err), 502)
  }
  const entry = names?.find((e) => e.slug === slug)
  if (!entry) return c.json({ error: 'Not found' }, 404)

  let items: FolderEntryList
  try {
    items = await source.read(folder, [entry.name])
  } catch (err) {
    return c.json(errorPayload(`fetch ${folder}/${slug}`, err), 502)
  }
  const file = items[0]
  if (!file) return c.json({ error: 'Not found' }, 404)
  return c.json(file)
}

async function handleCounts(c: Context, source: ContextSource): Promise<Response> {
  let lists: Awaited<ReturnType<ContextSource['list']>>[]
  try {
    lists = await Promise.all(FOLDERS.map((folder) => source.list(folder)))
  } catch (err) {
    return c.json(errorPayload('fetch counts', err), 502)
  }
  const counts: Record<string, number> = {}
  FOLDERS.forEach((folder, i) => {
    counts[folder] = lists[i]?.length ?? 0
  })
  return c.json(counts)
}

export function createApi(options: CreateApiOptions): Hono {
  const { projects, sourceFor } = options
  const app = new Hono()

  const firstSource = (): ContextSource | null => {
    const first = projects[0]
    return first ? sourceFor(first.id) : null
  }

  app.get('/api/projects', (c) => {
    return c.json(projects.map((p) => ({ id: p.id, name: p.name, sourceKind: p.sourceKind, audience: p.audience ?? 'engineering' })))
  })

  app.get('/api/p/:project/counts', async (c) => {
    const source = sourceFor(c.req.param('project'))
    if (!source) return c.notFound()
    return handleCounts(c, source)
  })

  app.get('/api/p/:project/:folder', async (c) => {
    const folder = c.req.param('folder')
    if (!isFolderKey(folder)) return c.notFound()
    const source = sourceFor(c.req.param('project'))
    if (!source) return c.notFound()
    return handleFolder(c, source, folder)
  })

  app.get('/api/p/:project/:folder/:slug', async (c) => {
    const folder = c.req.param('folder')
    if (!isFolderKey(folder)) return c.notFound()
    const source = sourceFor(c.req.param('project'))
    if (!source) return c.notFound()
    return handleSlug(c, source, folder, c.req.param('slug'))
  })

  app.get('/api/counts', async (c) => {
    const source = firstSource()
    if (!source) return c.notFound()
    return handleCounts(c, source)
  })

  app.get('/api/:folder', async (c) => {
    const folder = c.req.param('folder')
    if (!isFolderKey(folder)) return c.notFound()
    const source = firstSource()
    if (!source) return c.notFound()
    return handleFolder(c, source, folder)
  })

  app.get('/api/:folder/:slug', async (c) => {
    const folder = c.req.param('folder')
    if (!isFolderKey(folder)) return c.notFound()
    const source = firstSource()
    if (!source) return c.notFound()
    return handleSlug(c, source, folder, c.req.param('slug'))
  })

  app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'Internal server error', message: err instanceof Error ? err.message : String(err) }, 500)
  })

  return app
}
