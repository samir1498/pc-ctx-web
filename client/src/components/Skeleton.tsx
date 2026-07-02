export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className ?? ''}`} />
}

export function SkeletonCard() {
  return (
    <div className="px-4 py-3 rounded-lg border border-border bg-panel space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-panel">
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-12 rounded" />
      <Skeleton className="h-4 w-16 rounded" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5 max-w-7xl animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="px-4 py-3 rounded-xl border border-border bg-panel space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-panel p-4 space-y-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-panel p-4 space-y-3">
            <Skeleton className="h-3 w-32" />
            {[1, 2, 3, 4, 5].map((j) => (
              <Skeleton key={j} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlansPageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-60 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-28 rounded" />
      </div>
      <div className="space-y-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
      <div className="flex items-center justify-between pt-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-7 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
