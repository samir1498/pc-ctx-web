# pc-ctx Web UI

The context hub: a web interface for the plans, roadmaps, references, designs and progress logs in any [pc-ctx](https://github.com/samir1498/pc-ctx) repository, plus a token usage dashboard.

Two parts:
- `hub/`: the site. Astro, server-rendered on Cloudflare Pages, with React islands (TanStack Query and Table, Recharts) and Tailwind CSS v4.
- `collector/`: a Python script run by a daily systemd timer. It counts token usage on the box and pushes one file per day to the context store's `usage/` folder. See `collector/README.md`.

## How it reads

```
Browser → Cloudflare Access → Pages Worker (Astro) → GitHub GraphQL → the context repo
                                     ↕
                             KV cache (by blob SHA)
```

No database. A page fetches only what it shows: one GraphQL call covers every folder tree (cached 60 s), blobs are fetched in batches and cached in KV by SHA with no expiry, and a folder's parsed metadata is cached by its tree SHA.

The Worker re-checks the Cloudflare Access JWT when `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set, and refuses to serve (500) when they are missing, unless it runs under `astro dev` or with `HUB_AUTH=off`.

## Run and deploy

```bash
cd hub
pnpm install
pnpm dev            # local, against the real KV and GitHub (wrangler login needed)
pnpm check          # astro check
pnpm test           # vitest
pnpm build:pages    # build, then repackage into ../.hub-pages for Pages
cd ../.hub-pages && npx wrangler pages deploy --project-name context-hub --branch main
```

The Cloudflare adapter no longer emits Pages output, so `pnpm build:pages` repackages the Worker build (`hub/scripts/pages-package.mjs`). Deploy from `main` after a merge; a branch deploy is a preview.

Projects come from the `PROJECTS` variable or the KV config (`CTX_CONFIG`); GitHub tokens are Pages secrets, never in the repo.

## Measuring

`node scripts/measure-hub.mjs <base-url> /path [/path...]` loads each path twice in headless Chromium and prints DOM ready, LCP, settled time and the GitHub calls the Worker made (`x-hub-github-calls`).

## The `ctx ui` command

`ctx ui` in pc-ctx downloads the last `web-v*` release (`web-ui.tar.gz`), which was built from the old `client/` app. That app is gone, so `ctx ui` stays on the last release.
