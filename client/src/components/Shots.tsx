interface ShotsProps {
  shots?: string[]
}

// Up to three screenshots from a standup or report's frontmatter. An entry
// without any renders nothing: an empty frame would only say "no shot".
export function Shots({ shots }: ShotsProps) {
  const list = (shots ?? []).slice(0, 3)
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
