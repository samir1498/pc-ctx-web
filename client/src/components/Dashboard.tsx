import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { useFolder } from '../hooks/useContext'
import type { ContextItem } from '../types'
import { AnimatedCounter } from './AnimatedCounter'
import { DonutChart } from './DonutChart'
import { BarChart } from './BarChart'
import { DashboardSkeleton } from './Skeleton'
import { Target, Map, BookOpen, TrendingUp, ArrowUpRight } from 'lucide-react'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

function StatCard({ label, count, icon: Icon, color }: { label: string; count: number; icon: React.ElementType; color: string }) {
  return (
    <motion.div variants={itemVariants} className="relative px-4 py-3 rounded-xl border border-border bg-surface overflow-hidden group">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${color}08, transparent)` }} />
      <div className="relative flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[11px] font-medium text-secondary uppercase tracking-wider">{label}</span>
          <div className="text-xl font-bold text-foreground tabular-nums">
            <AnimatedCounter to={count} />
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </motion.div>
  )
}

function PlanCard({ item }: { item: ContextItem }) {
  const navigate = useNavigate()
  const fm = item.frontmatter
  const title = fm?.title || item.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const status = fm?.status
  const prio = fm?.priority
  const tldr = fm?.tldr

  return (
    <motion.button
      variants={itemVariants}
      whileHover={{ scale: 1.01, x: 4 }}
      onClick={() => navigate({ to: '/plan/$slug', params: { slug: item.slug } })}
      className="w-full text-left px-3.5 py-2.5 rounded-xl border border-border bg-surface hover:border-accent/40 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-secondary/40 group-hover:text-accent transition-colors shrink-0" />
          </div>
          {tldr && <p className="text-xs text-secondary/70 mt-0.5 line-clamp-1">{tldr}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {prio !== undefined && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
              prio >= 80 ? 'text-red bg-red-bg border-red/20' :
              prio >= 50 ? 'text-amber bg-amber-bg border-amber/20' :
              'text-secondary bg-elevated border-border'
            }`}>P{prio}</span>
          )}
          {status && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
              status === 'active' ? 'text-green bg-green-bg border-green/20' :
              status === 'paused' ? 'text-amber bg-amber-bg border-amber/20' :
              status === 'done' ? 'text-blue bg-blue-bg border-blue/20' :
              'text-secondary bg-elevated border-border'
            }`}>{status}</span>
          )}
        </div>
      </div>
    </motion.button>
  )
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <motion.div variants={itemVariants} className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-accent/50 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground truncate">{label}</p>
        <p className="text-[10px] text-secondary/60">{date}</p>
      </div>
    </motion.div>
  )
}

export function Dashboard() {
  const plans = useFolder('plans')
  const roadmaps = useFolder('roadmaps')
  const references = useFolder('references')
  const progress = useFolder('progress')

  const isLoading = plans.isLoading || roadmaps.isLoading || references.isLoading || progress.isLoading
  const error = plans.error || roadmaps.error || references.error || progress.error

  const statusData = useMemo(() => {
    if (!plans.data) return []
    const counts: Record<string, number> = { active: 0, paused: 0, done: 0, cancelled: 0 }
    for (const p of plans.data) {
      const s = p.frontmatter?.status || 'other'
      counts[s] = (counts[s] || 0) + 1
    }
    return [
      { label: 'Active', value: counts.active, color: '#22c55e' },
      { label: 'Paused', value: counts.paused, color: '#f59e0b' },
      { label: 'Done', value: counts.done, color: '#3b82f6' },
      { label: 'Cancelled', value: counts.cancelled, color: '#ef4444' },
    ].filter((d) => d.value > 0)
  }, [plans.data])

  const weekData = useMemo(() => {
    if (!progress.data) return []
    const items = progress.data
      .filter((p) => /^\d{4}-W\d{2}/.test(p.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-8)
    return items.map((p) => {
      const label = p.name.replace(/^(\d{4})-W(\d{2}).*/, 'W$2')
      const body = p.body || ''
      const lines = body.split('\n').filter((l) => /^- /.test(l)).length
      return { label, value: Math.max(lines, 2) }
    })
  }, [progress.data])

  const topPlans = useMemo(() => {
    if (!plans.data) return []
    return [...plans.data]
      .sort((a, b) => (b.frontmatter?.priority || 0) - (a.frontmatter?.priority || 0))
      .slice(0, 5)
  }, [plans.data])

  const recentProgress = useMemo(() => {
    if (!progress.data) return []
    return [...progress.data].slice(-4).reverse()
  }, [progress.data])

  if (isLoading) return <DashboardSkeleton />
  if (error) return <div className="text-red text-sm">Error: {(error as Error).message}</div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5 max-w-7xl">
      <motion.div variants={itemVariants}>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-secondary mt-0.5">
          <AnimatedCounter to={(plans.data?.length ?? 0) + (roadmaps.data?.length ?? 0) + (references.data?.length ?? 0) + (progress.data?.length ?? 0)} /> items across 4 domains
        </p>
      </motion.div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Plans" count={plans.data?.length ?? 0} icon={Target} color="#22c55e" />
        <StatCard label="Roadmaps" count={roadmaps.data?.length ?? 0} icon={Map} color="#3b82f6" />
        <StatCard label="References" count={references.data?.length ?? 0} icon={BookOpen} color="#f59e0b" />
        <StatCard label="Progress" count={progress.data?.length ?? 0} icon={TrendingUp} color="#a78bfa" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Status Distribution</h3>
          <div className="flex items-center gap-5">
            <DonutChart data={statusData.length > 0 ? statusData : [{ label: 'No data', value: 1, color: '#27272a' }]} />
            <div className="space-y-1.5">
              {statusData.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-secondary">{d.label}</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Weekly Activity</h3>
          {weekData.length > 0 ? (
            <BarChart data={weekData} color="#6366f1" />
          ) : (
            <p className="text-xs text-secondary/60 py-6 text-center">No progress data yet</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Top Plans</h3>
          <div className="space-y-1">
            {topPlans.map((p) => <PlanCard key={p.slug} item={p} />)}
            {topPlans.length === 0 && <p className="text-xs text-secondary/60 py-6 text-center">No plans yet</p>}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Recent Progress</h3>
          <div className="space-y-2">
            {recentProgress.map((p) => (
              <TimelineItem key={p.slug} label={p.name.replace(/\.md$/, '')} date={p.slug.replace(/^\d{4}-W(\d{2}).*/, 'Week $1')} />
            ))}
            {recentProgress.length === 0 && <p className="text-xs text-secondary/60 py-6 text-center">No progress entries</p>}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
