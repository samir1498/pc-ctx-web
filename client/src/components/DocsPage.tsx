import { useState } from 'react'
import type { ContextItem, Folder } from '../types'
import { useFolderPage, useItem } from '../hooks/useContext'
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
  const { data, isLoading, error } = useFolderPage(folder, page, PAGE_SIZE, true)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Selection is by slug so it survives re-renders; fall back to the first item
  // on the page when nothing is selected or the selection isn't on this page.
  const currentSlug = items.some((i) => i.slug === selectedSlug) ? (selectedSlug as string) : (items[0]?.slug ?? '')
  const currentItem = items.find((i) => i.slug === currentSlug)
  const detail = useItem(folder, currentSlug)

  const goto = (next: number) => {
    setSelectedSlug(null)
    setPage(Math.min(pageCount - 1, Math.max(0, next)))
  }

  if (isLoading && !data) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = page * PAGE_SIZE + items.length

  return (
    <div className="animate-fade-in">
      <PageHeader kicker={kicker} title={title} subtitle={subtitle} />

      {total === 0 ? (
        <p className="pad-x py-16 text-center font-mono text-xs text-faint">no entries</p>
      ) : (
        <div className="flex flex-wrap md:h-[calc(100vh-150px)]">
          {/* master list */}
          <div className="flex flex-[1_1_18rem] flex-col border-b border-border md:border-b-0 md:border-r">
            <div className="flex items-center justify-between border-b border-faintline px-4 py-2.5 font-mono text-3xs text-dim">
              <span>{from}–{to} of {total}</span>
              {pageCount > 1 && (
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
              {items.map((item) => {
                const on = item.slug === currentSlug
                const fm = item.frontmatter ?? {}
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => setSelectedSlug(item.slug)}
                    className="v2row flex w-full items-start gap-2.5 border-b border-faintline px-4 py-3.5 pl-4 text-left"
                  >
                    <span className={`w-1.5 flex-shrink-0 text-base leading-[1.3] ${on ? 'text-foreground' : 'text-transparent'}`}>
                      ▍
                    </span>
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-medium ${on ? 'text-foreground' : 'text-secondary'}`}>
                        {fm.title ?? item.slug}
                      </div>
                      <div className="mt-1 font-mono text-2xs text-faint">{meta(item)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* detail */}
          <div className="flex-[999_1_0] min-w-[min(100%,30rem)] overflow-y-auto pad-x pb-10 pt-7">
            {currentItem && (
              <>
                <div className="font-mono text-2xs text-dim">
                  {title.toUpperCase()} / {currentItem.slug}
                  {currentItem.frontmatter?.created ? ` · ${String(currentItem.frontmatter.created)}` : ''}
                </div>
                <h2 className="mt-2.5 text-2xl font-bold tracking-[-0.025em]">
                  {currentItem.frontmatter?.title ?? currentItem.slug}
                </h2>
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
      )}
    </div>
  )
}
