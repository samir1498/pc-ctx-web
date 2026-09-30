# Usage collector

Writes one `usage/YYYY-MM-DD.json` per Europe/Berlin day into the context store, for the hub's Usage page.

| Source | Read from | Counted as |
|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (subagents included) | one call per `message.id`, last line wins |
| opencode | `~/.local/share/opencode/opencode.db`, table `message` | one call per assistant message; cost as opencode reports it |
| Hermes | OmniRoute `~/.omniroute/storage.sqlite`, `call_logs` with key `hermes` | one call per `correlation_id`, real model from `requested_model` |
| Other router clients | same table, no API key | tool `router` |

Only counts, model and provider ids, tool and date are written. No prompt text, paths, titles or request bodies are read out, and `~/.omniroute/call_logs/` is never opened. Databases are opened read-only.

Cost:
- **Claude Code** is shown at the API list price (`list`). A 1-hour cache write bills at 2x input, which is more than Claude Code's own counter shows.
- **opencode** uses opencode's own figure (`reported`).
- **Free models** are `free`, at 0.
- **Anything missing from the price table** is `unpriced`, at 0, and named in the run's log line.
- **Failed calls** count under `errors` and carry no tokens.

## Run

```
python3 collector/usage_collect.py                  # last 3 days, overwrite
python3 collector/usage_collect.py --backfill       # every day the sources still hold
python3 collector/usage_collect.py --refresh-prices # re-read ~/.hermes/models_dev_cache.json into prices.json
python3 collector/usage_collect.py --dry-run        # print per-day totals only
python3 collector/usage_collect.py --publish        # also commit usage/ to the store's main and push
python3 -m unittest discover collector              # tests
```

`prices.json` is the one price table, in USD per million tokens. `models` is generated. Hand corrections go in `overrides`, which a refresh keeps.

## Daily timer

```
cp collector/systemd/usage-collect.* ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now usage-collect.timer
```

The hub reads the context store from GitHub, so the timer runs with `--publish`:
- It commits only the `usage/` files, as their own commit, straight to the context store's `main`. Usage files are bookkeeping, so they get no branch or PR.
- It then pushes, but only when that push carries nothing but its own commit. If `main` holds another session's unpushed commits, or `origin/main` has moved ahead, it commits and leaves the push to the next push of `main`.
- It never rebases, so another session's working tree is never touched.
- Each run logs one `usage-collect: git ...` line to the journal (`journalctl --user -u usage-collect`).

Claude Code deletes transcripts after `cleanupPeriodDays`, and OmniRoute keeps its log for 90 days. Days the collector has already written survive both.
