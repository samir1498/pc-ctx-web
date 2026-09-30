import { describe, expect, it } from 'vitest'
import { FOLDERS, folderPath, isDocument } from '../folders'

describe('folder layout', () => {
  it('knows the domains a store may carry, including loops and research', () => {
    expect(FOLDERS).toContain('loops')
    expect(FOLDERS).toContain('research')
    expect(folderPath('progress-standup')).toBe('progress/standup')
  })

  it('treats a README as the folder description, not a document', () => {
    expect(isDocument('README.md')).toBe(false)
    expect(isDocument('readme.mdx')).toBe(false)
    expect(isDocument('2026-09-22.md')).toBe(true)
    expect(isDocument('notes.txt')).toBe(false)
  })
})
