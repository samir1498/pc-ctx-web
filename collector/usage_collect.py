#!/usr/bin/env python3
"""Collect daily token usage for the context hub.

Reads Claude Code transcripts, opencode.db and the OmniRoute router log, and
writes one <out>/YYYY-MM-DD.json per Europe/Berlin day. Only counts, model and
provider ids, tool and date leave this script; prompt text is never read out.

  usage_collect.py --publish        recompute the last 3 days and push them (daily run)
  usage_collect.py --backfill --publish   add every missing day the sources still hold
  usage_collect.py --out DIR       write the files to DIR only
  usage_collect.py --refresh-prices   update prices.json from the models.dev cache
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from collections import defaultdict
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Berlin")
HOME = os.path.expanduser("~")
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULTS = {
    "claude": os.path.join(HOME, ".claude", "projects"),
    "opencode": os.path.join(HOME, ".local", "share", "opencode", "opencode.db"),
    "router": os.path.join(HOME, ".omniroute", "storage.sqlite"),
    "hermes": os.path.join(HOME, ".hermes", "state.db"),
    # The Windows side, seen from WSL: Claude Code on Windows and the Claude desktop app (MSIX).
    "win_claude": next(iter(sorted(glob.glob("/mnt/c/Users/*/.claude/projects"))), ""),
    "desktop": next(iter(sorted(glob.glob("/mnt/c/Users/*/AppData/Local/Packages/Claude_*/LocalCache/Roaming/Claude"))), ""),
    "models_dev": os.path.join(HOME, ".hermes", "models_dev_cache.json"),
    "prices": os.path.join(HERE, "prices.json"),
    "context": os.path.join(HOME, "observeone", "observeone-context"),
    "store": os.path.join(HOME, ".dz-night", "usage-store"),
    "out": None,
}
ROUTER_ADDR = "127.0.0.1:20128"
# Router provider names that models.dev files under another id.
PROVIDER_ALIAS = {"gemini": "google", "cloudflare-ai": "cloudflare-workers-ai"}
EPOCH = dt.datetime(2000, 1, 1, tzinfo=TZ)


class Tally:
    """Token counts per (date, host, tool, provider, model), before pricing; per session for Claude."""

    def __init__(self):
        self.rows = defaultdict(lambda: defaultdict(int))
        self.meta = {}
        self.sessions = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        self.session_info = {}

    def add(self, date, tool, provider, model, *, host="wsl", ok=True, input=0, output=0,
            cache_read=0, cache_write=0, cache_write_1h=0, reported_cost=None, calls=1):
        key = (date, host, tool, provider, model)
        r = self.rows[key]
        if reported_cost is not None:
            self.meta[key] = "reported"
        if not ok:
            r["errors"] += calls
            return
        r["calls"] += calls
        r["input"] += max(int(input or 0), 0)
        r["output"] += max(int(output or 0), 0)
        r["cacheRead"] += max(int(cache_read or 0), 0)
        r["cacheWrite"] += max(int(cache_write or 0), 0)
        r["cacheWrite1h"] += max(int(cache_write_1h or 0), 0)
        if reported_cost is not None:
            r["reportedCost"] += float(reported_cost or 0) * 1_000_000  # micro-dollars, int-safe sums


def local_date(ts):
    return ts.astimezone(TZ).date().isoformat()


def ro(path):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def norm_claude_model(model):
    return re.sub(r"-\d{8}$", "", model)


# Which app wrote a transcript, from its entrypoint field.
SURFACE = {"claude-desktop": "claude-desktop", "local-agent": "cowork", "sdk-py": "claude-sdk", "sdk-ts": "claude-sdk"}


def read_claude(root, start, end, tally, host="wsl"):
    """Dedup by message.id, keeping the last line: output_tokens grows per content block.

    include_hidden: Cowork keeps each transcript under a .claude/ folder, which ** skips otherwise.
    """
    if not root or not os.path.isdir(root):
        return
    cutoff = start.timestamp() - 86400
    seen = {}
    for path in glob.iglob(os.path.join(root, "**", "*.jsonl"), recursive=True, include_hidden=True):
        try:
            if os.path.getmtime(path) < cutoff:
                continue
            fh = open(path, "rb")
        except OSError:
            continue
        with fh:
            for n, line in enumerate(fh):
                if b'"assistant"' not in line or b'"usage"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") != "assistant":
                    continue
                msg = d.get("message") or {}
                model, usage = msg.get("model"), msg.get("usage")
                if not model or model == "<synthetic>" or not isinstance(usage, dict):
                    continue
                seen[msg.get("id") or f"{path}:{n}"] = (d.get("timestamp"), model, usage, d.get("entrypoint"),
                                                         d.get("sessionId"), d.get("cwd"))
    for stamp, model, u, entry, session, cwd in seen.values():
        try:
            ts = dt.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
        except ValueError:
            continue
        if not start <= ts < end:
            continue
        write = u.get("cache_creation_input_tokens") or 0
        write_1h = min((u.get("cache_creation") or {}).get("ephemeral_1h_input_tokens") or 0, write)
        tool, model, date = SURFACE.get(entry, "claude-code"), norm_claude_model(model), local_date(ts)
        parts = dict(input=u.get("input_tokens"), output=u.get("output_tokens"),
                     cache_read=u.get("cache_read_input_tokens"), cache_write=write, cache_write_1h=write_1h)
        tally.add(date, tool, "anthropic", model, host=host, **parts)
        if session:
            s = tally.sessions[(date, session)][model]
            s["calls"] += 1
            for k, v in parts.items():
                s[k] += max(int(v or 0), 0)
            info = tally.session_info.setdefault(session, {"host": host, "tool": tool, "cwd": cwd})
            info["first"] = min(info.get("first") or stamp, stamp)
            info["last"] = max(info.get("last") or stamp, stamp)


def read_opencode(path, start, end, tally):
    if not os.path.exists(path):
        return
    con = ro(path)
    try:
        q = ("select time_created, data from message where time_created >= ? and time_created < ?"
             " and json_extract(data, '$.role') = 'assistant'")
        for created, raw in con.execute(q, (int(start.timestamp() * 1000), int(end.timestamp() * 1000))):
            d = json.loads(raw)
            ts = dt.datetime.fromtimestamp(created / 1000, TZ)
            provider, model = d.get("providerID") or "unknown", d.get("modelID") or "unknown"
            if d.get("error"):
                tally.add(local_date(ts), "opencode", provider, model, ok=False, reported_cost=0)
                continue
            if not (d.get("time") or {}).get("completed"):
                continue  # in flight; a later run within the 3-day window picks it up
            t = d.get("tokens") or {}
            cache = t.get("cache") or {}
            tally.add(local_date(ts), "opencode", provider, model,
                      input=t.get("input"), output=t.get("output"),
                      cache_read=cache.get("read"), cache_write=cache.get("write"),
                      reported_cost=d.get("cost") or 0)
    finally:
        con.close()


def iso_utc(ts):
    return ts.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def split_router_model(requested, model, provider):
    name = requested or model or ""
    if "/" in name:
        prov, rest = name.split("/", 1)
    else:
        prov, rest = provider or "unknown", name or "unknown"
    return PROVIDER_ALIAS.get(prov, prov), rest


def read_router(path, start, end, tally):
    """One call per correlation_id, last row wins (a combo retries under the same id)."""
    if not os.path.exists(path):
        return
    con = ro(path)
    try:
        q = ("select id, timestamp, status, requested_model, model, provider, api_key_name,"
             " tokens_in, tokens_out, tokens_cache_read, tokens_cache_creation, correlation_id"
             " from call_logs where path like '/v1/%' and timestamp >= ? and timestamp < ?"
             " order by timestamp, id")
        last = {}
        for row in con.execute(q, (iso_utc(start), iso_utc(end))):
            last[row[11] or f"id:{row[0]}"] = row
    finally:
        con.close()
    for (_id, stamp, status, req, model, _prov, key, t_in, t_out, t_cr, t_cw, _c) in last.values():
        ts = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        # No "/" means an alias such as "cheap" that failed before resolving.
        provider, name = split_router_model(req, model, "omniroute")
        tool = "hermes" if key == "hermes" else "router"
        cr = t_cr or 0
        tally.add(local_date(ts), tool, provider, name, ok=status == 200,
                  input=(t_in or 0) - cr, output=t_out, cache_read=cr, cache_write=t_cw)


def read_hermes_direct(path, start, end, tally):
    """Hermes calls that bypass the router; router-bound ones are counted from its log."""
    if not os.path.exists(path):
        return
    con = ro(path)
    try:
        q = ("select model, billing_provider, api_call_count, input_tokens, output_tokens,"
             " cache_read_tokens, cache_write_tokens, last_seen from session_model_usage"
             " where coalesce(billing_base_url, '') not like ? and last_seen >= ? and last_seen < ?")
        for model, prov, calls, t_in, t_out, cr, cw, seen in con.execute(
                q, (f"%{ROUTER_ADDR}%", start.timestamp(), end.timestamp())):
            provider, name = split_router_model(model, model, prov)
            tally.add(local_date(dt.datetime.fromtimestamp(seen, TZ)), "hermes", provider, name,
                      calls=calls or 0, input=t_in, output=t_out, cache_read=cr, cache_write=cw)
    finally:
        con.close()


# ---- pricing -------------------------------------------------------------

def load_prices(path):
    try:
        with open(path) as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {"models": {}, "overrides": {}}


def price_for(prices, provider, model):
    key = f"{provider}/{model}"
    return (prices.get("overrides") or {}).get(key) or (prices.get("models") or {}).get(key)


def is_free(model, price):
    if model.endswith(("-free", ":free")) or model == "free":
        return True
    return bool(price) and not any(v for k, v in price.items() if isinstance(v, (int, float)))


def list_cost(price, r):
    """USD at list price; 1-hour cache writes bill at 2x input, 5-minute at cache_write."""
    inp = price.get("input", 0)
    write_5m = price.get("cache_write", inp * 1.25)
    read = price.get("cache_read", inp)
    w1h = r["cacheWrite1h"]
    return (r["input"] * inp + r["output"] * price.get("output", 0) + r["cacheRead"] * read
            + (r["cacheWrite"] - w1h) * write_5m + w1h * inp * 2) / 1_000_000


def priced_rows(tally, prices):
    days, unpriced = defaultdict(list), set()
    for key, r in tally.rows.items():
        date, host, tool, provider, model = key
        price = price_for(prices, provider, model)
        if is_free(model, price):
            pricing, cost = "free", 0.0
        elif tally.meta.get(key) == "reported":
            pricing, cost = "reported", r["reportedCost"] / 1_000_000
        elif price:
            pricing, cost = "list", list_cost(price, r)
        else:
            pricing, cost = "unpriced", 0.0
            if r["calls"]:
                unpriced.add(f"{provider}/{model}")
        days[date].append({
            "host": host, "tool": tool, "provider": provider, "model": model,
            "calls": r["calls"], "errors": r["errors"],
            "input": r["input"], "output": r["output"],
            "cacheRead": r["cacheRead"], "cacheWrite": r["cacheWrite"],
            "cost": round(cost, 6), "pricing": pricing,
        })
    for rows in days.values():
        rows.sort(key=lambda x: (x["host"], x["tool"], x["provider"], x["model"]))
    return days, unpriced


def session_meta(desktop):
    """The desktop app's own record of each Code and Cowork session, by transcript session id."""
    out = {}
    if not desktop:
        return out
    for pattern in ("claude-code-sessions/*/*/local_*.json", "local-agent-mode-sessions/*/*/local_*.json"):
        for path in glob.glob(os.path.join(desktop, pattern)):
            try:
                with open(path) as fh:
                    m = json.load(fh)
            except (OSError, ValueError):
                continue
            if isinstance(m, dict) and m.get("cliSessionId"):
                out[m["cliSessionId"]] = {"title": m.get("title"), "task": m.get("scheduledTaskId"), "pr": m.get("prUrl"),
                                          "cowork": pattern.startswith("local-agent")}
    return out


def project_of(cwd):
    return re.split(r"[\\/]", cwd.rstrip("\\/"))[-1] if cwd else None


def priced_sessions(tally, prices, meta):
    """One row per session and day: tokens, calls, the models used and their list cost."""
    days = defaultdict(list)
    for (date, sid), models in tally.sessions.items():
        info, m = tally.session_info.get(sid, {}), meta.get(sid, {})
        row = {"id": sid, "host": info.get("host"), "tool": "cowork" if m.get("cowork") else info.get("tool"),
               "title": m.get("title"), "task": m.get("task"), "pr": m.get("pr"),
               "project": None if m.get("cowork") else project_of(info.get("cwd")),
               "first": info.get("first"), "last": info.get("last"), "models": sorted(models),
               "calls": 0, "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "cost": 0.0}
        for model, r in models.items():
            for k, src in (("calls", "calls"), ("input", "input"), ("output", "output"),
                           ("cacheRead", "cache_read"), ("cacheWrite", "cache_write")):
                row[k] += r[src]
            price = price_for(prices, "anthropic", model)
            if price:
                row["cost"] += list_cost(price, {"input": r["input"], "output": r["output"], "cacheRead": r["cache_read"],
                                                 "cacheWrite": r["cache_write"], "cacheWrite1h": r["cache_write_1h"]})
        row["cost"] = round(row["cost"], 4)
        days[date].append({k: v for k, v in row.items() if v is not None})
    for rows in days.values():
        rows.sort(key=lambda x: -(x["input"] + x["output"] + x["cacheRead"] + x["cacheWrite"]))
    return days


def read_plan(desktop, start, end):
    """The desktop app's samples of plan quota used, in percent: 5-hour and 7-day windows, per day."""
    days = defaultdict(list)
    try:
        with open(os.path.join(desktop, "plan-usage-history.json")) as fh:
            samples = json.load(fh).get("samples") or []
    except (OSError, ValueError, TypeError, AttributeError):
        return days
    for x in samples:
        try:
            ts = dt.datetime.fromtimestamp(x["t"] / 1000, TZ)
        except (KeyError, TypeError, ValueError):
            continue
        if start <= ts < end:
            u = x.get("u") or {}
            days[local_date(ts)].append({"at": ts.strftime("%H:%M"), "fiveHour": u.get("fh"), "sevenDay": u.get("sd")})
    return days


def refresh_prices(prices, keys, models_dev_path):
    with open(models_dev_path) as fh:
        catalog = json.load(fh)
    found = dict(prices.get("models") or {})
    for key in sorted(keys):
        provider, model = key.split("/", 1)
        entry = ((catalog.get(provider) or {}).get("models") or {}).get(model)
        cost = entry.get("cost") if isinstance(entry, dict) else None
        if isinstance(cost, dict):
            found[key] = {k: cost[k] for k in ("input", "output", "cache_read", "cache_write") if k in cost}
    prices["models"] = dict(sorted(found.items()))
    prices["source"] = "models.dev, USD per million tokens"
    prices["updated"] = dt.date.today().isoformat()
    prices.setdefault("overrides", {})
    return prices


# ---- main ----------------------------------------------------------------

def git_env():
    """An inherited GIT_DIR or GIT_WORK_TREE outranks -C and would aim reset --hard elsewhere."""
    return {k: v for k, v in os.environ.items()
            if k not in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY")}


def git(repo, *args, check=True):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, check=check,
                          env=git_env()).stdout.strip()


def ensure_store(store, context):
    """The timer's own detached worktree of the context store; created on first use.

    Refuses anything that is not a linked worktree, so a reset can never hit a shared checkout.
    """
    if not os.path.exists(store):
        git(context, "fetch", "--quiet", "origin", "main")
        git(context, "worktree", "add", "--quiet", "--detach", store, "origin/main")
    common = os.path.realpath(os.path.join(store, git(store, "rev-parse", "--git-common-dir")))
    own = os.path.realpath(os.path.join(store, git(store, "rev-parse", "--git-dir")))
    top = os.path.realpath(git(store, "rev-parse", "--show-toplevel"))
    if own == common or top != os.path.realpath(store) or top == os.path.realpath(context):
        raise RuntimeError(f"{store} is not a linked worktree of its own; refusing to reset it")


def push(store):
    return subprocess.run(["git", "-C", store, "push", "--quiet", "origin", "HEAD:refs/heads/main"],
                          capture_output=True, text=True, env=git_env())


def publish(store, context, window, days, message, attempts=4, pause=5, keep_before=None, extra=None):
    """Fetch, reset to origin/main, write, commit only usage/, push; retry when the push is rejected."""
    ensure_store(store, context)
    out, err = os.path.join(store, "usage"), ""
    for attempt in range(1, attempts + 1):
        git(store, "fetch", "--quiet", "origin", "main")
        git(store, "reset", "--quiet", "--hard", "origin/main")
        git(store, "clean", "-fdq", "--", "usage")
        write_days(out, window, days, keep_before, extra)
        git(store, "add", "--", "usage")
        if subprocess.run(["git", "-C", store, "diff", "--cached", "--quiet"], env=git_env()).returncode == 0:
            return "origin/main already has these files"
        git(store, "commit", "--quiet", "-m", message, "--", "usage")
        sha = git(store, "rev-parse", "--short", "HEAD")
        res = push(store)
        if res.returncode == 0:
            return f"pushed {sha}" + (f" on try {attempt}" if attempt > 1 else "")
        err = res.stderr.strip()[:200]
        time.sleep(pause * attempt)
    raise RuntimeError(f"push rejected {attempts} times: {err}")


def write_days(out, window, days, keep_before=None, extra=None):
    """keep_before: an existing file for an earlier day stays as it is (pruned transcripts undercount)."""
    changed = 0
    for date in window:
        rows = days.get(date, [])
        if keep_before and date < keep_before and os.path.exists(os.path.join(out, f"{date}.json")):
            continue
        if rows or os.path.exists(os.path.join(out, f"{date}.json")):
            os.makedirs(out, exist_ok=True)
            changed += write_day(out, date, rows, (extra or {}).get(date))
    return changed


def write_day(out_dir, date, rows, extra=None):
    path = os.path.join(out_dir, f"{date}.json")
    body = json.dumps({"date": date, "tz": "Europe/Berlin", "rows": rows, **(extra or {})}, indent=1) + "\n"
    try:
        with open(path) as fh:
            if fh.read() == body:
                return False
    except FileNotFoundError:
        pass
    tmp = path + ".tmp"
    with open(tmp, "w") as fh:
        fh.write(body)
    os.replace(tmp, path)
    return True


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=int, default=3, help="recompute this many days ending today")
    p.add_argument("--backfill", action="store_true", help="also add older days that have no file yet; existing ones are kept")
    p.add_argument("--refresh-prices", action="store_true", help="update prices.json from models.dev")
    p.add_argument("--dry-run", action="store_true", help="print totals, write nothing")
    p.add_argument("--publish", action="store_true",
                   help="write through --store, the timer's own worktree of the context store, and push to main")
    for name, default in DEFAULTS.items():
        p.add_argument(f"--{name.replace('_', '-')}", default=default)
    a = p.parse_args(argv)

    today = dt.datetime.now(TZ).date()
    end = dt.datetime.combine(today + dt.timedelta(days=1), dt.time(), TZ)
    start = EPOCH if a.backfill else dt.datetime.combine(today - dt.timedelta(days=a.days - 1), dt.time(), TZ)

    missing = [n for n in ("claude", "opencode", "router", "hermes", "win_claude", "desktop")
               if not getattr(a, n) or not os.path.exists(getattr(a, n))]
    tally = Tally()
    read_claude(a.claude, start, end, tally)
    read_claude(a.win_claude, start, end, tally, host="windows")
    if a.desktop:
        # Cowork keeps each session's transcript under its own folder.
        read_claude(os.path.join(a.desktop, "local-agent-mode-sessions"), start, end, tally, host="windows")
    read_opencode(a.opencode, start, end, tally)
    read_router(a.router, start, end, tally)
    read_hermes_direct(a.hermes, start, end, tally)

    prices = load_prices(a.prices)
    if a.refresh_prices:
        keys = {f"{k[2]}/{k[3]}" for k in tally.rows} | set(prices.get("models") or {})
        prices = refresh_prices(prices, keys, a.models_dev)
        if not a.dry_run:
            with open(a.prices, "w") as fh:
                json.dump(prices, fh, indent=1)
                fh.write("\n")
    days, unpriced = priced_rows(tally, prices)
    sessions = priced_sessions(tally, prices, session_meta(a.desktop))
    plan = read_plan(a.desktop, start, end) if a.desktop else {}
    extra = {d: {k: v for k, v in (("sessions", sessions.get(d)), ("plan", plan.get(d))) if v}
             for d in set(sessions) | set(plan)}

    window = sorted(days) if a.backfill else [
        (today - dt.timedelta(days=i)).isoformat() for i in range(a.days - 1, -1, -1)]
    # A backfill only adds days; the recompute window is the one place a day is rewritten.
    keep = (today - dt.timedelta(days=a.days - 1)).isoformat() if a.backfill else None
    total = f"days={len(window)} rows={sum(len(days.get(d, [])) for d in window)} unpriced={','.join(sorted(unpriced)) or 'none'} missing={','.join(missing) or 'none'}"
    if a.dry_run:
        for date in window:
            rows = days.get(date, [])
            print(f"{date} rows={len(rows)} calls={sum(r['calls'] for r in rows)} cost=${sum(r['cost'] for r in rows):,.2f}")
    elif a.publish:
        what = f"backfill from {window[0]}" if a.backfill and window else f"daily token usage {today.isoformat()}"
        try:
            result = publish(a.store, a.context, window, days, f"usage: {what}", keep_before=keep, extra=extra)
        except (subprocess.CalledProcessError, RuntimeError) as e:
            detail = e.stderr.strip()[:200] if isinstance(e, subprocess.CalledProcessError) else str(e)
            print(f"usage-collect: {total} FAILED: {detail}", file=sys.stderr)
            return 1
        print(f"usage-collect: {total} {result}", file=sys.stderr)
    elif a.out:
        print(f"usage-collect: {total} changed={write_days(a.out, window, days, keep, extra)}", file=sys.stderr)
    else:
        p.error("pass --publish, --out DIR or --dry-run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
