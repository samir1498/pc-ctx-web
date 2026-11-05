// Personal key links: the hub's sign-in once Cloudflare Access is taken off it.
// Each person gets one secret link (`/?key=<their key>`); opening it once leaves a
// long-lived cookie, so they never sign in again. Revoking someone is changing or
// removing their key in the HUB_KEYS secret. Anyone holding a link is in, so a link
// is never forwarded.

/** HUB_KEYS is `name:key,name:key`; names are what the hub shows as the signed-in user. */
export function parseKeys(raw: string | undefined): Map<string, string> {
  const keys = new Map<string, string>()
  for (const pair of (raw ?? '').split(',')) {
    const i = pair.indexOf(':')
    if (i <= 0) continue
    const name = pair.slice(0, i).trim()
    const key = pair.slice(i + 1).trim()
    // Short keys are guessable; refuse them rather than serve the store behind one.
    if (name && key.length >= 24) keys.set(key, name)
  }
  return keys
}

export const KEY_COOKIE = 'hub-key'
/** Ten years: the point of the key link is that it never asks again. */
export const KEY_COOKIE_MAX_AGE = 10 * 365 * 86400

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The name behind a key, or null. Compares every key in full so timing tells nothing. */
export function whoHasKey(key: string | null | undefined, keys: Map<string, string>): string | null {
  if (!key) return null
  let who: string | null = null
  for (const [k, name] of keys) if (sameText(k, key)) who = name
  return who
}

export function keyFromCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${KEY_COOKIE}=([^;]+)`))
  return m?.[1] ? decodeURIComponent(m[1]) : null
}
