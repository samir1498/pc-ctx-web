---
title: 'Rewrite the context hub in Astro, fast to load'
status: 'draft'
created: 20260929
---

# Rewrite the context hub in Astro

## Why

- The hub is slow to open, and the code is hard to follow. One example: `functions/[[catchall]].ts` is 429 lines, and routing, caching and media all live together.
- Samir prefers Astro. The hub is almost entirely read-only pages, which is the case Astro is built for.

## What the code does now (read 2026-09-29, branch `deploy` worktree)

- TanStack Query is already in use (`client/src/hooks/useContext.ts`), so adding it alone will not fix the speed.
- `server/api.ts` `handleCounts` runs one GraphQL tree query per folder, all in parallel. That is N round trips to GitHub just to draw the sidebar numbers.
- `handleFolder` first calls `list` (one GraphQL query). It then calls `read`, which fetches the full text of every blob on the page to get the frontmatter, so list views pay for whole documents.
- KV caching sits in front of each call (`server/cache.ts`). A cold miss still pays for the whole chain, and a push to the store makes each key expire on its own TTL.
- The client is a React SPA: blank shell, JS bundle (mermaid, DOMPurify), then the API calls. Nothing shows until all of that has run.

## Recommendation: fetch at request time, only what the page shows, paginated

Samir, 2026-09-29: never fetch the whole store at build time. The hub keeps fetching from GitHub live, but each request asks for the smallest thing that answers it.

- Astro in server mode on Cloudflare (`@astrojs/cloudflare`). Pages render on the server, so the first paint has content and there is no blank SPA shell.
- React islands with TanStack Query only for the interactive parts: "load more", filters, prefetch on hover.

## Tasks

1. **T1 Measure first.** Record cold and warm load times for the home page, a folder list, a plan page and a design page, plus the GitHub calls per request (log them in the function). This is the baseline to beat. Verified: numbers written into this plan.
2. **T2 Counts and sidebar in one query.** A single GraphQL query with one tree alias per folder, names only, no blob text. It replaces the N parallel queries in `handleCounts`. Verified: the call log shows one GitHub request for the sidebar.
3. **T3 Paginated lists.** A list page sorts file names from the tree (the date slug sorts them for free), slices one page (e.g. 20), and fetches only those 20 blobs in one aliased query. The next page is fetched on "load more" or scroll through `useInfiniteQuery`. Verified: page 1 of a 200-file folder makes one tree call and one 20-blob call.
4. **T4 Frontmatter without the body.** Lists need only the title, status and date. Option A: GraphQL has no byte range, so keep a small per-folder index file (`context/<folder>/index.json`) that pc-ctx writes on every edit, and read that instead of the blobs. Option B: cache the parsed frontmatter per blob SHA in KV. A SHA never changes, so the cache never goes stale. Recommendation: B, because it needs no change in pc-ctx and a new push only costs the blobs whose SHA changed. Verified: a second visit to a list makes zero blob fetches.
5. **T5 Document pages on demand.** One blob per document page, cached by SHA (immutable, long TTL), with the raw contents fallback past 512 KB kept from PR 25. Prefetch on link hover through TanStack Query. Verified: the second open of a page is served from cache.
6. **T6 Design pages.** Sanitize on the server when the page is rendered and cache the result by SHA. Keep the fix for the `syntax:"<length>"` style trap (`StoreHtml.tsx`). Size the iframe to its content (or render the page inline in a shadow root) so the page has one scroller. Today the nested iframe stops the scroll until a second swipe (Samir, 2026-09-29). Verified: the phone-app design page renders styled and scrolls end to end with one wheel or swipe.
7. **T7 Media.** Keep streaming media from GitHub, but cache it at the edge by blob SHA with immutable headers. Verified: the second load of a report makes no media calls.
8. **T8 Code shape.** Split the 429-line catch-all into Astro routes plus a `source/` module (github, cache, frontmatter). Unit tests on the source with a recorded GraphQL fixture. No file over about 200 lines.
9. **T9 Settings.** Dropped (Samir, 2026-09-30). No settings page; the hub keeps reading the project list and per-owner tokens that the old page saved in KV (`CTX_CONFIG`), then `PROJECTS`. Edit that KV entry to change projects.
10. **T10 Switch over.** Same Pages project, with the old build one click away. Access / Zero Trust stays as is. Verified: rerun T1, every number lower.

## T1 baseline (measured 2026-09-30, production build 6a353d6)

Headless Chromium against the production deployment URL, ObserveOne project. "First" is a fresh browser; the KV cache (5 minute TTL) was cold only for the home page, which warmed it for the rest. "Settled" is when the network goes quiet, which for this SPA is when the page is actually filled in.

| Page | First: LCP / settled | Second: LCP / settled | API calls | Slowest API call, first |
|---|---|---|---|---|
| Home `/p/observeone` (cold KV) | 4220 / 12208 ms | 1040 / 1531 ms | 9 | 9223 ms |
| Plans board | 1152 / 2519 ms | 792 / 1323 ms | 8 | 1353 ms |
| Plan page | 1784 / 1997 ms | 720 / 1177 ms | 8 | 882 ms |
| Design page `account-360` | 896 / 1516 ms | 1200 / 1603 ms | 8 | 322 ms |
| Archive list (319 files) | 4472 / 4702 ms | 916 / 1382 ms | 9 | 2994 ms |

GitHub calls, read from the code rather than logged: `counts` sends one GraphQL tree query per folder, 13 folders plus up to 2 fallback folders, so 13 to 15 GitHub calls just for the sidebar numbers. A folder page sends 1 tree query plus 1 aliased blob query carrying the full text of every file on the page. Every page load makes 8 or 9 API calls before anything shows. Script: `scripts/measure-hub.mjs` in the Astro PR.

## T10 after (measured 2026-09-30, Astro hub a4edc17)

Same script and paths, headless Chromium, against `astro preview` on the box (workerd with the production bundle, the real KV and GitHub), not the edge: new deployment URLs refuse without an Access login, and production sits behind it. "First" is a fresh browser; the KV blob cache was already warm from earlier use. The Astro pages are server-rendered, so the page arrives filled in and makes no API calls.

| Page | First: LCP / settled | Second: LCP / settled | API calls | GitHub calls |
|---|---|---|---|---|
| Home `/p/observeone` | 868 / 7946 ms | 340 / 1084 ms | 0 | 0 |
| Plans board | 596 / 1246 ms | 384 / 1104 ms | 0 | 0 |
| Plan page | 576 / 1220 ms | 356 / 863 ms | 0 | 0 |
| Design page `account-360` | 548 / 1216 ms | 336 / 940 ms | 0 | 0 |
| Archive list (319 files) | 1224 / 1950 ms | 512 / 1081 ms | 0 | 0 |

Every number is lower than the baseline. The home page's first "settled" is still 7.9 s: the content paints at 0.9 s, and the rest is the client-only chart islands loading. The old build also needed 13 to 15 GitHub calls for the sidebar alone; a warm Astro page needs none, and a cold list page needs one.

## Out of scope

- Editing from the hub. It stays read-only.
- Changing the store format in `context/`.

## Open questions for Samir

- Is the runtime repo picker (T7) still needed, or does one store per deployment do?
- T4: per-SHA frontmatter cache (no pc-ctx change) or an index file written by pc-ctx?
