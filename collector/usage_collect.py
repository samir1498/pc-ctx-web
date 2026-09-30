#!/usr/bin/env python3
"""Collect daily token usage for the context hub.

Reads Claude Code transcripts, opencode.db and the OmniRoute router log, and
writes one <out>/YYYY-MM-DD.json per Europe/Berlin day. Only counts, model and
provider ids, tool and date leave this script; prompt text is never read out.

  usage_collect.py                 recompute the last 3 days (daily run)
  usage_collect.py --backfill      every day any source still has
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
    "models_dev": os.path.join(HOME, ".hermes", "models_dev_cache.json"),
    "prices": os.path.join(HERE, "prices.json"),
    "out": os.path.join(HOME, "observeone", "observeone-context", "usage"),
}
ROUTER_ADDR = "127.0.0.1:20128"
# Router provider names that models.dev files under another id.
PROVIDER_ALIAS = {"gemini": "google", "cloudflare-ai": "cloudflare-workers-ai"}
EPOCH = dt.datetime(2000, 1, 1, tzinfo=TZ)


class Tally:
    """Token counts per (date, tool, provider, model), before pricing."""

    def __init__(self):
        self.rows = defaultdict(lambda: defaultdict(int))
        self.meta = {}

    def add(self, date, tool, provider, model, *, ok=True, input=0, output=0,
            cache_read=0, cache_write=0, cache_write_1h=0, reported_cost=None, calls=1):
        key = (date, tool, provider, model)
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


def read_claude(root, start, end, tally):
    """Dedup by message.id, keeping the last line: output_tokens grows per content block."""
    cutoff = start.timestamp() - 86400
    seen = {}
    for path in glob.iglob(os.path.join(root, "**", "*.jsonl"), recursive=True):
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
                seen[msg.get("id") or f"{path}:{n}"] = (d.get("timestamp"), model, usage)
    for stamp, model, u in seen.values():
        try:
            ts = dt.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
        except ValueError:
            continue
        if not start <= ts < end:
            continue
        write = u.get("cache_creation_input_tokens") or 0
        write_1h = min((u.get("cache_creation") or {}).get("ephemeral_1h_input_tokens") or 0, write)
        tally.add(local_date(ts), "claude-code", "anthropic", norm_claude_model(model),
                  input=u.get("input_tokens"), output=u.get("output_tokens"),
                  cache_read=u.get("cache_read_input_tokens"), cache_write=write,
                  cache_write_1h=write_1h)


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
        date, tool, provider, model = key
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
            "tool": tool, "provider": provider, "model": model,
            "calls": r["calls"], "errors": r["errors"],
            "input": r["input"], "output": r["output"],
            "cacheRead": r["cacheRead"], "cacheWrite": r["cacheWrite"],
            "cost": round(cost, 6), "pricing": pricing,
        })
    for rows in days.values():
        rows.sort(key=lambda x: (x["tool"], x["provider"], x["model"]))
    return days, unpriced


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

def git(repo, *args, check=True):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, check=check).stdout.strip()


def publish(out_dir):
    """Commit only the usage files, straight to main, and push when that is safe.

    Other sessions share this checkout: never push their commits, never rebase their tree.
    """
    repo = git(out_dir, "rev-parse", "--show-toplevel")
    rel = os.path.relpath(out_dir, repo)
    if git(repo, "branch", "--show-current") != "main":
        return "skipped: context store is not on main"
    git(repo, "add", "--", rel)
    if subprocess.run(["git", "-C", repo, "diff", "--cached", "--quiet", "--", rel]).returncode == 0:
        return "nothing to commit"
    git(repo, "fetch", "--quiet", "origin", "main")
    ahead = git(repo, "rev-list", "origin/main..HEAD")
    git(repo, "commit", "--quiet", "-m", f"usage: daily token usage {dt.date.today().isoformat()}", "--", rel)
    sha = git(repo, "rev-parse", "--short", "HEAD")
    if ahead:
        return f"committed {sha}, not pushed: main holds other unpushed commits"
    if subprocess.run(["git", "-C", repo, "merge-base", "--is-ancestor", "origin/main", "HEAD"]).returncode:
        return f"committed {sha}, not pushed: origin/main moved ahead"
    res = subprocess.run(["git", "-C", repo, "push", "--quiet", "origin", "HEAD:main"], capture_output=True, text=True)
    return f"committed {sha}, " + ("pushed" if res.returncode == 0 else f"push failed: {res.stderr.strip()[:200]}")


def write_day(out_dir, date, rows):
    path = os.path.join(out_dir, f"{date}.json")
    body = json.dumps({"date": date, "tz": "Europe/Berlin", "rows": rows}, indent=1) + "\n"
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
    p.add_argument("--backfill", action="store_true", help="every day the sources still hold")
    p.add_argument("--refresh-prices", action="store_true", help="update prices.json from models.dev")
    p.add_argument("--dry-run", action="store_true", help="print totals, write nothing")
    p.add_argument("--publish", action="store_true", help="commit usage/ to the context store's main and push")
    for name, default in DEFAULTS.items():
        p.add_argument(f"--{name.replace('_', '-')}", default=default)
    a = p.parse_args(argv)

    today = dt.datetime.now(TZ).date()
    end = dt.datetime.combine(today + dt.timedelta(days=1), dt.time(), TZ)
    start = EPOCH if a.backfill else dt.datetime.combine(today - dt.timedelta(days=a.days - 1), dt.time(), TZ)

    tally = Tally()
    read_claude(a.claude, start, end, tally)
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

    window = sorted(days) if a.backfill else [
        (today - dt.timedelta(days=i)).isoformat() for i in range(a.days - 1, -1, -1)]
    changed = 0
    for date in window:
        rows = days.get(date, [])
        if a.dry_run:
            cost = sum(r["cost"] for r in rows)
            calls = sum(r["calls"] for r in rows)
            print(f"{date} rows={len(rows)} calls={calls} cost=${cost:,.2f}")
            continue
        if rows or os.path.exists(os.path.join(a.out, f"{date}.json")):
            os.makedirs(a.out, exist_ok=True)
            changed += write_day(a.out, date, rows)
    print(f"usage-collect: days={len(window)} changed={changed} rows={sum(len(v) for v in days.values())}"
          f" unpriced={','.join(sorted(unpriced)) or 'none'}", file=sys.stderr)
    if a.publish and not a.dry_run:
        try:
            print(f"usage-collect: git {publish(a.out)}", file=sys.stderr)
        except subprocess.CalledProcessError as e:
            print(f"usage-collect: git failed: {' '.join(e.cmd[3:])}: {e.stderr.strip()[:200]}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
