// Repackages the Astro Worker build as a Pages advanced-mode project in ../.hub-pages/:
// the Cloudflare adapter dropped Pages output, and the hub stays on Pages for Access and its URL.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The Access app in front of the hub; the Worker re-checks its JWT. Dev has no Access, so Pages only.
const ACCESS = {
  ACCESS_TEAM_DOMAIN: 'observeone.cloudflareaccess.com',
  ACCESS_AUD: 'd1adc0100bc19113cc86bae6af441a233f0141e2a806bdc2863c0f3b681b00df',
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
// Outside hub/: wrangler refuses a Pages config under the adapter's .wrangler/deploy redirect.
const pages = join(root, '..', '.hub-pages')
const out = join(pages, 'out')
if (!existsSync(join(dist, 'server', 'entry.mjs'))) throw new Error('Run `pnpm build` first: dist/server/entry.mjs is missing')

rmSync(pages, { recursive: true, force: true })
cpSync(join(dist, 'client'), out, { recursive: true })
cpSync(join(dist, 'server'), join(out, '_worker.js'), { recursive: true })
rmSync(join(out, '_worker.js', 'wrangler.json'), { force: true })
writeFileSync(join(out, '_worker.js', 'index.js'), "export { default } from './entry.mjs'; export * from './entry.mjs'\n")
// Hashed assets never need the Worker.
writeFileSync(join(out, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: ['/_astro/*'] }) + '\n')

// Bindings come from wrangler.jsonc so dev and Pages cannot drift; `remote` is a dev-only flag.
const worker = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
writeFileSync(
  join(pages, 'wrangler.jsonc'),
  JSON.stringify(
    {
      name: worker.name,
      pages_build_output_dir: './out',
      compatibility_date: worker.compatibility_date,
      compatibility_flags: worker.compatibility_flags,
      kv_namespaces: worker.kv_namespaces.map(({ binding, id }) => ({ binding, id })),
      vars: { ...worker.vars, ...ACCESS },
    },
    null,
    2,
  ) + '\n',
)
console.log(`Pages bundle in ${pages}. Deploy: cd .hub-pages && npx wrangler pages deploy --project-name ${worker.name} --branch <branch>`)
