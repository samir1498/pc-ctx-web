import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { accessToken, verifyAccess } from '../access'

const TEAM = 'team.cloudflareaccess.com'
const AUD = 'aud-123'
let signer: CryptoKey
let jwk: JsonWebKey

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

async function sign(payload: Record<string, unknown>, kid = 'k1', key = signer): Promise<string> {
  const head = enc({ alg: 'RS256', kid })
  const body = enc(payload)
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

const now = () => Math.floor(Date.now() / 1000)
const good = () => ({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, email: 'samir@example.com' })

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  signer = pair.privateKey
  jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1' }] }))))
})
afterEach(() => vi.clearAllMocks())

describe('verifyAccess', () => {
  it('accepts a token signed by the team key for this app', async () => {
    expect(await verifyAccess(await sign(good()), TEAM, AUD)).toBe('samir@example.com')
  })

  it('refuses a missing token', async () => {
    expect(await verifyAccess(null, TEAM, AUD)).toBeNull()
  })

  it('refuses a token for another Access app', async () => {
    expect(await verifyAccess(await sign({ ...good(), aud: ['other'] }), TEAM, AUD)).toBeNull()
  })

  it('refuses an expired token', async () => {
    expect(await verifyAccess(await sign({ ...good(), exp: now() - 5 }), TEAM, AUD)).toBeNull()
  })

  it('refuses a token from another issuer', async () => {
    expect(await verifyAccess(await sign({ ...good(), iss: 'https://evil.cloudflareaccess.com' }), TEAM, AUD)).toBeNull()
  })

  it('refuses a token signed by a key that is not the team key', async () => {
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'])
    expect(await verifyAccess(await sign(good(), 'k1', other.privateKey), TEAM, AUD)).toBeNull()
  })

  it('refuses a payload edited after signing', async () => {
    const [h, , s] = (await sign(good())).split('.')
    expect(await verifyAccess(`${h}.${enc({ ...good(), email: 'x@y.z' })}.${s}`, TEAM, AUD)).toBeNull()
  })

  it('refuses alg none', async () => {
    const t = `${enc({ alg: 'none', kid: 'k1' })}.${enc(good())}.`
    expect(await verifyAccess(t, TEAM, AUD)).toBeNull()
  })
})

describe('accessToken', () => {
  it('reads the header Access adds, then the cookie', () => {
    expect(accessToken(new Request('https://x', { headers: { 'cf-access-jwt-assertion': 'a' } }))).toBe('a')
    expect(accessToken(new Request('https://x', { headers: { cookie: 'x=1; CF_Authorization=b' } }))).toBe('b')
    expect(accessToken(new Request('https://x'))).toBeNull()
  })
})
