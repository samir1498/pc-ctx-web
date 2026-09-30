import type { FolderEntry, FolderKey, MediaFile } from './folders'
import { ALL_FOLDERS, FOLDER_FALLBACKS, isRecord, sortListEntries } from './folders'
import { toEntry } from './frontmatter'
import type { FolderTree, Meter, RepoRef, TreeEntry, Trees } from './github'
import { fetchBlobs, fetchMedia, fetchTrees } from './github'
import type { DocMeta } from './meta'
import { toMeta } from './meta'

/** The two KV calls the store uses; a real KVNamespace satisfies it. */
export interface KVLike {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

// A push shows up within a minute; KV's floor for a TTL is 60 seconds.
const TREE_TTL = 60
const FOLDER_META_TTL = 7 * 86400
// Blob SHAs never change content, so per-blob entries carry no TTL.
const BLOB_CACHE_MAX = 1_000_000
const V = 'v2'

export interface SectionTree extends FolderTree {
  /** The folder key the files actually live under (a fallback such as progress-standup). */
  source: FolderKey
}

export interface Store {
  trees(): Promise<Partial<Record<FolderKey, SectionTree>>>
  tree(folder: FolderKey): Promise<SectionTree | null>
  /** Newest first by the date in the file name, then by name. */
  entries(folder: FolderKey): Promise<TreeEntry[]>
  page(folder: FolderKey, page: number, size: number): Promise<{ total: number; items: DocMeta[] }>
  /** Every document's meta in a folder: status charts. One KV read when the folder is unchanged. */
  allMetas(folder: FolderKey): Promise<DocMeta[]>
  doc(folder: FolderKey, slug: string): Promise<(FolderEntry & { oid: string }) | null>
  texts(folder: FolderKey, names: string[]): Promise<{ name: string; text: string }[]>
  media(path: string): Promise<MediaFile | null>
}

export function createStore(ref: RepoRef, kv: KVLike | null, projectId: string, meter: Meter): Store {
  let memo: Promise<Partial<Record<FolderKey, SectionTree>>> | null = null
  const treeKey = `tree:${V}:${projectId}`
  // A cache write is best effort: a KV 429 must not fail a page GitHub already answered.
  const save = (key: string, value: unknown, options?: { expirationTtl?: number }) =>
    kv ? kv.put(key, JSON.stringify(value), options).catch(() => undefined) : undefined
  // Keyed by name too, so a renamed file never shows its old slug or path.
  const metaKey = (t: SectionTree, e: TreeEntry) => `m:${V}:${e.oid}:${t.source}:${e.name}`

  async function loadTrees(): Promise<Partial<Record<FolderKey, SectionTree>>> {
    const cached = kv ? await kv.get(treeKey, 'json') : null
    const raw: Trees = isRecord(cached) ? (cached as Trees) : await fetchTrees(ref, meter, ALL_FOLDERS)
    if (!isRecord(cached)) await save(treeKey, raw, { expirationTtl: TREE_TTL })
    const out: Partial<Record<FolderKey, SectionTree>> = {}
    for (const key of ALL_FOLDERS) {
      const t = raw[key]
      if (t) out[key] = { ...t, source: key }
    }
    for (const [key, fallback] of Object.entries(FOLDER_FALLBACKS) as [FolderKey, FolderKey][]) {
      const fb = out[fallback]
      if (!out[key] && fb) out[key] = fb
    }
    return out
  }

  const trees = () => (memo ??= loadTrees())
  const tree = async (folder: FolderKey) => (await trees())[folder] ?? null
  const sorted = (t: SectionTree) => sortListEntries(t.entries)

  async function readTexts(oids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const missing: string[] = []
    const hits = await Promise.all(oids.map((oid) => (kv ? kv.get(`b:${V}:${oid}`, 'json') : null)))
    oids.forEach((oid, i) => {
      const hit = hits[i]
      if (typeof hit === 'string') out.set(oid, hit)
      else missing.push(oid)
    })
    if (missing.length) {
      const fetched = await fetchBlobs(ref, meter, missing)
      await Promise.all(
        [...fetched].map(async ([oid, { text }]) => {
          out.set(oid, text)
          if (text.length <= BLOB_CACHE_MAX) await save(`b:${V}:${oid}`, text)
        }),
      )
    }
    return out
  }

  async function metasFor(t: SectionTree, entries: TreeEntry[]): Promise<DocMeta[]> {
    const hits = await Promise.all(entries.map((e) => (kv ? kv.get(metaKey(t, e), 'json') : null)))
    const missing = entries.filter((_, i) => !isRecord(hits[i]))
    const texts = missing.length ? await readTexts(missing.map((e) => e.oid)) : new Map<string, string>()
    const fresh = new Map<string, DocMeta>()
    await Promise.all(
      missing.map(async (e) => {
        const text = texts.get(e.oid)
        if (text === undefined) return
        const meta = toMeta(toEntry(t.source, e.name, text), e.oid)
        fresh.set(e.oid, meta)
        await save(metaKey(t, e), meta)
      }),
    )
    return entries.flatMap((e, i) => {
      const hit = hits[i]
      if (isRecord(hit)) return [hit as unknown as DocMeta]
      const m = fresh.get(e.oid)
      return m ? [m] : []
    })
  }

  async function allMetas(folder: FolderKey): Promise<DocMeta[]> {
    const t = await tree(folder)
    if (!t) return []
    const key = `fm:${V}:${projectId}:${folder}:${t.oid}`
    const cached = kv ? await kv.get(key, 'json') : null
    if (Array.isArray(cached)) return cached as DocMeta[]
    const metas = await metasFor(t, sorted(t))
    await save(key, metas, { expirationTtl: FOLDER_META_TTL })
    return metas
  }

  return {
    trees,
    tree,
    async entries(folder) {
      const t = await tree(folder)
      return t ? sorted(t) : []
    },
    async page(folder, page, size) {
      const t = await tree(folder)
      if (!t) return { total: 0, items: [] }
      const all = sorted(t)
      const slice = all.slice(page * size, page * size + size)
      const whole = kv ? await kv.get(`fm:${V}:${projectId}:${folder}:${t.oid}`, 'json') : null
      if (Array.isArray(whole)) {
        // By name: two files with the same content share an oid but are two rows.
        const byName = new Map((whole as DocMeta[]).map((m) => [m.name, m]))
        return { total: all.length, items: slice.flatMap((e) => byName.get(e.name) ?? []) }
      }
      return { total: all.length, items: await metasFor(t, slice) }
    },
    allMetas,
    async doc(folder, slug) {
      const t = await tree(folder)
      const e = t?.entries.find((x) => x.name.replace(/\.\w+$/, '') === slug)
      if (!t || !e) return null
      const text = (await readTexts([e.oid])).get(e.oid)
      return text === undefined ? null : { ...toEntry(t.source, e.name, text), oid: e.oid }
    },
    async texts(folder, names) {
      const t = await tree(folder)
      if (!t) return []
      const picked = t.entries.filter((e) => names.includes(e.name))
      const texts = await readTexts(picked.map((e) => e.oid))
      return picked.flatMap((e) => {
        const text = texts.get(e.oid)
        return text === undefined ? [] : [{ name: e.name, text }]
      })
    },
    media: (path) => fetchMedia(ref, meter, path),
  }
}
