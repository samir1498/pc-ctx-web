import type { Task } from '../types'
import { taskText } from '../lib/hub'
import { statusColor, taskMark } from '../lib/ui'

interface TaskListProps {
  tasks: Task[]
  showIds?: boolean
}

export function TaskList({ tasks, showIds = true }: TaskListProps) {
  if (!tasks.length) return null

  return (
    <ol className="m-0 list-none p-0">
      {tasks.map((task) => {
        const color = statusColor(task.status)
        const status = task.status ?? 'pending'
        return (
          <li key={task.id} className="flex items-start gap-3 border-b border-faintline py-3 last:border-b-0">
            <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-sm leading-6" style={{ color }} aria-hidden="true">
              {taskMark(task.status)}
            </span>
            <span className="min-w-0 flex-1 text-[0.95rem] leading-6 text-secondary">
              {showIds && <span className="mr-2 font-mono text-xs text-faint">{task.id}</span>}
              {taskText(task)}
            </span>
            <span className="shrink-0 pt-1 font-mono text-2xs" style={{ color }}>
              {status}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
