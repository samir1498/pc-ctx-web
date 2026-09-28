import { useMemo } from 'react'
import { useLocation } from '@tanstack/react-router'
import type { Folder } from '../types'
import { useProjectCounts, useProjectFolder, useProjectFolderList, useProjects } from './useContext'
import { buildSidebar, parseHubPath } from '../lib/nav'
import type { NavGroup } from '../lib/nav'
import { isPlainAudience, stripCodes } from '../lib/plain'
import { LIBRARY_FOLDERS } from '../lib/nav'

// Everything the sidebar needs for one project, fetched once and shared by
// every page under it: counts first, then the folders the rail lists by name.
export function useHubNav(project: string | undefined): { groups: NavGroup[]; loading: boolean } {
  const { pathname } = useLocation()
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)
  const pid = project ?? ''

  const counts = useProjectCounts(pid)
  const c = counts.data
  const plans = useProjectFolder(pid, 'plans', true)
  const reports = useProjectFolder(pid, 'reports', true, (c?.reports ?? 0) > 0)
  const standups = useProjectFolder(pid, 'standups', true, (c?.standups ?? 0) > 0)
  const roadmaps = useProjectFolder(pid, 'roadmaps', true, (c?.roadmaps ?? 0) > 0)
  const designs = useProjectFolder(pid, 'designs', true, (c?.designs ?? 0) > 0)
  const research = useProjectFolder(pid, 'research', true, (c?.research ?? 0) > 0)

  const here = parseHubPath(pathname)
  const openFolder: Folder | null = here && here.folder && LIBRARY_FOLDERS.includes(here.folder as Folder) ? (here.folder as Folder) : null
  const folderList = useProjectFolderList(pid, openFolder ?? 'plans', openFolder !== null)

  const groups = useMemo(() => {
    if (!project) return []
    return buildSidebar({
      project,
      path: pathname,
      counts: c,
      plans: plans.data,
      reports: reports.data,
      standups: standups.data,
      roadmaps: roadmaps.data,
      designs: designs.data,
      research: research.data,
      folderItems: openFolder && folderList.data ? { folder: openFolder, items: folderList.data } : undefined,
      label: plain ? stripCodes : undefined,
    })
  }, [project, pathname, c, plans.data, reports.data, standups.data, roadmaps.data, designs.data, research.data, openFolder, folderList.data, plain])

  return { groups, loading: counts.isLoading || plans.isLoading }
}
