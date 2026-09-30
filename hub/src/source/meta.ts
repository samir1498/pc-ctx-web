import type { ContextItem } from '../doc/types'
import { docDate, docTitle, firstParagraphs, planProgress, splitLeadingHeading } from '../doc/hub'
import type { FolderEntry } from './folders'

/** What a list row needs from a document: small, and cached forever by blob SHA. */
export interface DocMeta {
  slug: string
  name: string
  path: string
  oid: string
  title: string
  date: string | null
  status?: string
  summary?: string
  kind?: string
  progress?: { done: number; total: number }
}

// FolderEntry's frontmatter is untyped YAML; the doc helpers read it defensively.
export function asItem(entry: FolderEntry): ContextItem {
  return entry as ContextItem
}

function plainSummary(body: string | undefined, title: string): string | undefined {
  if (!body) return undefined
  const { heading, rest } = splitLeadingHeading(body)
  const text = firstParagraphs(heading === title ? rest : body, 1)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, 220) : undefined
}

export function toMeta(entry: FolderEntry, oid: string): DocMeta {
  const item = asItem(entry)
  const fm = item.frontmatter ?? {}
  const title = docTitle(item)
  const meta: DocMeta = { slug: entry.slug, name: entry.name, path: entry.path, oid, title, date: docDate(item) }
  if (typeof fm.status === 'string') meta.status = fm.status
  if (typeof fm.kind === 'string') meta.kind = fm.kind
  const summary = typeof fm.tldr === 'string' && fm.tldr.trim() ? fm.tldr.trim().slice(0, 220) : fm.kind === 'html' ? undefined : plainSummary(item.body, title)
  if (summary) meta.summary = summary
  const pr = planProgress(item)
  if (pr.total > 0) meta.progress = { done: pr.done, total: pr.total }
  return meta
}
