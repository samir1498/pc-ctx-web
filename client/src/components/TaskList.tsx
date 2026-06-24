import type { Task } from '../types'
<<<<<<< HEAD
import { statusColor, taskMark } from '../lib/ui'
=======
>>>>>>> origin/main

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  if (!tasks.length) return null

  return (
    <div>
      {tasks.map((task) => {
        const color = statusColor(task.status)
        return (
          <div key={task.id} className="flex items-start gap-3 border-b border-faintline py-3">
            <span className="w-[26px] pt-px font-mono text-[11px] text-faint">{task.id}</span>
            <span className="w-3.5 font-mono text-[13px]" style={{ color }}>
              {taskMark(task.status)}
            </span>
            <span className="flex-1 text-sm text-secondary">{task.title}</span>
            <span className="font-mono text-[10px] tracking-[0.03em]" style={{ color }}>
              {task.status ?? 'pending'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
