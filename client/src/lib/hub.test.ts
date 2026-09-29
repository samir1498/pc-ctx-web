import { describe, expect, it } from 'vitest'
import type { ContextItem, Task } from '../types'
import { countByStatus, groupTasks, planProgress, taskText } from './hub'

// A fixture plan shaped like the shop findings one: many tasks, a few open.
const tasks: Task[] = [
  { id: 'T1', desc: 'Ticket footer', status: 'done' },
  { id: 'T2', desc: 'Supplier row spacing', status: 'pending' },
  { id: 'T3', desc: "Align the buttons' centre line", status: 'in-progress' },
  { id: 'T4', desc: 'Old idea', status: 'cancelled' },
  { id: 'T5', desc: 'Needs the printer', status: 'blocked' },
  { id: 'T6', title: 'Legacy title field', status: 'done' },
  { id: 'T7', desc: 'No status yet' },
]
const plan: ContextItem = { slug: '20260924-shop-manual-test-findings', name: 'x.md', path: 'plans/x.md', frontmatter: { title: 'Shop manual test findings', tasks } }

describe('a plan with tasks renders them grouped', () => {
  it('puts in-progress, blocked and to-do first, in that order, file order within', () => {
    const { open } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['T3', 'T5', 'T2', 'T7'])
  })

  it('keeps done and cancelled apart for the fold at the bottom', () => {
    const { closed } = groupTasks(tasks)
    expect(closed.map((t) => t.id)).toEqual(['T1', 'T4', 'T6'])
    expect(countByStatus(closed)).toEqual([
      ['done', 2],
      ['cancelled', 1],
    ])
  })

  it('counts progress without cancelled tasks in the denominator', () => {
    expect(planProgress(plan)).toEqual({ done: 2, total: 6, pct: 33 })
    expect(planProgress({ ...plan, frontmatter: { tasks: [] } })).toEqual({ done: 0, total: 0, pct: 0 })
  })

  it('reads the row text from desc, then title, then the id', () => {
    expect(taskText(tasks[2] as Task)).toBe("Align the buttons' centre line")
    expect(taskText(tasks[5] as Task)).toBe('Legacy title field')
    expect(taskText({ id: 'T9' })).toBe('T9')
  })
})
