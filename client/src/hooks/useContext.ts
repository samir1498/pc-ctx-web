import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Folder, ProjectConfigEntry, ProjectFolder } from '../types'
import {
  fetchConfig,
  fetchCounts,
  fetchFolder,
  fetchFolderList,
  fetchFolderPage,
  fetchFsListing,
  fetchGithubBranches,
  fetchGithubRepos,
  fetchGithubTree,
  fetchItem,
  fetchProjectCounts,
  fetchProjectFolder,
  fetchProjectFolderList,
  fetchProjectItem,
  fetchProjects,
  removeToken,
  saveProjectConfigs,
  saveToken,
} from '../api/client'

export function useFolder(folder: Folder, meta = false) {
  return useQuery({
    queryKey: ['folder', folder, meta ? 'meta' : 'full'],
    queryFn: () => fetchFolder(folder, meta),
    retry: false,
  })
}

// Every slug in a folder (names only), for folder-wide search. Only fires once
// enabled (i.e. the user has started searching), so it costs nothing otherwise.
export function useFolderList(folder: Folder, enabled: boolean) {
  return useQuery({
    queryKey: ['folder-list', folder],
    queryFn: () => fetchFolderList(folder),
    enabled,
    retry: false,
  })
}

// One page of a folder (frontmatter only by default). keepPreviousData holds the
// current page on screen while the next one loads, so paging doesn't flash.
export function useFolderPage(folder: Folder, page: number, size: number, meta = true) {
  return useQuery({
    queryKey: ['folder-page', folder, page, size, meta ? 'meta' : 'full'],
    queryFn: () => fetchFolderPage(folder, page, size, meta),
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useItem(folder: Folder, slug: string) {
  return useQuery({
    queryKey: ['item', folder, slug],
    queryFn: () => fetchItem(folder, slug),
    enabled: !!slug,
  })
}

// Folder counts in a single request (no bodies). Degrades quietly on older
// servers that don't expose /api/counts (retry: false, callers guard undefined).
export function useCounts() {
  return useQuery({
    queryKey: ['counts'],
    queryFn: fetchCounts,
    retry: false,
  })
}

// ---- multi-project hub ----

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: fetchProjects, retry: false })
}

export function useProjectFolder(project: string, folder: ProjectFolder, meta = false, enabled = true) {
  return useQuery({
    queryKey: ['p', project, 'folder', folder, meta ? 'meta' : 'full'],
    queryFn: () => fetchProjectFolder(project, folder, meta),
    enabled: enabled && !!project,
    retry: false,
  })
}

export function useProjectFolderList(project: string, folder: ProjectFolder, enabled = true) {
  return useQuery({
    queryKey: ['p', project, 'folder-list', folder],
    queryFn: () => fetchProjectFolderList(project, folder),
    enabled: enabled && !!project,
    retry: false,
  })
}

export function useProjectItem(project: string, folder: ProjectFolder, slug: string, enabled = true) {
  return useQuery({
    queryKey: ['p', project, 'item', folder, slug],
    queryFn: () => fetchProjectItem(project, folder, slug),
    enabled: enabled && !!project && !!slug,
    retry: false,
  })
}

export function useProjectCounts(project: string) {
  return useQuery({
    queryKey: ['p', project, 'counts'],
    queryFn: () => fetchProjectCounts(project),
    enabled: !!project,
    retry: false,
  })
}

// Falls back to a plan's archived copy when it is missing from the live 'plans'
// folder — the board's archived column and a bare plan URL share this lookup.
// The archived lookup only fires once the live one has resolved and come up empty.
export function useProjectPlan(project: string, slug: string) {
  const live = useProjectItem(project, 'plans', slug)
  const notInLive = live.isSuccess && !live.data
  const archived = useProjectItem(project, 'plans-archived', slug, notInLive)
  return {
    data: live.data ?? (notInLive ? archived.data : undefined),
    archived: notInLive && !!archived.data,
    isLoading: live.isLoading || (notInLive && archived.isLoading),
    error: live.error ?? (notInLive ? archived.error : null),
  }
}

// ---- settings ----

export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: fetchConfig, retry: false })
}

export function useSaveProjects() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projects: ProjectConfigEntry[]) => saveProjectConfigs(projects),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useSaveToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, token }: { owner: string; token: string }) => saveToken(owner, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config'] }),
  })
}

export function useRemoveToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (owner: string) => removeToken(owner),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config'] }),
  })
}

export function useGithubRepos(owner: string, enabled: boolean) {
  return useQuery({ queryKey: ['gh-repos', owner], queryFn: () => fetchGithubRepos(owner), enabled, retry: false })
}

export function useGithubBranches(owner: string, repo: string, enabled: boolean) {
  return useQuery({ queryKey: ['gh-branches', owner, repo], queryFn: () => fetchGithubBranches(owner, repo), enabled, retry: false })
}

export function useGithubTree(owner: string, repo: string, branch: string, path: string, enabled: boolean) {
  return useQuery({
    queryKey: ['gh-tree', owner, repo, branch, path],
    queryFn: () => fetchGithubTree(owner, repo, branch, path),
    enabled,
    retry: false,
  })
}

export function useFsListing(path: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['fs', path ?? ''], queryFn: () => fetchFsListing(path), enabled, retry: false })
}
