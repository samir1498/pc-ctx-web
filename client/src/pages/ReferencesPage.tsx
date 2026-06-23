import type { ContextItem } from '../types'
import { FolderPage } from '../components/FolderPage'

function TagsMeta({ item }: { item: ContextItem }) {
  const tags = item.frontmatter?.tags
  if (!Array.isArray(tags)) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.map((tag: string) => (
        <span key={tag} className="px-1.5 py-0.5 rounded text-xs font-medium bg-elevated text-secondary">
          {tag}
        </span>
      ))}
    </div>
  )
}

function DetailTagsMeta({ item }: { item: ContextItem }) {
  const tags = item.frontmatter?.tags
  if (!Array.isArray(tags)) return null
  return (
    <div className="flex flex-wrap gap-1.5 mb-6">
      {tags.map((tag: string) => (
        <span key={tag} className="px-2 py-0.5 rounded text-xs font-medium bg-elevated text-secondary border border-border">
          {tag}
        </span>
      ))}
    </div>
  )
}

export function ReferencesPage() {
  return (
    <FolderPage
      folder="references"
      renderItemMeta={(item) => <TagsMeta item={item} />}
      renderDetailMeta={(item) => <DetailTagsMeta item={item} />}
    />
  )
}
