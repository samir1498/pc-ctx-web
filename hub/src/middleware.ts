import { defineMiddleware } from 'astro:middleware'
import { accessToken, verifyAccess } from './server/access'
import { KEY_COOKIE, KEY_COOKIE_MAX_AGE, keyFromCookie, parseKeys, whoHasKey } from './server/keys'
import { createHub, hubEnv, LAST_PROJECT } from './server/hub'

export const onRequest = defineMiddleware(async (ctx, next) => {
  const team = hubEnv.ACCESS_TEAM_DOMAIN
  const aud = hubEnv.ACCESS_AUD
  const keys = parseKeys(hubEnv.HUB_KEYS)
  // Fail closed: a deploy with neither key links nor Access must not serve the store to anyone.
  if (!keys.size && !(team && aud) && !import.meta.env.DEV && hubEnv.HUB_AUTH !== 'off') {
    return new Response('Sign-in is not configured for this deployment.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  if (keys.size || (team && aud)) {
    // A key link: remember the key in a cookie, then drop it from the address bar.
    const linkKey = ctx.url.searchParams.get('key')
    const linkWho = whoHasKey(linkKey, keys)
    if (linkKey && linkWho) {
      ctx.cookies.set(KEY_COOKIE, linkKey, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: KEY_COOKIE_MAX_AGE })
      const clean = new URL(ctx.url)
      clean.searchParams.delete('key')
      return ctx.redirect(clean.pathname + clean.search, 302)
    }
    let who = whoHasKey(keyFromCookie(ctx.request), keys)
    if (!who && team && aud) who = await verifyAccess(accessToken(ctx.request), team, aud).catch(() => null)
    if (!who) {
      return new Response('Open the hub with your personal link once; after that it remembers you.', {
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
