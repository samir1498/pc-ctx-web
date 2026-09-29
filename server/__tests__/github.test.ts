import { afterEach, describe, expect, it, vi } from 'vitest'
import { githubSource } from '../github.js'

interface CapturedCall {
  url: string
  body: string
}

function stubFetch(payload: unknown): CapturedCall[] {
  const calls: CapturedCall[] = []
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = typeof init?.body === 'string' ? init.body : ''
    calls.push({ url, body })
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  return calls
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function exprOf(call: CapturedCall): unknown {
  const parsed: unknown = JSON.parse(call.body)
  if (!isRecord(parsed)) return undefined
  const variables = parsed.variables
  if (!isRecord(variables)) return undefined
  return variables.expr
}

describe('githubSource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('expresses plans-archived as branch:folder/plans/archived when a context folder is set', async () => {
    const calls = stubFetch({ data: { repository: { object: { entries: [] } } } })
    const source = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: 'context' })
    await source.list('plans-archived')
    expect(exprOf(calls[0])).toBe('main:context/plans/archived')
  })

  it('expresses plans as branch:plans when the context folder is "" or "."', async () => {
    const emptyCalls = stubFetch({ data: { repository: { object: { entries: [] } } } })
    const emptySource = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: '' })
    await emptySource.list('plans')
    expect(exprOf(emptyCalls[0])).toBe('main:plans')

    const dotCalls = stubFetch({ data: { repository: { object: { entries: [] } } } })
    const dotSource = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: '.' })
    await dotSource.list('plans')
    expect(exprOf(dotCalls[0])).toBe('main:plans')
  })

  it('returns null when the tree object is absent (folder not in the repo)', async () => {
    stubFetch({ data: { repository: { object: null } } })
    const source = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: '' })
    expect(await source.list('roadmaps')).toBeNull()
  })

  it('throws with the GraphQL error message when the API returns errors', async () => {
    stubFetch({ errors: [{ message: 'boom' }] })
    const source = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: '' })
    await expect(source.list('plans')).rejects.toThrow(/boom/)
  })

  it('reads blob text via aliased fields and skips binary blobs', async () => {
    stubFetch({
      data: {
        repository: {
          f0: { text: '---\ntitle: A\n---\n\nBody A', isBinary: false },
          f1: { text: null, isBinary: true },
        },
      },
    })
    const source = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: '' })
    const entries = await source.read('plans', ['a.md', 'image.png'])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('a.md')
    expect(entries[0]?.frontmatter).toEqual({ title: 'A' })
  })

  it('reads a truncated blob in full through the raw contents endpoint', async () => {
    const calls: string[] = []
    const full = '<p>' + 'x'.repeat(600_000) + '</p>'
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      calls.push(url)
      if (url.endsWith('/graphql')) {
        const payload = { data: { repository: { f0: { text: full.slice(0, 524_288), isBinary: false, isTruncated: true } } } }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(full, { status: 200 })
    })
    const source = githubSource({ token: 't', owner: 'acme', repo: 'ctx', branch: 'main', folder: 'context' })
    const entries = await source.read('designs', ['big.html'])
    expect(entries[0]?.body).toBe(full)
    expect(calls[1]).toBe('https://api.github.com/repos/acme/ctx/contents/context/designs/big.html?ref=main')
  })
})
