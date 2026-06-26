interface PageHeaderProps {
  kicker: string
  title: string
  subtitle?: React.ReactNode
  isNew?: boolean
}

export function PageHeader({ kicker, title, subtitle, isNew }: PageHeaderProps) {
  return (
    <div className="border-b border-border px-10 pb-[22px] pt-[26px]">
      <div className="font-mono text-[11px] tracking-[0.1em] text-dim">
        {kicker}
        {isNew && <span className="ml-2 text-green">NEW</span>}
      </div>
      <h1 className="mt-3 text-[40px] font-bold tracking-[-0.03em]">{title}</h1>
      {subtitle && <p className="mt-2.5 font-mono text-xs text-muted">{subtitle}</p>}
    </div>
  )
}
