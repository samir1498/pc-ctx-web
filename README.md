# pc-ctx Web UI

A web interface for browsing plans, roadmaps, references, and progress logs from any [pc-ctx](https://github.com/samir1498/pc-ctx) repository.

Built with React 19, Hono, TanStack Router, TanStack Query, framer-motion, and Tailwind CSS v4. Runs on Cloudflare Pages.

## Features

- **Dashboard** — Animated SVG donut chart for status distribution, bar chart for weekly activity, count-up counters, top plans, recent timeline
- **Plans** — Full-text search, status filter, sort by priority/date/name, pagination, HoverCard summaries
- **Folders** — Roadmaps, references, progress logs — each with inline markdown rendering
- **Plan detail** — Rendered markdown with syntax highlighting, task list with status badges
- **Auth** — Cloudflare Access at the edge (optional, zero config)
- **Responsive** — Side-by-side on desktop, stacked on mobile

## Quick start

### Prerequisites

- A GitHub repo using [pc-ctx](https://github.com/samir1498/pc-ctx) with plans/roadmaps/references/progress
- A [Cloudflare](https://cloudflare.com) account (free tier)

### Deploy

1. **Fork this repo**
2. **Create a Cloudflare Pages project** and connect your fork
3. **Set a secret** — `GITHUB_TOKEN` with `repo` scope (for private repos)
4. **Set environment variables** (optional):
   - `GITHUB_OWNER` — defaults to `samir1498`
   - `GITHUB_REPO` — defaults to `personal-context`
   - `BRANCH` — defaults to `main`

Your site will be live at `https://your-project.pages.dev` behind Cloudflare Access (configure in Zero Trust dashboard → Access → Applications → Workers → add your domain → set a policy).

### Or deploy with wrangler

```bash
git clone https://github.com/samir1498/pc-ctx-web
cd pc-ctx-web
npm install
cd client && npm install && cd ..

# Create Pages project
wrangler pages project create <your-project-name> --production-branch main

# Deploy
wrangler pages deploy client/dist --project-name <your-project-name>

# Set secret
wrangler pages secret put GITHUB_TOKEN --project-name <your-project-name>
```

## Architecture

```
Browser → Cloudflare Access (optional) → Hono Worker → GitHub API → your context repo
                      ↓
               React SPA (served by Worker)
```

No database. All reads go through the GitHub API, authenticated via `GITHUB_TOKEN`. The Hono Worker runs as a Cloudflare Pages Function and serves both the API proxy and the static SPA.

### API endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/plans` | All plans with frontmatter + body |
| `GET /api/plans/:slug` | Single plan detail |
| `GET /api/roadmaps` | All roadmaps |
| `GET /api/references` | All references |
| `GET /api/progress` | All progress logs |

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Cloudflare Pages (Hono Functions Worker) |
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query (30s stale time) |
| Charts | Pure SVG (donut) + animated bars |
| Animations | framer-motion |
| Auth | Cloudflare Access (edge, optional) |

## Development

```bash
cd client
npm install
npm run dev          # Vite dev server (hot reload, no API)

# Or full local API
cd ..
npm install
npm run dev          # wrangler pages dev (API + SPA, no hot reload)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
