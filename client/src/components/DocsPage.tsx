import { useMemo, useState } from 'react'
import type { ContextItem, Folder } from '../types'
import { useFolder } from '../hooks/useContext'
import { PageHeader } from './PageHeader'
import { MarkdownContent } from './MarkdownContent'
import { LoadingSpinner } from './LoadingSpinner'

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
  const { data: items, isLoading, error } = useFolder(folder)
  const [selected, setSelected] = useState(0)

  const list = useMemo(() => items ?? [], [items])
  const current = list[selected] ?? list[0]

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  return (
    <div className="animate-fade-in">
      <PageHeader kicker={kicker} title={title} subtitle={subtitle} />

      {list.length === 0 ? (
        <p className="pad-x py-16 text-center font-mono text-xs text-faint">no entries</p>
      ) : (
        <div className="flex flex-wrap md:h-[calc(100vh-150px)]">
          {/* master list */}
          <div className="flex-[1_1_18rem] overflow-y-auto border-b border-border md:border-b-0 md:border-r">
            {list.map((item, i) => {
              const on = i === selected
              const fm = item.frontmatter ?? {}
              return (
                <button
                  key={item.slug}
                  onClick={() => setSelected(i)}
                  className="v2row flex w-full items-start gap-2.5 border-b border-[#141417] px-4 py-3.5 pl-4 text-left"
                >
                  <span className="w-[5px] flex-shrink-0 text-[15px] leading-[1.3]" style={{ color: on ? '#f3f2ee' : 'transparent' }}>
                    ▍
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium" style={{ color: on ? '#f3f2ee' : '#bcbcc2' }}>
                      {fm.title ?? item.slug}
                    </div>
                    <div className="mt-1 font-mono text-[10.5px] text-faint">{meta(item)}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* detail */}
          <div className="flex-[999_1_0] min-w-[min(100%,30rem)] overflow-y-auto pad-x pb-10 pt-7">
            {current && (
              <>
                <div className="font-mono text-[11px] text-dim">
                  {title.toUpperCase()} / {current.slug}
                  {current.frontmatter?.created ? ` · ${String(current.frontmatter.created)}` : ''}
                </div>
                <h2 className="mt-2.5 text-[26px] font-bold tracking-[-0.025em]">
                  {current.frontmatter?.title ?? current.slug}
                </h2>
                <div className="mt-[18px] max-w-[720px]">
                  {current.body ? (
                    <MarkdownContent body={current.body} />
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
