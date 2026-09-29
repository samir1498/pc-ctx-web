import { resolveStoreUrl } from '../lib/media'

interface ShotsProps {
  shots?: string[]
  project?: string
  docPath?: string
}

// Up to three screenshots from a standup or report's frontmatter, written as
// ../media/... in the store. An entry without any renders nothing: an empty
// frame would only say "no shot".
export function Shots({ shots, project, docPath }: ShotsProps) {
  const list = (shots ?? []).slice(0, 3).map((s) => (project && docPath ? resolveStoreUrl(s, project, docPath) : s))
  if (list.length === 0) return null

  return (
    <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {list.map((src, i) => (
        <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
          <img src={src} alt={`Screenshot ${i + 1}`} loading="lazy" className="aspect-video w-full rounded-sm border border-border object-cover object-top" />
        </a>
      ))}
    </div>
  )
}
