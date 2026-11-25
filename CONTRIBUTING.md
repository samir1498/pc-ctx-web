# Contributing

## Setup

```bash
cd hub && pnpm install && pnpm dev
python3 -m unittest discover collector
```

## Layout

```
hub/
├── src/pages/        routes: dashboard, sections, documents, usage, themes, API for "load more" and media
├── src/source/       GitHub GraphQL, KV cache, front matter
├── src/server/       Access JWT check, project config
├── src/doc/          markdown, design pages, plan helpers
├── src/lib/          dashboard and usage math
├── src/components/   Astro components and React islands
└── scripts/          Pages packaging
collector/            daily token usage collector and the Overview generator (Python, stdlib only)
scripts/              measure-hub.mjs (page timings)
```

## Adding a section

1. Add the folder to `FOLDERS` in `hub/src/doc/types.ts` and its key in `hub/src/source/folders.ts`.
2. Give it a label in `FOLDER_LABELS` and `FOLDER_SINGULAR`, and a place in `PRIMARY` or `SECONDARY` in `hub/src/lib/sections.ts`.

## Overview section

`collector/overview.py` (rules in `collector/overview_rules.json`) writes `context/overview/*.json` in the dz-pos checkout; the hub reads those files like `usage/`. Run it with `--commit` to commit only when the content changed.

To run the hub on local context: `node hub/scripts/local-github.mjs <folder holding context/> 4599` stands in for GitHub, then `wrangler pages dev` on the built bundle with `--kv CTX_CACHE --kv CTX_CONFIG --binding GITHUB_API_URL=http://127.0.0.1:4599 --binding HUB_AUTH=off --binding GITHUB_TOKEN=local` and `PROJECTS` pointing at that folder (`HUB_WRANGLER_CONFIG` does the same for `astro dev`).

## Before a PR

In `hub/`: `pnpm check`, `pnpm test`, `pnpm build:pages`. For the collector: `python3 -m unittest discover collector`.

Branch off `main`, one change per PR, and deploy only after the merge.
