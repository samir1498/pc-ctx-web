import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfigApi } from '../config-api.js'
import type { ConfigStore, ProjectConfig } from '../config-store.js'

const SECRET_TOKEN = 'ghp_test_should_never_leak'

function memoryConfigStore(initial: { projects?: ProjectConfig[]; tokens?: Record<string, string> } = {}): ConfigStore {
  let projects = initial.projects ?? []
  const tokens = new Map<string, string>(Object.entries(initial.tokens ?? {}))
  return {
    async getProjects() {
      return projects
    },
    async saveProjects(next) {
      projects = next
    },
    async hasToken(owner) {
      return tokens.has(owner)
    },
    async getToken(owner) {
      return tokens.get(owner) ?? null
    },
    async setToken(owner, token) {
      tokens.set(owner, token)
    },
    async deleteToken(owner) {
      tokens.delete(owner)
    },
    async listTokenOwners() {
      return [...tokens.keys()]
    },
  }
}

function stubGithubFetch(payload: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(payload), { status })
}

const LOCAL_HEADERS = { origin: 'http://127.0.0.1:4780', host: '127.0.0.1:4780', 'content-type': 'application/json' }

async function assertNoLeak(res: Response) {
  const bodyText = await res.clone().text()
  expect(bodyText).not.toContain(SECRET_TOKEN)
  for (const [key, value] of res.headers.entries()) {
    expect(`${key}:${value}`).not.toContain(SECRET_TOKEN)
  }
}

describe('createConfigApi — token never leaks', () => {
  const seeded: ProjectConfig[] = [
    { id: 'beta', name: 'Beta', source: 'github', owner: 'samir1498', repo: 'ctx', branch: 'main', folder: '' },
  ]

  function buildApp(githubFetch: typeof fetch = stubGithubFetch([])) {
    const store = memoryConfigStore({ projects: seeded, tokens: { samir1498: SECRET_TOKEN } })
    return createConfigApi({ store, mode: 'local', github: githubFetch })
  }

  it('GET /api/config reports token status without the value', async () => {
    const app = buildApp()
    const res = await app.request('/api/config')
    await assertNoLeak(res)
    const body: unknown = await res.clone().json()
    expect(body).toMatchObject({ tokens: { samir1498: 'set' } })
  })

  it('PUT /api/config/tokens/:owner never echoes the token back', async () => {
    const app = buildApp()
    const res = await app.request('/api/config/tokens/samir1498', {
      method: 'PUT',
      headers: LOCAL_HEADERS,
      body: JSON.stringify({ token: SECRET_TOKEN }),
    })
    await assertNoLeak(res)
    expect(await res.clone().json()).toEqual({ owner: 'samir1498', status: 'set' })
  })

  it('DELETE /api/config/tokens/:owner never leaks the token', async () => {
    const app = buildApp()
    const res = await app.request('/api/config/tokens/samir1498', { method: 'DELETE', headers: LOCAL_HEADERS })
    await assertNoLeak(res)
  })

  it('a GitHub 401 error path never leaks the token', async () => {
    const app = buildApp(stubGithubFetch({ message: 'Bad credentials' }, 401))
    const res = await app.request('/api/config/github/samir1498/repos')
    expect(res.status).toBe(401)
    await assertNoLeak(res)
  })

  it('a validation 400 never leaks the token', async () => {
    const app = buildApp()
    const res = await app.request('/api/config/projects', {
      method: 'PUT',
      headers: LOCAL_HEADERS,
      body: JSON.stringify([{ id: 'Not Kebab', name: 'x', source: 'disk', dir: '/tmp' }]),
    })
    expect(res.status).toBe(400)
    await assertNoLeak(res)
  })

  it('a 409 no-token error path never leaks anything (there is nothing to leak, but the shape stays generic)', async () => {
    const store = memoryConfigStore({ projects: seeded })
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/github/samir1498/repos')
    expect(res.status).toBe(409)
    await assertNoLeak(res)
  })
})

describe('createConfigApi — deployed mode', () => {
  it('refuses a disk project with 400', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'deployed', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/projects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([{ id: 'alpha', name: 'Alpha', source: 'disk', dir: '/tmp' }]),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('disk') })
  })

  it('404s /api/config/fs', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'deployed', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/fs')
    expect(res.status).toBe(404)
  })

  it('does not enforce an Origin check (Zero Trust Access gates the deployed site instead)', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'deployed', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/tokens/samir1498', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example.com' },
      body: JSON.stringify({ token: 'ghp_deployed_example_token' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('createConfigApi — local mode CSRF guard', () => {
  it('rejects a PUT from a foreign Origin', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/tokens/samir1498', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example.com', host: '127.0.0.1:4780' },
      body: JSON.stringify({ token: 'ghp_should_be_rejected' }),
    })
    expect(res.status).toBe(403)
  })

  it('rejects a GET whose Host is not loopback (DNS rebinding)', async () => {
    const store = memoryConfigStore({ tokens: { samir1498: SECRET_TOKEN } })
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]) })
    const res = await app.request('http://rebind.example.com:4780/api/config', { headers: { host: 'rebind.example.com:4780' } })
    expect(res.status).toBe(403)
  })

  it('accepts a PUT with a matching loopback Origin and Host', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/tokens/samir1498', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4780', host: '127.0.0.1:4780' },
      body: JSON.stringify({ token: 'ghp_local_example_token' }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects a mutating request missing Content-Type: application/json', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/tokens/samir1498', {
      method: 'PUT',
      headers: { origin: 'http://127.0.0.1:4780', host: '127.0.0.1:4780' },
      body: JSON.stringify({ token: 'x' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('createConfigApi — GitHub listing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the owner-specific token as a Bearer header', async () => {
    let capturedAuth: string | null = null
    const github: typeof fetch = (async (_input, init) => {
      const headers = new Headers(init?.headers)
      capturedAuth = headers.get('Authorization')
      return new Response(
        JSON.stringify([
          { name: 'ctx', default_branch: 'main', owner: { login: 'samir1498' } },
          { name: 'someone-elses', default_branch: 'main', owner: { login: 'other-org' } },
        ]),
        { status: 200 },
      )
    })
    const store = memoryConfigStore({ tokens: { samir1498: SECRET_TOKEN } })
    const app = createConfigApi({ store, mode: 'local', github })
    const res = await app.request('/api/config/github/samir1498/repos')
    expect(res.status).toBe(200)
    expect(capturedAuth).toBe(`Bearer ${SECRET_TOKEN}`)
    expect(await res.json()).toEqual([{ name: 'ctx', defaultBranch: 'main' }])
  })

  it('maps a GitHub 401 to a clear message without echoing the raw body', async () => {
    const github = stubGithubFetch({ message: 'Bad credentials', documentation_url: 'https://x' }, 401)
    const store = memoryConfigStore({ tokens: { samir1498: SECRET_TOKEN } })
    const app = createConfigApi({ store, mode: 'local', github })
    const res = await app.request('/api/config/github/samir1498/repos')
    expect(res.status).toBe(401)
    const body: unknown = await res.json()
    expect(body).toEqual({ error: 'GitHub rejected the stored token' })
  })

  it('409s when no token is stored for the owner', async () => {
    const store = memoryConfigStore()
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]) })
    const res = await app.request('/api/config/github/nobody/repos')
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'no token for owner' })
  })

  it('lists directories only for the tree endpoint', async () => {
    const github = stubGithubFetch([
      { name: 'plans', type: 'dir' },
      { name: 'README.md', type: 'file' },
    ])
    const store = memoryConfigStore({ tokens: { samir1498: SECRET_TOKEN } })
    const app = createConfigApi({ store, mode: 'local', github })
    const res = await app.request('/api/config/github/samir1498/ctx/tree?branch=main&path=')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(['plans'])
  })
})

describe('createConfigApi — /fs (local mode)', () => {
  it('returns directories only and reports isContextStore', async () => {
    const store = memoryConfigStore()
    const listLocalDirectories = async () => ({
      path: '/home/user/ctx',
      parent: '/home/user',
      dirs: ['plans', 'roadmaps'],
      isContextStore: true,
    })
    const app = createConfigApi({ store, mode: 'local', github: stubGithubFetch([]), listLocalDirectories })
    const res = await app.request('/api/config/fs?path=/home/user/ctx')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      path: '/home/user/ctx',
      parent: '/home/user',
      dirs: ['plans', 'roadmaps'],
      isContextStore: true,
    })
  })
})
