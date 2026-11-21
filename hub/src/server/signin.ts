// The sign-in page: a plain form with a name and a password, so the browser's
// password manager saves and fills it. Served by the middleware to anyone not signed in.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function signInPage(next: string, failed: boolean): Response {
  const body = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Context hub</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f7f9;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;padding:28px;border-radius:12px;box-shadow:0 2px 12px #0001;width:min(320px,88vw);display:grid;gap:12px}
h1{font-size:18px;margin:0 0 4px}label{font-size:13px;color:#444;display:grid;gap:4px}
input{font-size:16px;padding:10px;border:1px solid #ccd;border-radius:8px}
button{font-size:16px;padding:11px;border:0;border-radius:8px;background:#1d4ed8;color:#fff}
p{margin:0;color:#b91c1c;font-size:14px}</style></head><body>
<form method="post" action="/sign-in">
<h1>Context hub</h1>${failed ? '<p>Nom ou mot de passe incorrect.</p>' : ''}
<input type="hidden" name="next" value="${esc(next)}">
<label>Nom<input name="username" autocomplete="username" autocapitalize="none" required></label>
<label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label>
<button type="submit">Entrer</button></form></body></html>`
  return new Response(body, {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
