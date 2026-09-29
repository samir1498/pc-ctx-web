import type { Task } from '../types'
import { countByStatus, groupTasks, taskText } from '../lib/hub'
import { stripCodes } from '../lib/plain'
import { statusColor, taskMark } from '../lib/ui'

interface TaskListProps {
  tasks: Task[]
  plain?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  'in-progress': 'in progress',
  pending: 'to do',
  blocked: 'blocked',
  done: 'done',
  cancelled: 'cancelled',
}

// A plain reader still gets the id: it is how a task is named in a standup.
function TaskRow({ task, plain }: { task: Task; plain: boolean }) {
  const status = task.status ?? 'pending'
  const color = statusColor(status)
  const raw = taskText(task)
  const text = (plain ? stripCodes(raw).trim() : raw) || raw
  const note = task.note ? (plain ? stripCodes(task.note).trim() || task.note : task.note) : ''
  return (
    <li className="task-row" data-status={status}>
      <span className="task-mark" style={{ color }} aria-hidden="true">
        {taskMark(status)}
      </span>
      <span className="task-id">{task.id}</span>
      <span className="task-text">
        {text}
        {note && <span className="task-note">{note}</span>}
      </span>
      <span className="task-status" style={{ color }}>
        {STATUS_LABEL[status] ?? status}
      </span>
    </li>
  )
}

const FOLD_FROM = 6

export function TaskList({ tasks, plain = false }: TaskListProps) {
  if (!tasks.length) return null
  const { open, closed } = groupTasks(tasks)
  const summary = countByStatus(closed)
    .map(([status, n]) => `${n} ${STATUS_LABEL[status] ?? status}`)
    .join(' · ')
  // Nothing open: the closed list is the whole story, so it stays unfolded.
  const foldClosed = open.length > 0 && closed.length >= FOLD_FROM

  return (
    <div className="tasks">
      {open.length > 0 && <ol className="task-list">{open.map((t) => <TaskRow key={t.id} task={t} plain={plain} />)}</ol>}
      {closed.length > 0 &&
        (foldClosed ? (
          <details className="task-fold">
            <summary>{summary}</summary>
            <ol className="task-list">{closed.map((t) => <TaskRow key={t.id} task={t} plain={plain} />)}</ol>
          </details>
        ) : (
          <ol className="task-list">{closed.map((t) => <TaskRow key={t.id} task={t} plain={plain} />)}</ol>
        ))}
    </div>
  )
}
