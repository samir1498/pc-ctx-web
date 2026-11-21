import { defineMiddleware } from 'astro:middleware'
import { accessToken, verifyAccess } from './server/access'
import { checkPassword, cookieSecrets, KEY_COOKIE, KEY_COOKIE_MAX_AGE, keyFromCookie, parseKeys, parsePasswords, safeNext, whoHasKey } from './server/keys'
import { signInPage } from './server/signin'
import { createHub, hubEnv, LAST_PROJECT } from './server/hub'

export const onRequest = defineMiddleware(async (ctx, next) => {
  const team = hubEnv.ACCESS_TEAM_DOMAIN
  const aud = hubEnv.ACCESS_AUD
  const keys = parseKeys(hubEnv.HUB_KEYS)
  const passwords = parsePasswords(hubEnv.HUB_PASSWORDS)
  // Fail closed: a deploy with neither key links nor Access must not serve the store to anyone.
  if (!keys.size && !passwords.size && !(team && aud) && !import.meta.env.DEV && hubEnv.HUB_AUTH !== 'off') {
    return new Response('Sign-in is not configured for this deployment.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  if (keys.size || passwords.size || (team && aud)) {
    const cookieMode = { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: KEY_COOKIE_MAX_AGE } as const
    // The sign-in form posts here; a match leaves the same long-lived cookie a key link does.
    if (ctx.url.pathname === '/sign-in' && ctx.request.method === 'POST') {
      const form = await ctx.request.formData().catch(() => null)
      const next = safeNext(form?.get('next')?.toString())
      const password = form?.get('password')?.toString() ?? ''
      if (!checkPassword(form?.get('username')?.toString(), password, passwords)) return signInPage(next, true)
      ctx.cookies.set(KEY_COOKIE, password, cookieMode)
      return ctx.redirect(next, 303)
    }
    // A key link: remember the key in a cookie, then drop it from the address bar.
    const linkKey = ctx.url.searchParams.get('key')
    const linkWho = whoHasKey(linkKey, keys)
    if (linkKey && linkWho) {
      ctx.cookies.set(KEY_COOKIE, linkKey, cookieMode)
      const clean = new URL(ctx.url)
      clean.searchParams.delete('key')
      return ctx.redirect(clean.pathname + clean.search, 302)
    }
    let who = whoHasKey(keyFromCookie(ctx.request), cookieSecrets(keys, passwords))
    if (!who && team && aud) who = await verifyAccess(accessToken(ctx.request), team, aud).catch(() => null)
    if (!who) {
      if (ctx.request.method === 'GET' && !ctx.url.pathname.startsWith('/api/')) return signInPage(safeNext(ctx.url.pathname + ctx.url.search), false)
      return new Response('Sign in first.', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    ctx.locals.user = who
  }
  const meter = { github: 0 }
  ctx.locals.meter = meter
  ctx.locals.hub = await createHub(meter)
  const opened = ctx.url.pathname.match(/^\/p\/([^/]+)/)?.[1]
  if (opened && ctx.locals.hub.project(opened)) {
    ctx.cookies.set(LAST_PROJECT, opened, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 365 * 86400 })
  }
  const res = await next()
  // The T1 measure: how many GitHub calls this request cost.
  res.headers.set('x-hub-github-calls', String(meter.github))
  return res
})
