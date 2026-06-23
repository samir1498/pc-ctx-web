# Contributing to pc-ctx Web UI

## Quick start

```bash
# Prerequisites
bun --version        # requires Bun 1.2+
wrangler --version   # for Pages deployment

# Install
cd web/client
bun install

# Dev (Vite hot reload — UI only, API calls won't work locally)
bun run dev

# Or full local API (no hot reload — runs wrangler pages dev)
cd ..
bun run dev
```

## Architecture

```
web/
├── functions/
│   └── [[catchall]].ts   # Hono Worker — API proxy (reads GitHub) + SPA server
├── client/
│   └── src/
│       ├── routes/       # TanStack Router file-based routes
│       ├── pages/        # Page components
│       ├── components/   # Shared UI
│       ├── hooks/        # TanStack Query hooks (useFolder, useItem)
│       └── api/          # fetch wrappers
└── wrangler.jsonc        # Cloudflare Pages config
```

### Data flow

```
Browser → Cloudflare Access → Hono Worker → GitHub API → personal-context repo
                      ↓
               React SPA
          (TanStack Query cache, 30s stale)
```

No database. All reads go through the GitHub API, authenticated via `GITHUB_TOKEN`.

## Adding a new domain (e.g. "ideas", "processes")

1. Add to `FOLDERS` in `web/functions/[[catchall]].ts`
2. Add to `Folder` type in `web/client/src/types.ts`
3. Add label + icon in `types.ts` + `Icons.tsx`
4. Create route file in `routes/`, page in `pages/`
5. Replace `FolderPage` usage or use the shared component
6. Add sidebar link in `Sidebar.tsx`
7. Update Dashboard stat cards

## Adding a new chart

1. Create SVG component in `components/`
2. Add data processing in `Dashboard.tsx` useMemo
3. Style with Tailwind tokens (`var(--color-accent)`, etc.)

## Coding conventions

- **TypeScript strict** — avoid `as` casts where possible
- **No emojis** in the UI — use lucide-react or inline SVGs
- **Use Tailwind's built-in scale** — no `text-[11px]`, `px-[13px]`, etc.
- **Tailwind v4** — `@theme` tokens, not `tailwind.config.ts`
- **No CSS modules** — all styles in `index.css` or Tailwind classes

## Submitting a PR

1. `cd web/client && bun run build` — make sure it compiles
2. `cd web && wrangler pages deploy client/dist --project-name personal-context` — verify deploy
3. Describe what changed and why

## Release process

Web releases are automatic:

1. Tag a commit: `git tag web-v0.2.0`
2. Push: `git push origin web-v0.2.0`
3. GitHub Actions builds the tarball and creates a release
4. `ctx ui` downloads the latest release automatically

See `.github/workflows/web-release.yml`.
