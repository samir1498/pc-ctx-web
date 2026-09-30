import { defineMiddleware } from 'astro:middleware'
import { accessToken, verifyAccess } from './server/access'
import { createHub, hubEnv, LAST_PROJECT } from './server/hub'

export const onRequest = defineMiddleware(async (ctx, next) => {
  const team = hubEnv.ACCESS_TEAM_DOMAIN
  const aud = hubEnv.ACCESS_AUD
  // Fail closed: a deploy that lost its Access vars must not serve the store to anyone.
  if (!(team && aud) && !import.meta.env.DEV && hubEnv.HUB_AUTH !== 'off') {
    return new Response('Access is not configured for this deployment.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  if (team && aud) {
    const who = await verifyAccess(accessToken(ctx.request), team, aud).catch(() => null)
    if (!who) {
      return new Response('Sign in through the hub address; this URL is not behind Cloudflare Access.', {
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
