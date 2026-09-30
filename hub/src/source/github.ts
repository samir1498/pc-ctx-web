import type { FolderKey, MediaFile } from './folders'
import { MEDIA_PATH_RE, folderPath, isDocument, isRecord, mediaContentType } from './folders'

export interface RepoRef {
  token: string
  owner: string
  repo: string
  branch: string
  /** Context folder inside the repo; '' or '.' is the repo root. */
  folder: string
}

/** Counts GitHub requests for one hub request; the T1 numbers come from this. */
export interface Meter {
  github: number
}

export interface TreeEntry {
  name: string
  oid: string
}

export interface FolderTree {
  /** The folder's own tree SHA: it changes when any file in it changes. */
  oid: string
  dir: string
  entries: TreeEntry[]
}

export type Trees = Partial<Record<FolderKey, FolderTree>>

export interface BlobText {
  text: string
}

const UA = 'context-hub/2.0'

export function repoPath(ref: RepoRef, sub: string): string {
  const base = ref.folder.replace(/^\.\/*$/, '').replace(/\/+$/, '')
  return base ? `${base}/${sub}` : sub
}

async function graphql(ref: RepoRef, meter: Meter, query: string): Promise<Record<string, unknown>> {
  meter.github++
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ref.token}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query, variables: { owner: ref.owner, repo: ref.repo } }),
  })
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const json: unknown = await res.json()
  if (!isRecord(json)) throw new Error('GitHub GraphQL: unexpected response')
  if (Array.isArray(json.errors) && json.errors.length) {
    const msg = json.errors.map((e) => (isRecord(e) ? String(e.message) : String(e))).join('; ')
    throw new Error(`GitHub GraphQL: ${msg}`)
  }
  const repo = isRecord(json.data) ? json.data.repository : null
  if (!isRecord(repo)) throw new Error(`GitHub GraphQL: no repository ${ref.owner}/${ref.repo}`)
  return repo
}

const wrap = (aliases: string) => `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${aliases} } }`

/** Every folder's file list in one query: names and blob SHAs, no file text. */
export async function fetchTrees(ref: RepoRef, meter: Meter, folders: readonly FolderKey[]): Promise<Trees> {
  const aliases = folders
    .map((f, i) => `t${i}: object(expression: ${JSON.stringify(`${ref.branch}:${repoPath(ref, folderPath(f))}`)}) { ... on Tree { oid entries { name type oid } } }`)
    .join('\n')
  const repo = await graphql(ref, meter, wrap(aliases))
  const out: Trees = {}
  folders.forEach((folder, i) => {
    const tree = repo[`t${i}`]
    if (!isRecord(tree) || typeof tree.oid !== 'string' || !Array.isArray(tree.entries)) return
    const entries: TreeEntry[] = []
    for (const e of tree.entries) {
      if (isRecord(e) && e.type === 'blob' && typeof e.name === 'string' && typeof e.oid === 'string' && isDocument(e.name, folder)) {
        entries.push({ name: e.name, oid: e.oid })
      }
    }
    out[folder] = { oid: tree.oid, dir: folderPath(folder), entries }
  })
  return out
}

const BATCH = 50

/** File text by blob SHA, in aliased batches. A blob past GraphQL's 512 KB cut is read whole over REST. */
export async function fetchBlobs(ref: RepoRef, meter: Meter, oids: string[]): Promise<Map<string, BlobText>> {
  const out = new Map<string, BlobText>()
  const batches: string[][] = []
  for (let i = 0; i < oids.length; i += BATCH) batches.push(oids.slice(i, i + BATCH))
  await Promise.all(
    batches.map(async (batch) => {
      const aliases = batch.map((oid, i) => `b${i}: object(oid: ${JSON.stringify(oid)}) { ... on Blob { text isBinary isTruncated } }`).join('\n')
      const repo = await graphql(ref, meter, wrap(aliases))
      await Promise.all(
        batch.map(async (oid, i) => {
          const blob = repo[`b${i}`]
          if (!isRecord(blob) || blob.isBinary === true || typeof blob.text !== 'string') return
          out.set(oid, { text: blob.isTruncated === true ? await fetchRawBlob(ref, meter, oid) : blob.text })
        }),
      )
    }),
  )
  return out
}

async function fetchRawBlob(ref: RepoRef, meter: Meter, oid: string): Promise<string> {
  meter.github++
  const res = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/git/blobs/${oid}`, {
    headers: { Authorization: `Bearer ${ref.token}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`GitHub blob ${oid.slice(0, 7)}: ${res.status}`)
  return res.text()
}

/** A picture under the store's media/ folder. */
export async function fetchMedia(ref: RepoRef, meter: Meter, path: string): Promise<MediaFile | null> {
  if (!MEDIA_PATH_RE.test(path) || path.includes('..')) return null
  meter.github++
  const full = repoPath(ref, `media/${path}`)
  const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/${full.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref.branch)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ref.token}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': UA } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub contents ${res.status}`)
  return { bytes: await res.arrayBuffer(), contentType: mediaContentType(path) }
}
