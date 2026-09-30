// Verifies the Cloudflare Access token on every request. Access guards only the
// production hostname; deployment URLs (<hash>.context-hub.pages.dev) skip it,
// so the app itself refuses any request without a valid token for our Access app.

interface Jwk {
  kid: string
  kty: string
  n: string
  e: string
  alg?: string
}

let certs: { at: number; keys: Jwk[] } | null = null
const CERTS_TTL_MS = 60 * 60 * 1000
const REFETCH_FLOOR_MS = 60_000

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function b64urlJson(s: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(b64urlBytes(s)))
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function keys(teamDomain: string, fresh = false): Promise<Jwk[]> {
  if (!fresh && certs && Date.now() - certs.at < CERTS_TTL_MS) return certs.keys
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`Access certs ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  certs = { at: Date.now(), keys: body.keys ?? [] }
  return certs.keys
}

export function accessToken(req: Request): string | null {
  const header = req.headers.get('cf-access-jwt-assertion')
  if (header) return header
  const cookie = req.headers.get('cookie') ?? ''
  return cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ?? null
}

/** The signed-in email, or null when the token is missing, forged, expired or for another app. */
export async function verifyAccess(token: string | null, teamDomain: string, aud: string): Promise<string | null> {
  if (!token) return null
  const [h, p, sig] = token.split('.')
  if (!h || !p || !sig) return null
  const header = b64urlJson(h)
  const payload = b64urlJson(p)
  if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  let jwk = (await keys(teamDomain)).find((k) => k.kid === header.kid)
  // A rotated key: refetch before refusing, at most once a minute, so forged kids cannot hammer the certs URL.
  if (!jwk && (!certs || Date.now() - certs.at > REFETCH_FLOOR_MS)) jwk = (await keys(teamDomain, true)).find((k) => k.kid === header.kid)
  if (!jwk) return null
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) return null

  const now = Math.floor(Date.now() / 1000)
  const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud
  if (!audOk || payload.iss !== `https://${teamDomain}`) return null
  if (typeof payload.exp !== 'number' || payload.exp < now) return null
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null
  return typeof payload.email === 'string' ? payload.email : 'service-token'
}
