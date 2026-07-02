import { useQuery } from '@tanstack/react-query'
import type { Folder } from '../types'
import { fetchCounts, fetchFolder, fetchItem } from '../api/client'

export function useFolder(folder: Folder, meta = false) {
  return useQuery({
    queryKey: ['folder', folder, meta ? 'meta' : 'full'],
    queryFn: () => fetchFolder(folder, meta),
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
