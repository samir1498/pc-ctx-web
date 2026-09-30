import type { Folder } from './types'
import { isFolder } from './types'

const ABSOLUTE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i

export function mediaUrl(project: string, path: string): string {
  return `/api/p/${encodeURIComponent(project)}/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** "reports/x.md" + "../media/a.png" → "media/a.png"; stays inside the store. */
export function resolveStorePath(docPath: string, rel: string): string {
  const parts = docPath.split('/').slice(0, -1)
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

/**
 * A page's relative reference, as the store writes it: a picture under
 * media/ becomes the API's media URL, a sibling .md page becomes its hub
 * route, anything absolute stays as it is.
 */
export function resolveStoreUrl(src: string, project: string, docPath: string): string {
  if (!src || ABSOLUTE_RE.test(src)) return src
  const [pathPart, hash = ''] = src.split('#', 2)
  const target = resolveStorePath(docPath, pathPart ?? '')
  if (target.startsWith('media/')) return mediaUrl(project, target.slice('media/'.length))
  const doc = target.match(/^([\w-]+)\/([^/]+)\.mdx?$/)
  if (doc && doc[1] && doc[2] && isFolder(doc[1])) {
    const folder: Folder = doc[1]
    const route = folder === 'plans' ? `/p/${project}/plan/${doc[2]}` : `/p/${project}/${folder}/${doc[2]}`
    return hash ? `${route}#${hash}` : route
  }
  return src
}
