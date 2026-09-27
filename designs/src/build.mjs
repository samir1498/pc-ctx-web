// Inlines a front-matter snapshot of both context stores into the mockup template.
// Run: node designs/src/build.mjs  (needs js-yaml from the main checkout's node_modules)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(process.env.HOME, 'observeone/projects/pc-ctx-web/package.json'))
const yaml = require('js-yaml')

const STORES = [
  { id: 'dinar', name: 'Dinar', owner: 'Dinar-dz', repo: 'dz-pos', folder: 'context', dir: join(process.env.HOME, 'dz-pos/context') },
  { id: 'observeone', name: 'ObserveOne', owner: 'Observeone1', repo: 'observeone-context', folder: '.', dir: join(process.env.HOME, 'observeone/observeone-context') },
]

function frontMatter(path) {
  const text = readFileSync(path, 'utf8')
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return null
  try {
    return { fm: yaml.load(m[1]) ?? {}, body: m[2] }
  } catch {
    return null
  }
}

// Cut at the last sentence end inside the limit, so a summary never stops mid-clause.
function clip(s, n) {
  if (s.length <= n) return s
  const cut = s.slice(0, n)
  const end = cut.lastIndexOf('. ')
  return end > n / 3 ? cut.slice(0, end + 1) : cut + '…'
}

function plansIn(dir, archived) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => frontMatter(join(dir, f)))
    .filter(Boolean)
    .map(({ fm, body }) => {
      const tasks = (fm.tasks ?? []).map((t) => ({ id: t.id, desc: String(t.desc ?? '').slice(0, 220), status: t.status }))
      return {
        slug: fm.slug,
        title: fm.title,
        status: fm.status,
        category: fm.category,
        created: String(fm.created ?? ''),
        completed: String(fm.completed_at ?? fm.completed ?? ''),
        tldr: clip(String(fm.tldr ?? ''), 400),
        archived,
        tasks,
        intro: archived ? '' : body.replace(/^#.*\n/, '').trim().slice(0, 900),
      }
    })
}

function nowText(dir) {
  const p = join(dir, 'progress/now.md')
  if (!existsSync(p)) return ''
  const r = frontMatter(p)
  return (r ? r.body : readFileSync(p, 'utf8')).trim().slice(0, 1400)
}

const data = {
  snapshot: new Date().toISOString().slice(0, 16).replace('T', ' '),
  projects: STORES.map((s) => ({
    id: s.id,
    name: s.name,
    owner: s.owner,
    repo: s.repo,
    folder: s.folder,
    localDir: s.dir.replace(process.env.HOME, '~'),
    now: nowText(s.dir),
    plans: [...plansIn(join(s.dir, 'plans'), false), ...plansIn(join(s.dir, 'plans/archived'), true)],
  })),
}

const tpl = readFileSync(join(here, 'template.html'), 'utf8')
const json = JSON.stringify(data).replace(/</g, '\\u003c')
// Output carries private plan data: keep it outside this public repo.
const out = process.argv[2] ?? join(process.env.HOME, '.dz-night/hub/context-hub.html')
writeFileSync(out, tpl.replace('/*__DATA__*/null', json))
for (const p of data.projects) console.log(p.name, p.plans.length, 'plans')
console.log('wrote', out)
