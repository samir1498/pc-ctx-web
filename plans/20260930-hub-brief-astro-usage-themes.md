# Brief for the hub session (Samir, 2026-09-30)

You own the context hub (this repo, pc-ctx-web, Cloudflare Pages project `context-hub`, https://context-hub.pages.dev). Read `README.md`, `CONTRIBUTING.md` and `plans/20260929-hub-rewrite-in-astro.md` first; that plan is your base, this brief widens it. Samir's words are quoted where they decide something.

## What to build

1. **Port to Astro, clean up, make it fast.** The plan's T1 to T10. Astro in server mode on Cloudflare, React islands with TanStack Query and Tailwind where interactivity earns it. Samir: "never fetch all at build that would be stupid"; fetch live from GitHub, only what the page shows, paginated, cached by blob SHA. Measure before and after (T1) and put the numbers in the plan.
2. **Navigation: one entry per section, each section is a dashboard.** Samir: "instead of filling the sidebar, just use an aggregate title per section, then each page acts like a sub dashboard for that section, with charts where possible." So the sidebar lists sections (plans, progress, reports, designs, ideas, research, references, handoffs, usage...), not files. A section page shows that section's summary: counts, status breakdown, recent activity over time, then the paginated list.
3. **Main dashboard.** A summary across sections, and as its main section, token usage and cost, broken down by provider and model.
4. **Token usage page, per day.** A new section: tokens (input, output, cache read, cache write) and cost per day, per tool (Claude Code, opencode, Hermes), per provider and model, with good charts. Backfill as far back as the data goes, at least one to two weeks. Samir: "if you can also include yours it will be perfect", so Claude Code usage is in.
   - Sources on this box (check each, say which ones exist):
     - Claude Code transcripts: `~/.claude/projects/*/*.jsonl`, `message.usage` and `message.model` per assistant turn.
     - opencode: `~/.local/share/opencode/opencode.db` (SQLite) and `storage/`.
     - Hermes: `~/.hermes/` (sessions, state or logs; find where usage lives).
   - Cost: Claude Code runs on a subscription, so show the API-equivalent cost at list prices and label it that way; free opencode models cost 0. Keep the price table in one file.
   - Pipeline: a collector script on the box aggregates per day and writes one small JSON or markdown file per day into the context store the hub reads (never raw transcripts, never prompt text, only counts, model names, tool, date). Run it once to backfill, then daily (systemd user timer or cron). The hub reads those files like any other section.
5. **Theme switcher, five themes or more.** Light and dark at least, plus three or more distinct ones. Tokens on `:root`, the choice remembered in localStorage.

## How to work

- **Mockups first.** Before building, make mockups of: the main dashboard, one section sub-dashboard, the usage page, and the themes. Real React and Tailwind components, never HTML string templates. Put them somewhere Samir can open (a preview deploy of a branch is fine). Then stop and write `MOCKUPS READY: <url>` as your last line, and wait. The lead session tells Samir it is time to approve. Do not build past the mockups until Samir approves.
- After approval: branch and PR per unit of work in this repo, preview deploy per PR, production deploy with `npx wrangler pages deploy client/dist --project-name context-hub --branch main` (or the Astro equivalent) only after the PR merges. Do not touch Cloudflare Access or Zero Trust.
- The existing worktrees (`deploy`, `fix-cache-key`, `sidebar`) belong to earlier work; read them for anything unmerged worth keeping, do not delete them without saying so.
- Plain words in anything Samir reads, no em dashes, no time estimates. Say the tradeoff before building anything costly.
- Keep background agents to two at most; Anouar shares the plan's usage.
- When blocked or done with a stage, write one line starting `HUB:` so the lead session's watch picks it up.
