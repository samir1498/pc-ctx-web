import type { Folder } from '../doc/types'
import { FOLDER_LABELS, FOLDER_SINGULAR } from '../doc/types'

export const PRIMARY: Folder[] = ['plans', 'progress', 'reports', 'designs', 'ideas', 'research', 'references', 'handoffs']
export const SECONDARY: Folder[] = ['standups', 'roadmaps', 'processes', 'loops', 'archive']
export const SECTIONS: Folder[] = [...PRIMARY, ...SECONDARY]

export const BLURB: Record<Folder, string> = {
  plans: 'What is being built, its tasks and where each one stands.',
  progress: 'Dated log of what shipped and what changed.',
  reports: 'Measured write-ups: numbers, charts, findings.',
  designs: 'Kept HTML pages and pictures: mockups and screens.',
  ideas: 'Things worth doing later, not yet planned.',
  research: 'Reading notes and comparisons behind a decision.',
  references: 'Facts to look up: limits, prices, rules.',
  handoffs: 'Where a session stopped and what comes next.',
  standups: 'Daily status pages.',
  roadmaps: 'Longer arcs, grouped by product.',
  processes: 'How the team builds, tests and ships.',
  loops: 'Repeated runs of a plan, one page per run.',
  archive: 'Finished or dropped, kept for the record.',
}

export const label = (f: Folder) => FOLDER_LABELS[f]
export const singular = (f: Folder) => FOLDER_SINGULAR[f]

export function isSection(v: string): v is Folder {
  return (SECTIONS as string[]).includes(v)
}

/** Status sets a section's frontmatter uses; a section without one gets no status chart. */
export const STATUS_SECTIONS: Partial<Record<Folder, { key: string; label: string; tone: Tone }[]>> = {
  plans: [
    { key: 'active', label: 'Active', tone: 'accent' },
    { key: 'draft', label: 'Draft', tone: 'dim' },
    { key: 'paused', label: 'Paused', tone: 'warn' },
    { key: 'done', label: 'Done', tone: 'good' },
    { key: 'cancelled', label: 'Cancelled', tone: 'bad' },
  ],
  ideas: [
    { key: 'new', label: 'New', tone: 'accent' },
    { key: 'planned', label: 'Planned', tone: 'good' },
    { key: 'parked', label: 'Parked', tone: 'warn' },
    { key: 'dropped', label: 'Dropped', tone: 'dim' },
  ],
  roadmaps: [
    { key: 'active', label: 'Active', tone: 'accent' },
    { key: 'done', label: 'Done', tone: 'good' },
  ],
}

export type Tone = 'accent' | 'good' | 'warn' | 'bad' | 'dim'

export const PLAIN_STATUS: Record<string, string> = { active: 'In progress', paused: 'Waiting', done: 'Done', cancelled: 'Cancelled', draft: 'Draft' }
