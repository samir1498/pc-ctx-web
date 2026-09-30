# Usage collector

Writes one `usage/YYYY-MM-DD.json` per Europe/Berlin day into the context store, for the hub's Usage page.

| Source | Read from | Counted as |
|---|---|---|
| Claude Code (WSL) | `~/.claude/projects/**/*.jsonl` (subagents included) | one call per `message.id`, last line wins; the transcript's `entrypoint` splits terminal (`claude-code`) from Agent SDK (`claude-sdk`) |
| Claude on Windows | `/mnt/c/Users/*/.claude/projects` | same, host `windows`; the desktop app's Code tab is `claude-desktop` |
| Cowork | the desktop app's `local-agent-mode-sessions/**/*.jsonl` | tool `cowork`, host `windows` |
| opencode | `~/.local/share/opencode/opencode.db`, table `message` | one call per assistant message; cost as opencode reports it |
| Hermes | OmniRoute `~/.omniroute/storage.sqlite`, `call_logs` with key `hermes` | one call per `correlation_id`, real model from `requested_model` |
| Other router clients | same table, no API key | tool `router` |
| Hermes, direct | `~/.hermes/state.db`, provider rows that did not go through the router | tool `hermes`; dated by the row's last use, so a long-lived row lands on one day |

Written: counts, model and provider ids, tool, host and date. Each day also lists `sessions` (per Claude session: tokens, calls, models, list cost, and from the desktop app's session records its title, scheduled task id and PR link; a terminal session shows its folder name) and `plan` (the desktop app's own samples of the 5-hour and 7-day plan limits, in percent, from `plan-usage-history.json`). No prompt text, paths or request bodies are read out, and `~/.omniroute/call_logs/` is never opened. Databases are opened read-only.

Cost:
- **Claude Code** is shown at the API list price (`list`). A 1-hour cache write bills at 2x input, which is more than Claude Code's own counter shows.
- **opencode** uses opencode's own figure (`reported`).
- **Free models** are `free`, at 0.
- **Anything missing from the price table** is `unpriced`, at 0, and named in the run's log line.
- **Failed calls** count under `errors` and carry no tokens.

## Run

```
python3 collector/usage_collect.py --publish        # last 3 days, pushed to the store (what the timer runs)
python3 collector/usage_collect.py --backfill --publish  # adds days with no file yet; existing older days are kept
python3 collector/usage_collect.py --refresh-prices # re-read ~/.hermes/models_dev_cache.json into prices.json
python3 collector/usage_collect.py --dry-run        # print per-day totals only
python3 collector/usage_collect.py --out DIR        # write the files to DIR, no git
python3 -m unittest discover collector              # tests
```

`prices.json` is the one price table, in USD per million tokens. `models` is generated. Hand corrections go in `overrides`, which a refresh keeps.

## Daily timer

```
mkdir -p ~/.local/share/usage-collector
cp collector/usage_collect.py collector/prices.json ~/.local/share/usage-collector/
cp collector/systemd/usage-collect.* ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now usage-collect.timer
```

The timer runs a copy, because the shared checkout is fetch-only and would not pick up a merge. Repeat the copy after changing the script or the prices.

The hub reads the context store from GitHub, so the timer runs with `--publish` and pushes every day:
- It works in its own detached worktree of the context store, `~/.dz-night/usage-store`, and creates it on first use.
- Each run fetches, resets that worktree to `origin/main`, writes the day files, commits only `usage/` straight to `main`, and pushes. Usage files are bookkeeping, so they get no branch or PR.
- A rejected push, because someone else pushed first, means fetch, reset, rewrite and retry, up to 4 times.
- It never touches the shared store checkout or anyone's uncommitted work. It refuses to reset any path that is not a linked worktree.
- Each run logs one `usage-collect: ... pushed <sha>` or `FAILED` line (`journalctl --user -u usage-collect`).

Claude Code deletes transcripts after `cleanupPeriodDays`, and OmniRoute keeps its log for 90 days. Days the collector has already written survive both: a backfill only adds missing days and never rewrites one older than the 3-day window, since pruned transcripts would undercount it.

A source that is not on disk is named in the log line as `missing=`; its tool is then absent from the days just written.
