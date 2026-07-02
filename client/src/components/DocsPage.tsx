import { useState } from 'react'
import type { ContextItem, Folder, Frontmatter } from '../types'
import { useFolderList, useFolderPage, useItem } from '../hooks/useContext'
import { PageHeader } from './PageHeader'
import { MarkdownContent } from './MarkdownContent'
import { LoadingSpinner } from './LoadingSpinner'

const PAGE_SIZE = 30

interface DocsPageProps {
  folder: Folder
  kicker: string
  title: string
  subtitle?: React.ReactNode
  /** secondary line under each list item */
  meta?: (item: ContextItem) => string
}

interface Row {
  slug: string
  frontmatter?: Frontmatter
}

function defaultMeta(item: ContextItem): string {
  const fm = item.frontmatter ?? {}
  const bits: string[] = []
  if (fm.category) bits.push(String(fm.category))
  if (fm.status) bits.push(String(fm.status))
  if (fm.created) bits.push(String(fm.created))
  if (!bits.length && Array.isArray(fm.tags)) bits.push(fm.tags.join(' · '))
  return bits.join(' · ')
}

export function DocsPage({ folder, kicker, title, subtitle, meta = defaultMeta }: DocsPageProps) {
  const [page, setPage] = useState(0)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const { data, isLoading, error } = useFolderPage(folder, page, PAGE_SIZE, true)
  // Full slug list is fetched lazily — only once the user starts searching.
  const listQuery = useFolderList(folder, searching)

  // Rows come from the paginated page while browsing, or from the (filtered) full
  // slug list while searching. Search rows carry no frontmatter — just the slug.
  const rows: Row[] = searching
    ? (listQuery.data ?? []).filter((e) => e.slug.toLowerCase().includes(q)).map((e) => ({ slug: e.slug }))
    : (data?.items ?? [])

  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const currentSlug = rows.some((r) => r.slug === selectedSlug) ? (selectedSlug as string) : (rows[0]?.slug ?? '')
  const currentRow = rows.find((r) => r.slug === currentSlug)
  const detail = useItem(folder, currentSlug)
  const fm = currentRow?.frontmatter ?? detail.data?.frontmatter ?? {}

  const goto = (next: number) => {
    setSelectedSlug(null)
    setPage(Math.min(pageCount - 1, Math.max(0, next)))
  }
  const onSearch = (value: string) => {
    setSelectedSlug(null)
    setQuery(value)
  }

  if (isLoading && !data) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = page * PAGE_SIZE + (data?.items?.length ?? 0)

  return (
    <div className="animate-fade-in">
      <PageHeader kicker={kicker} title={title} subtitle={subtitle} />

      <div className="flex flex-wrap md:h-[calc(100vh-150px)]">
        {/* master list */}
        <div className="flex flex-[1_1_18rem] flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="border-b border-faintline px-3 py-2">
            <input
              type="search"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={`search ${folder}…`}
              className="w-full bg-transparent px-1 py-1 font-mono text-2xs text-foreground placeholder:text-fainter focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between border-b border-faintline px-4 py-2.5 font-mono text-3xs text-dim">
            {searching ? (
              <span>{listQuery.isLoading ? 'searching…' : `${rows.length} match${rows.length === 1 ? '' : 'es'}`}</span>
            ) : (
              <span>{from}–{to} of {total}</span>
            )}
            {!searching && pageCount > 1 && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goto(page - 1)}
                  disabled={page === 0}
                  className="px-2 py-1 text-muted disabled:text-fainter enabled:hover:text-foreground"
                >
                  ‹ prev
                </button>
                <span className="text-faint">
                  {page + 1}/{pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => goto(page + 1)}
                  disabled={page + 1 >= pageCount}
                  className="px-2 py-1 text-muted disabled:text-fainter enabled:hover:text-foreground"
                >
                  next ›
                </button>
              </span>
            )}
          </div>
          <div className="overflow-y-auto">
            {searching && !listQuery.isLoading && rows.length === 0 ? (
              <p className="px-4 py-8 text-center font-mono text-2xs text-faint">no matches</p>
            ) : (
              rows.map((row) => {
                const on = row.slug === currentSlug
                const rowFm = row.frontmatter
                return (
                  <button
                    key={row.slug}
                    type="button"
                    onClick={() => setSelectedSlug(row.slug)}
                    className="v2row flex w-full items-start gap-2.5 border-b border-faintline px-4 py-3.5 pl-4 text-left"
                  >
                    <span className={`w-1.5 flex-shrink-0 text-base leading-[1.3] ${on ? 'text-foreground' : 'text-transparent'}`}>
                      ▍
                    </span>
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-medium ${on ? 'text-foreground' : 'text-secondary'}`}>
                        {rowFm?.title ?? row.slug}
                      </div>
                      {rowFm ? <div className="mt-1 font-mono text-2xs text-faint">{meta({ ...row, frontmatter: rowFm } as ContextItem)}</div> : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* detail */}
        <div className="flex-[999_1_0] min-w-[min(100%,30rem)] overflow-y-auto pad-x pb-10 pt-7">
          {currentSlug && (
            <>
              <div className="font-mono text-2xs text-dim">
                {title.toUpperCase()} / {currentSlug}
                {fm.created ? ` · ${String(fm.created)}` : ''}
              </div>
              <h2 className="mt-2.5 text-2xl font-bold tracking-[-0.025em]">{fm.title ?? currentSlug}</h2>
              <div className="mt-5 max-w-3xl">
                {detail.isLoading ? (
                  <p className="font-mono text-xs text-faint">loading…</p>
                ) : detail.data?.body ? (
                  <MarkdownContent body={detail.data.body} />
                ) : (
                  <p className="font-mono text-xs text-faint">— empty —</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
