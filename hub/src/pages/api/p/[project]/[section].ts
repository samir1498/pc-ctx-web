import type { APIRoute } from 'astro'
import { isSection } from '../../../../lib/sections'
import { listPage } from '../../../../lib/list'

export const GET: APIRoute = async ({ params, url, locals }) => {
  const project = locals.hub.project(params.project ?? '')
  const section = params.section ?? ''
  const store = project ? await locals.hub.store(project.id) : null
  if (!project || !store || !isSection(section)) return Response.json({ error: 'not found' }, { status: 404 })
  const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0)
  const status = url.searchParams.get('status') || undefined
  const q = url.searchParams.get('q')?.slice(0, 100) || undefined
  try {
    const body = await listPage(store, project.id, section, { page, status, q, plain: project.audience === 'plain' })
    return Response.json(body, { headers: { 'cache-control': 'private, max-age=30' } })
  } catch (err) {
    console.error('list failed', section, err)
    return Response.json({ error: 'Could not read this section from GitHub.' }, { status: 502 })
  }
}
