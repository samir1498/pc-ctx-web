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
collector/            daily token usage collector (Python, stdlib only)
scripts/              measure-hub.mjs (page timings)
```

## Adding a section

1. Add the folder to `FOLDERS` in `hub/src/doc/types.ts` and its key in `hub/src/source/folders.ts`.
2. Give it a label in `FOLDER_LABELS` and `FOLDER_SINGULAR`, and a place in `PRIMARY` or `SECONDARY` in `hub/src/lib/sections.ts`.

## Before a PR

In `hub/`: `pnpm check`, `pnpm test`, `pnpm build:pages`. For the collector: `python3 -m unittest discover collector`.

Branch off `main`, one change per PR, and deploy only after the merge.
