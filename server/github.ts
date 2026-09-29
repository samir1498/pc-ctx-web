import type { ContextSource, FolderEntry, FolderKey, ListEntry } from './source.js'
import type { MediaFile } from './source.js'
import { MEDIA_PATH_RE, folderPath, isDocument, isRecord, mediaContentType, sortListEntries, toEntry, toListEntry } from './source.js'

export interface GithubSourceOptions {
  token: string
  owner: string
  repo: string
  branch: string
  /** Context folder inside the repo. '' or '.' means the repo root. */
  folder: string
}

// '' and '.' both mean "repo root" — neither should end up as a leading segment
// in the GraphQL tree expression (that would look for a literal "./plans" path).
function joinPath(base: string, sub: string): string {
  const trimmed = base.replace(/^\.\/*$/, '').replace(/\/+$/, '')
  return trimmed ? `${trimmed}/${sub}` : sub
}

interface GqlTreeEntry {
  name: string
  type: string
}

function readGqlErrors(json: unknown): string[] {
  if (!isRecord(json)) return []
  const errors = json.errors
  if (!Array.isArray(errors)) return []
  const out: string[] = []
  for (const e of errors) {
    if (isRecord(e) && typeof e.message === 'string') out.push(e.message)
  }
  return out
}

function readTreeEntries(json: unknown): GqlTreeEntry[] | null {
  if (!isRecord(json)) return null
  const data = json.data
  if (!isRecord(data)) return null
  const repository = data.repository
  if (!isRecord(repository)) return null
  const object = repository.object
  if (!isRecord(object)) return null
  const entries = object.entries
  if (!Array.isArray(entries)) return null
  const out: GqlTreeEntry[] = []
  for (const e of entries) {
    if (isRecord(e) && typeof e.name === 'string' && typeof e.type === 'string') {
      out.push({ name: e.name, type: e.type })
    }
  }
  return out
}

function readRepositoryRecord(json: unknown): Record<string, unknown> | null {
  if (!isRecord(json)) return null
  const data = json.data
  if (!isRecord(data)) return null
  const repository = data.repository
  return isRecord(repository) ? repository : null
}

async function graphql(opts: GithubSourceOptions, query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pc-ctx-web/1.0',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${body}`)
  }
  const json: unknown = await res.json()
  const errors = readGqlErrors(json)
  if (errors.length) throw new Error(`GitHub GraphQL error: ${errors.join('; ')}`)
  return json
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

// The REST contents endpoint in its raw form: the bytes of one file, up to
// 100 MB, where GraphQL's Blob.text stops at 512 KB.
async function fetchRaw(opts: GithubSourceOptions, repoPath: string): Promise<Response> {
  const url = `https://api.github.com/repos/${opts.owner}/${opts.repo}/contents/${repoPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(opts.branch)}`
  return fetch(url, {
    headers: { Authorization: `Bearer ${opts.token}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': 'pc-ctx-web/1.0' },
  })
}

export function githubSource(opts: GithubSourceOptions): ContextSource {
  const expr = (folder: FolderKey): string => `${opts.branch}:${joinPath(opts.folder, folderPath(folder))}`

  return {
    // GraphQL carries no bytes, so a picture comes through the REST contents
    // endpoint in its raw form, with the same token.
    async readMedia(path: string): Promise<MediaFile | null> {
      if (!MEDIA_PATH_RE.test(path)) return null
      const res = await fetchRaw(opts, joinPath(opts.folder, `media/${path}`))
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`GitHub contents request failed: ${res.status}`)
      return { bytes: await res.arrayBuffer(), contentType: mediaContentType(path) }
    },

    async list(folder: FolderKey): Promise<ListEntry[] | null> {
      const json = await graphql(opts, LIST_QUERY, { owner: opts.owner, repo: opts.repo, expr: expr(folder) })
      const entries = readTreeEntries(json)
      if (entries === null) return null
      return sortListEntries(
        entries.filter((e) => e.type === 'blob' && isDocument(e.name, folder)).map((e) => toListEntry(folder, e.name)),
      )
    },

    async read(folder: FolderKey, names: string[]): Promise<FolderEntry[]> {
      if (names.length === 0) return []
      const base = joinPath(opts.folder, folderPath(folder))
      const aliases = names
        .map((name, i) => `f${i}: object(expression: ${JSON.stringify(`${opts.branch}:${base}/${name}`)}) { ... on Blob { text isBinary isTruncated } }`)
        .join('\n')
      const query = `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${aliases} } }`

      const json = await graphql(opts, query, { owner: opts.owner, repo: opts.repo })
      const repository = readRepositoryRecord(json)
      if (!repository) return []

      const out: FolderEntry[] = []
      for (const [i, name] of names.entries()) {
        const blob = repository[`f${i}`]
        if (!isRecord(blob)) continue
        const { text, isBinary, isTruncated } = blob
        if (isBinary === true || typeof text !== 'string') continue
        // A page past 512 KB (a design page with its fonts inlined) comes back
        // cut mid-tag; read the whole file instead of rendering half of it.
        if (isTruncated === true) {
          const res = await fetchRaw(opts, `${base}/${name}`)
          if (!res.ok) throw new Error(`GitHub contents request failed: ${res.status}`)
          out.push(toEntry(folder, name, await res.text()))
          continue
        }
        out.push(toEntry(folder, name, text))
      }
      return out
    },
  }
}
