import { describe, expect, it } from 'vitest'
import { isPlainAudience, stripCodes } from './plain'

describe('isPlainAudience', () => {
  it('is true only for "plain"', () => {
    expect(isPlainAudience('plain')).toBe(true)
    expect(isPlainAudience('engineering')).toBe(false)
    expect(isPlainAudience(undefined)).toBe(false)
  })
})

describe('stripCodes', () => {
  it('drops a parenthetical PR reference', () => {
    expect(stripCodes('Login now works (PR #123).')).toBe('Login now works.')
  })

  it('drops a bare PR number outside parentheses', () => {
    expect(stripCodes('See #123 for the fix.')).toBe('See for the fix.')
  })

  it('drops a parenthetical commit hash', () => {
    expect(stripCodes('Deployed the fix (a1b2c3d).')).toBe('Deployed the fix.')
  })

  it('drops a standalone task id', () => {
    expect(stripCodes('T4 is done and D12 is next.')).toBe('is done and is next.')
  })

  it('drops a whole sentence that mentions a file path', () => {
    expect(stripCodes('The phone screen works. See client/src/lib/plain.ts for the code. Anouar can log in now.')).toBe(
      'The phone screen works. Anouar can log in now.',
    )
  })

  it('drops a path sentence that is hard-wrapped across lines, leaving no fragment', () => {
    const wrapped = 'The till is done. The live loop is\n`context/loops/2026-the-loop.md`; its handoff says\nwhere to pick up. Next is printing.'
    expect(stripCodes(wrapped)).toBe('The till is done. Next is printing.')
  })

  it('handles a wrapped status paragraph: bold lead, a path sentence, and a PR range split across lines', () => {
    const t =
      "**2026-01-02 08:45: the first module is merged.** The live loop is\n`context/loops/x.md`; its\nhandoff `context/handoffs/y.md`\nsays where to pick up. Merged since then: the split (#155 to\n#162), the screens and more."
    expect(stripCodes(t)).toBe('2026-01-02 08:45: the first module is merged. Merged since then: the split, the screens and more.')
  })

  it('flattens inline code, bold and links into the code, keeps a link to a web page', () => {
    expect(stripCodes('Run `npm test` and read [the doc](https://example.com), it is **important**.')).toBe(
      'Run npm test and read [the doc](https://example.com), it is important.',
    )
    expect(stripCodes('See [the PR](https://github.com/Dinar-dz/dz-pos/pull/223) and [the route](crates/api/src/routes.rs).')).toBe('See the PR and the route.')
  })

  it('preserves paragraph breaks and heading lines', () => {
    const input = '## Where it stands\n\nThe app is live. Anouar can invoice a sale.\n\nNext up is receipts.'
    expect(stripCodes(input)).toBe('## Where it stands\n\nThe app is live. Anouar can invoice a sale.\n\nNext up is receipts.')
  })

  it('leaves ordinary prose untouched', () => {
    expect(stripCodes('The register screen is ready for daily use.')).toBe('The register screen is ready for daily use.')
  })
})

describe('stripCodes keeps a markdown table whole', () => {
  it('blanks a path inside a row instead of dropping the row', () => {
    const table = '| Wave | Tasks | Why |\n|---|---|---|\n| 1 | T3 documents | disjoint code (core/API) |\n| 2 | T4 till | reads `the` model |'
    const out = stripCodes(table).split('\n')
    expect(out).toHaveLength(4)
    expect(out[2]).toBe('| 1 | documents | disjoint code () |')
    expect(out[3]).toBe('| 2 | till | reads the model |')
  })
})

describe('stripCodes keeps pictures and links whole', () => {
  it('leaves a markdown image, its caption and a link untouched, and still drops a path in prose', () => {
    const md = 'The path src/till.rs was wrong. ![Supplier account](../media/reports/s.png "The supplier\'s account. The balance is right.") See [the clip](https://x.example/c.mp4) and [the page](../designs/screens.md).'
    const out = stripCodes(md)
    expect(out).toContain('![Supplier account](../media/reports/s.png "The supplier\'s account. The balance is right.")')
    expect(out).toContain('[the clip](https://x.example/c.mp4)')
    expect(out).toContain('[the page](../designs/screens.md)')
    expect(out).not.toContain('src/till.rs')
  })
})
