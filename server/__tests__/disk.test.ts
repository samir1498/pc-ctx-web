import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diskSource } from '../disk.js'

describe('diskSource', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc-ctx-web-disk-'))
    await mkdir(join(root, 'plans'), { recursive: true })
    await mkdir(join(root, 'plans', 'archived'), { recursive: true })

    await writeFile(
      join(root, 'plans', '2024-01-01-alpha.md'),
      '---\ntitle: Alpha Rollout\nstatus: active\n---\n\nShip the alpha behind a flag.\n',
    )
    await writeFile(join(root, 'plans', 'no-frontmatter.md'), 'Just a note, no frontmatter here.\n')
    await writeFile(join(root, 'plans', 'notes.txt'), 'ignore me, not markdown\n')
    await writeFile(
      join(root, 'plans', 'archived', '2023-01-01-old-plan.md'),
      '---\ntitle: Old Plan\nstatus: archived\n---\n\nRetired after the pivot.\n',
    )
    // Sits outside the plans/ directory the source is scoped to — a traversal probe target.
    await writeFile(join(root, 'secret.md'), 'should never be readable through plans/\n')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists only markdown files, filtering non-markdown out', async () => {
    const source = diskSource(root)
    const entries = await source.list('plans')
    expect(entries).not.toBeNull()
    const names = (entries ?? []).map((e) => e.name)
    expect(names).toContain('2024-01-01-alpha.md')
    expect(names).toContain('no-frontmatter.md')
    expect(names).not.toContain('notes.txt')
  })

  it('returns null when the folder does not exist', async () => {
    const source = diskSource(root)
    expect(await source.list('roadmaps')).toBeNull()
  })

  it('maps plans-archived to plans/archived on disk', async () => {
    const source = diskSource(root)
    const entries = await source.list('plans-archived')
    expect(entries).not.toBeNull()
    const names = (entries ?? []).map((e) => e.name)
    expect(names).toEqual(['2023-01-01-old-plan.md'])
    expect(entries?.[0]?.path).toBe('plans/archived/2023-01-01-old-plan.md')
  })

  it('parses frontmatter and body for a file that has it', async () => {
    const source = diskSource(root)
    const [file] = await source.read('plans', ['2024-01-01-alpha.md'])
    expect(file?.frontmatter).toEqual({ title: 'Alpha Rollout', status: 'active' })
    expect(file?.body).toBe('Ship the alpha behind a flag.')
  })

  it('treats a file without frontmatter as plain body', async () => {
    const source = diskSource(root)
    const [file] = await source.read('plans', ['no-frontmatter.md'])
    expect(file?.frontmatter).toBeUndefined()
    expect(file?.body).toBe('Just a note, no frontmatter here.\n')
  })

  it('refuses a traversal attempt and never reads outside the folder', async () => {
    const source = diskSource(root)
    const result = await source.read('plans', ['..', '../secret.md', '../../etc/passwd'])
    expect(result).toEqual([])
  })
})
