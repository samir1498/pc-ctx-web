// A stand-in for the slice of the GitHub API the hub reads, serving a folder on disk.
// For a local run: GITHUB_API_URL=http://127.0.0.1:<port> and a project whose repo root is that folder.
//   node scripts/local-github.mjs <root-folder> [port]
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2]
const port = Number(process.argv[3] ?? 4599)
if (!root) throw new Error('usage: local-github.mjs <root-folder> [port]')

const blobOid = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
const TEXT = /\.(md|mdx|json|html?)$/i
const byOid = new Map()
function index(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === '.git' || name === 'media' || name === 'node_modules') continue
    if (statSync(p).isDirectory()) index(p)
    else if (TEXT.test(name)) byOid.set(blobOid(readFileSync(p)), p)
  }
}
index(root)

function tree(path) {
  const dir = join(root, path)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null
  const entries = readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return [{ name, type: 'tree', oid: createHash('sha1').update(relative(root, p)).digest('hex') }]
    return [{ name, type: 'blob', oid: blobOid(readFileSync(p)) }]
  })
  const oid = createHash('sha1').update(entries.map((e) => `${e.name}:${e.oid}`).join('\n')).digest('hex')
  return { oid, entries }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (req.method === 'POST' && url.pathname === '/graphql') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { query } = JSON.parse(body)
      const repository = {}
      for (const m of query.matchAll(/(t\d+): object\(expression: ("(?:[^"\\]|\\.)*")\)/g)) {
        const [, path] = JSON.parse(m[2]).split(/:(.*)/s)
        repository[m[1]] = tree(path ?? '')
      }
      for (const m of query.matchAll(/(b\d+): object\(oid: ("[0-9a-f]+")\)/g)) {
        const p = byOid.get(JSON.parse(m[2]))
        repository[m[1]] = p ? { text: readFileSync(p, 'utf8'), isBinary: false, isTruncated: false } : null
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ data: { repository } }))
    })
    return
  }
  const blob = url.pathname.match(/\/git\/blobs\/([0-9a-f]+)$/)
  const file = blob ? byOid.get(blob[1]) : url.pathname.includes('/contents/') ? join(root, decodeURIComponent(url.pathname.split('/contents/')[1] ?? '')) : null
  if (file && existsSync(file) && !relative(root, file).startsWith('..')) return res.end(readFileSync(file))
  res.statusCode = 404
  res.end('not found')
})
server.listen(port, '127.0.0.1', () => console.log(`local github on http://127.0.0.1:${port}, root ${root}, ${byOid.size} text files`))
