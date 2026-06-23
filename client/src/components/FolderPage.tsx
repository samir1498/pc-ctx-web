import { useState } from 'react'
import type { ContextItem, Folder } from '../types'
import { useFolder } from '../hooks/useContext'
import { ItemCard } from './ItemCard'
import { MarkdownContent } from './MarkdownContent'
import { LoadingSpinner } from './LoadingSpinner'
import { ChevronLeft } from './Icons'
import { FOLDER_LABELS } from '../types'

interface FolderPageProps {
  folder: Folder
  renderItemMeta?: (item: ContextItem) => React.ReactNode
  renderDetailMeta?: (item: ContextItem) => React.ReactNode
}

export function FolderPage({ folder, renderItemMeta, renderDetailMeta }: FolderPageProps) {
  const [selected, setSelected] = useState<ContextItem | null>(null)
  const { data: items, isLoading, error } = useFolder(folder)

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="text-red text-sm">Error: {(error as Error).message}</div>

  if (selected) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-xs text-secondary hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft />
          {FOLDER_LABELS[folder]}
        </button>
        <article>
          <h1 className="text-xl font-semibold text-foreground mb-6">
            {(selected.frontmatter?.title as string) || selected.slug}
          </h1>
          {renderDetailMeta?.(selected)}
          {selected.body && <MarkdownContent body={selected.body} />}
        </article>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">{FOLDER_LABELS[folder]}</h2>
        <p className="text-xs text-secondary mt-0.5">{items?.length ?? 0} file{(items?.length ?? 0) !== 1 ? 's' : ''}</p>
      </div>
      <div className="space-y-1.5">
        {items?.map((item) => (
          <div key={item.slug}>
            <ItemCard item={item} onClick={() => setSelected(item)} />
            {renderItemMeta?.(item)}
          </div>
        ))}
        {(!items || items.length === 0) && (
          <p className="text-secondary text-xs py-12 text-center">No {FOLDER_LABELS[folder].toLowerCase()} found.</p>
        )}
      </div>
    </div>
  )
}
