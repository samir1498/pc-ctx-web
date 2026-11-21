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

// Passwords (owner, 2026-11-20: "a normal password that I save in my Chrome is very
// sufficient"). HUB_PASSWORDS is `name:password,name:password`; the sign-in page takes
// a name and a password, so a phone's password manager offers to save and fill them.
// The key links above keep working beside it.

/** Shortest password the hub accepts; anything shorter is refused, not served behind. */
export const MIN_PASSWORD = 10

/** HUB_PASSWORDS as name -> password. */
export function parsePasswords(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>()
  for (const pair of (raw ?? '').split(',')) {
    const i = pair.indexOf(':')
    if (i <= 0) continue
    const name = pair.slice(0, i).trim().toLowerCase()
    const password = pair.slice(i + 1).trim()
    if (name && password.length >= MIN_PASSWORD) out.set(name, password)
  }
  return out
}

/** The name when name and password match, else null. Compares in full whatever the input. */
export function checkPassword(
  name: string | null | undefined,
  password: string | null | undefined,
  passwords: Map<string, string>,
): string | null {
  const n = (name ?? '').trim().toLowerCase()
  const p = password ?? ''
  let who: string | null = null
  for (const [k, v] of passwords) if (sameText(k, n) && sameText(v, p) && p.length >= MIN_PASSWORD) who = k
  return who
}

/** What the cookie may hold: a key, or a password (it names its owner the same way). */
export function cookieSecrets(keys: Map<string, string>, passwords: Map<string, string>): Map<string, string> {
  const all = new Map(keys)
  for (const [name, password] of passwords) all.set(password, name)
  return all
}

/** Only a path on this site: no scheme, no `//host`, no backslash tricks. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/(?![\/\\])/.test(next) ? next : '/'
}
