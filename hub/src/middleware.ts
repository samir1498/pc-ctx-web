import { defineMiddleware } from 'astro:middleware'
import { accessToken, verifyAccess } from './server/access'
import { createHub, hubEnv } from './server/hub'

export const onRequest = defineMiddleware(async (ctx, next) => {
  const team = hubEnv.ACCESS_TEAM_DOMAIN
  const aud = hubEnv.ACCESS_AUD
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
  const res = await next()
  // The T1 measure: how many GitHub calls this request cost.
  res.headers.set('x-hub-github-calls', String(meter.github))
  return res
})
