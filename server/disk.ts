import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import type { ContextSource, FolderEntry, FolderKey, ListEntry } from './source.js'
import { folderPath, isDocument, sortListEntries, toEntry, toListEntry } from './source.js'

// FolderKey is a closed union, so only filenames are attacker-controlled here.
// basename() rejects embedded separators, and the resolved-path check catches '..' itself.
function safeJoin(dir: string, name: string): string | null {
  if (name !== basename(name)) return null
  const dirResolved = resolve(dir)
  const full = resolve(join(dir, name))
  if (full !== dirResolved && !full.startsWith(dirResolved + sep)) return null
  return full
}

export function diskSource(rootDir: string): ContextSource {
  return {
    async list(folder: FolderKey): Promise<ListEntry[] | null> {
      const dir = join(rootDir, folderPath(folder))
      let names: string[]
      try {
        names = await readdir(dir)
      } catch {
        return null
      }

      const entries: ListEntry[] = []
      for (const name of names) {
        if (!isDocument(name)) continue
        const full = safeJoin(dir, name)
        if (!full) continue
        try {
          const info = await stat(full)
          if (!info.isFile()) continue
        } catch {
          continue
        }
        entries.push(toListEntry(folder, name))
      }
      return sortListEntries(entries)
    },

    async read(folder: FolderKey, names: string[]): Promise<FolderEntry[]> {
      const dir = join(rootDir, folderPath(folder))
      const out: FolderEntry[] = []
      for (const name of names) {
        const full = safeJoin(dir, name)
        if (!full) continue
        try {
          const raw = await readFile(full, 'utf-8')
          out.push(toEntry(folder, name, raw))
        } catch {
          // unreadable or missing — skip, matching list()'s best-effort semantics
        }
      }
      return out
    },
  }
}
