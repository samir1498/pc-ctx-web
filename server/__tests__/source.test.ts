import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../source.js'

describe('parseFrontmatter', () => {
  it('keeps the top-level title and status when one task string is invalid YAML', () => {
    const raw = "---\ntitle: 'Till login'\nslug: 'till-login'\nstatus: 'active'\ncreated: 20260101\ntasks:\n  - id: 'T1'\n    desc: 'the button's label'\n---\n# Body\n"
    const parsed = parseFrontmatter(raw)
    expect(parsed?.frontmatter.title).toBe('Till login')
    expect(parsed?.frontmatter.status).toBe('active')
    expect(parsed?.frontmatter.created).toBe(20260101)
    expect(parsed?.frontmatter.frontmatterError).toBe(true)
    expect(parsed?.body).toBe('# Body')
  })
})
