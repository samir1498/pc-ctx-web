interface ShotsProps {
  shots?: string[]
}

// Home's "latest standup" and the standup/report detail pages all show up to
// three screenshots, with dashed placeholders when the entry has none.
export function Shots({ shots }: ShotsProps) {
  const list = (shots ?? []).slice(0, 3)
  const placeholders = Math.max(0, 3 - list.length)

  return (
    <div className="my-3.5 grid grid-cols-3 gap-2.5">
      {list.map((src, i) => (
        <img key={src} src={src} alt={`shot ${i + 1}`} className="aspect-video w-full border border-border object-cover" />
      ))}
      {Array.from({ length: placeholders }).map((_, i) => (
        <div
          key={`ph-${i}`}
          className="flex aspect-video items-end border border-border bg-input p-2 font-mono text-2xs text-dim"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, var(--color-input), var(--color-input) 8px, var(--color-hover) 8px, var(--color-hover) 16px)',
          }}
        >
          no shot
        </div>
      ))}
    </div>
  )
}
