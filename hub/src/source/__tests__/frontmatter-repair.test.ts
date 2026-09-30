import { describe, expect, it } from 'vitest'
import { parseFrontmatter, recoverTasks, repairSingleQuotes } from '../frontmatter'

type TaskRow = { id: string; desc?: string; title?: string; status?: string }
const tasksOf = (raw: string): TaskRow[] => {
  const tasks = parseFrontmatter(raw)?.frontmatter.tasks
  return Array.isArray(tasks) ? (tasks as TaskRow[]) : []
}

// The shop findings plan: 67 tasks, one desc with "the buttons' centre".
const APOSTROPHE_PLAN = `---
title: 'Shop manual test findings'
status: 'active'
tasks:
  - id: 'T1'
    desc: 'The label sits higher than the buttons' centre line; align it'
    status: 'pending'
  - id: 'T2'
    desc: 'Keep the comptable''s answer with its date'
    status: 'done'
acceptance:
  - 'Every finding has a task'
---

# Shop manual test findings
`

// One OO plan folds a desc over blank lines and ends it with "'," (a writer bug).
const FOLDED_PLAN = `---
title: 'Comped subscriptions'
tasks:
  - id: 'T3'
    desc: 'URGENT: decide before the cap.

      RESOLVED (a): the sweep never touched Stripe's row.

      (b) is UNRESOLVED and still Samir's call.',
    status: 'pending'
  - id: 'T4'
    desc: 'Plain'
    status: 'done'
---
`

describe('parseFrontmatter keeps tasks despite a stray apostrophe', () => {
  it('escapes a lone quote inside a single-line scalar and keeps doubled ones', () => {
    const tasks = tasksOf(APOSTROPHE_PLAN)
    expect(tasks.map((t) => t.id)).toEqual(['T1', 'T2'])
    expect(tasks[0]?.desc).toBe("The label sits higher than the buttons' centre line; align it")
    expect(tasks[1]?.desc).toBe("Keep the comptable's answer with its date")
    expect(parseFrontmatter(APOSTROPHE_PLAN)?.frontmatter.acceptance).toEqual(['Every finding has a task'])
    expect(parseFrontmatter(APOSTROPHE_PLAN)?.frontmatter.frontmatterError).toBeUndefined()
  })

  it('repairs a scalar folded over blank lines, dropping a comma after the closing quote', () => {
    const tasks = tasksOf(FOLDED_PLAN)
    expect(tasks.map((t) => t.id)).toEqual(['T3', 'T4'])
    expect(tasks[0]?.desc).toContain("Stripe's row")
    expect(tasks[0]?.desc).toContain("Samir's call.")
    expect(tasks[0]?.status).toBe('pending')
  })

  it('leaves valid YAML untouched', () => {
    const yaml = "title: 'It''s fine'\ntasks:\n  - id: 'T1'\n    desc: 'ok'\n"
    expect(repairSingleQuotes(yaml)).toBe(yaml)
  })

  it('falls back to line-by-line task rows when the YAML is beyond repair', () => {
    const yaml = "title: 'Broken'\nstatus: active\ntasks:\n  - id: 'T1'\n    desc: 'Comps never lapse.' []\n    status: 'done'\n  - id: 'T2'\n    desc: \"Second\"\n    status: 'pending'\nacceptance: []\n"
    expect(recoverTasks(yaml)).toEqual([
      { id: 'T1', desc: 'Comps never lapse.', status: 'done' },
      { id: 'T2', desc: 'Second', status: 'pending' },
    ])
    const parsed = parseFrontmatter(`---\n${yaml}---\n\nBody.\n`)
    expect(parsed?.frontmatter.frontmatterError).toBe(true)
    expect(parsed?.frontmatter.status).toBe('active')
    expect(Array.isArray(parsed?.frontmatter.tasks)).toBe(true)
    expect(parsed?.body).toBe('Body.')
  })
})

describe('parseFrontmatter dates', () => {
  it('keeps an unquoted date as the string it was written as', () => {
    const fm = parseFrontmatter('---\ndate: 2026-09-30\n---\nbody')?.frontmatter
    expect(fm?.date).toBe('2026-09-30')
  })
})
