import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Crumbs, PageState } from '../../components/Crumbs'
import { useProjectFolderPage, useProjects } from '../../hooks/useContext'
import { displayTitle, docDate, shortDate } from '../../lib/hub'
import { paths } from '../../lib/nav'
import { isPlainAudience, stripCodes } from '../../lib/plain'
import type { ContextItem, Folder } from '../../types'
import { FOLDER_LABELS, FOLDER_SINGULAR } from '../../types'

const PAGE_SIZE = 40

const FOLDER_BLURB: Partial<Record<Folder, string>> = {
  progress: 'Status notes: where things stand now, the daily log, the week.',
  handoffs: 'What one session left for the next: where to pick up and what was learned.',
  processes: 'How the work is done here: the rules a session follows.',
  research: 'Questions studied on paper before anything was built.',
  loops: 'Long unattended runs: what each one was asked to do and what it did.',
  references: 'Facts worth keeping: names, addresses, decisions.',
  ideas: 'Things worth doing one day, not planned yet.',
  archive: 'Pages kept for the record.',
  reports: 'Checkpoints written for a reader outside the code.',
  standups: 'The morning note: yesterday, today, blockers.',
  roadmaps: 'The milestones in order and how far along each one is.',
}

function Row({ project, folder, item, plain }: { project: string; folder: Folder; item: ContextItem; plain: boolean }) {
  // The date column already says when; a page named only by its date reads as "Standup".
  const title = displayTitle(item, FOLDER_SINGULAR[folder]).replace(new RegExp(`^${FOLDER_SINGULAR[folder]}, .+$`), FOLDER_SINGULAR[folder])
  const tldr = typeof item.frontmatter?.tldr === 'string' ? item.frontmatter.tldr : ''
  const status = typeof item.frontmatter?.status === 'string' ? item.frontmatter.status : null
  return (
    <li>
      <Link to="/p/$project/$folder/$slug" params={{ project, folder, slug: item.slug }} className="row-link">
        <span className="when">{shortDate(docDate(item)) || '—'}</span>
        <span className="what">
          {plain ? stripCodes(title) : title}
          {status && status !== 'active' && (
            <span className="pill ml-2 align-middle" data-tone={status}>
              {status}
            </span>
          )}
        </span>
        {tldr && <span className="why">{plain ? stripCodes(tldr) : tldr}</span>}
      </Link>
    </li>
  )
}

export function FolderPage({ project, folder }: { project: string; folder: Folder }) {
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)
  const [pages, setPages] = useState(1)
  const first = useProjectFolderPage(project, folder, 0, PAGE_SIZE)
  const total = first.data?.total ?? 0

  if (first.isLoading) return <PageState>Loading…</PageState>
  if (first.error) return <PageState tone="error">Could not list {FOLDER_LABELS[folder].toLowerCase()}: {first.error.message}</PageState>

  return (
    <article className="reader animate-fade-in">
      <Crumbs items={[{ label: summary?.name ?? project, to: paths.home(project) }, { label: FOLDER_LABELS[folder] }]} />
      <h1 className="page-title">{FOLDER_LABELS[folder]}</h1>
      <p className="lede">{FOLDER_BLURB[folder] ?? ''}</p>
      <p className="meta-row">
        {total} page{total === 1 ? '' : 's'}
      </p>

      {total === 0 ? (
        <p className="mt-8 text-sm text-muted">This store has no {FOLDER_LABELS[folder].toLowerCase()} yet.</p>
      ) : (
        <ul className="rows mt-6">
          {(first.data?.items ?? []).map((it) => (
            <Row key={it.slug} project={project} folder={folder} item={it} plain={plain} />
          ))}
          {Array.from({ length: pages - 1 }, (_, i) => (
            <MorePage key={i + 1} project={project} folder={folder} page={i + 1} plain={plain} />
          ))}
        </ul>
      )}

      {total > pages * PAGE_SIZE && (
        <p className="mt-4">
          <button type="button" onClick={() => setPages((n) => n + 1)} className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm hover:bg-hover">
            Show more ({total - pages * PAGE_SIZE} left)
          </button>
        </p>
      )}
    </article>
  )
}

function MorePage({ project, folder, page, plain }: { project: string; folder: Folder; page: number; plain: boolean }) {
  const q = useProjectFolderPage(project, folder, page, PAGE_SIZE)
  return (
    <>
      {(q.data?.items ?? []).map((it) => (
        <Row key={it.slug} project={project} folder={folder} item={it} plain={plain} />
      ))}
    </>
  )
}
