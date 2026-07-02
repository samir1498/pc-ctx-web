import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Folder } from '../types'
import { fetchCounts, fetchFolder, fetchFolderList, fetchFolderPage, fetchItem } from '../api/client'

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
