import { useQuery } from '@tanstack/react-query'
import type { ContextItem, ContextItemDetail, Folder } from '../types'
import { fetchFolder, fetchItem } from '../api/client'

export function useFolder(folder: Folder) {
  return useQuery({
    queryKey: ['folder', folder],
    queryFn: () => fetchFolder(folder),
    staleTime: 30_000,
  })
}

export function useItem(folder: Folder, slug: string) {
  return useQuery({
    queryKey: ['item', folder, slug],
    queryFn: () => fetchItem(folder, slug),
    staleTime: 30_000,
    enabled: !!slug,
  })
}
