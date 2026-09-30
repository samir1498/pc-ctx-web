import type { APIRoute } from 'astro'
import { MEDIA_CSP, MEDIA_PATH_RE } from '../../../../../source/folders'

// Pictures are bytes, not KV material: the edge cache holds them. Every file is
// sandboxed, so an SVG or PDF opened by its own URL never runs as the hub.
export const GET: APIRoute = async ({ params, request, locals }) => {
  const path = params.path ?? ''
  const project = locals.hub.project(params.project ?? '')
  if (!project || !MEDIA_PATH_RE.test(path) || path.includes('..')) return new Response('Not found', { status: 404 })

  const edge = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null
  const hit = edge ? await edge.match(request) : undefined
  if (hit) return hit

  const store = await locals.hub.store(project.id)
  const file = store ? await store.media(path).catch(() => null) : null
  if (!file) return new Response('Not found', { status: 404 })
  const res = new Response(file.bytes, {
    headers: {
      'content-type': file.contentType,
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': MEDIA_CSP,
    },
  })
  if (edge) locals.cfContext?.waitUntil(edge.put(request, res.clone()))
  return res
}
