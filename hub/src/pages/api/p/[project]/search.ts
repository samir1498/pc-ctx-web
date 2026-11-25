import type { APIRoute } from 'astro'
import { searchHub } from '../../../../lib/overview'
import { stripCodes } from '../../../../doc/plain'

export const GET: APIRoute = async ({ params, url, locals }) => {
  const project = locals.hub.project(params.project ?? '')
  const store = project ? await locals.hub.store(project.id) : null
  if (!project || !store) return Response.json({ error: 'not found' }, { status: 404 })
  const q = url.searchParams.get('q')?.slice(0, 100).trim() ?? ''
  const plain = project.audience === 'plain'
  try {
    const groups = await searchHub(store, project.id, q, (s) => (plain ? stripCodes(s).trim() || s : s))
    return Response.json({ q, groups }, { headers: { 'cache-control': 'private, max-age=30' } })
  } catch (err) {
    console.error('search failed', err)
    return Response.json({ error: 'Could not search this store on GitHub.' }, { status: 502 })
  }
}
