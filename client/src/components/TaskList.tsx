import type { Task } from '../types'

interface TaskListProps {
  tasks: Task[]
}

const statusStyles: Record<string, string> = {
  done: 'text-green bg-green-bg border-green/20',
  'in-progress': 'text-blue bg-blue-bg border-blue/20',
  pending: 'text-secondary bg-elevated border-border',
  blocked: 'text-red bg-red-bg border-red/20',
}

const statusIcons: Record<string, string> = {
  done: '✓',
  'in-progress': '◷',
  pending: '○',
  blocked: '⊗',
}

export function TaskList({ tasks }: TaskListProps) {
  if (!tasks.length) return null

  return (
    <div className="space-y-1">
      {tasks.map((task) => {
        const s = statusStyles[task.status || 'pending'] || statusStyles.pending
        return (
          <div key={task.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-md border ${s}`}>
            <span className="text-xs w-4 text-center shrink-0">{statusIcons[task.status || 'pending'] || '○'}</span>
            <span className="text-xs text-foreground">{task.desc ?? task.title}</span>
          </div>
        )
      })}
    </div>
  )
}
