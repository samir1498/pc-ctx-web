#!/usr/bin/env python3
"""Build the Overview data for the context hub from the dz-pos checkout.

Writes <repo>/context/overview/products/<id>.json, loops.json and index.json:
one roadmap line per product (versions, features released, installs, customers)
and every loop (our sessions, scheduled tasks, the owner's chats about our apps).
Only counts, titles and dates leave this script; a file that holds a phone
number or a name from the lead lists or the licence ledger is refused.

  overview.py                 write the files, leave them uncommitted
  overview.py --commit        also commit to main, only when the content changed
  overview.py --out DIR       write to DIR instead of <repo>/context/overview
  overview.py --rules FILE    another rules file (default: overview_rules.json beside this)
"""
import argparse
import csv
import datetime as dt
import glob
import json
import os
import re
import subprocess
import sys
import urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
KINDS = ["version", "feature", "install", "customer", "contacts"]
PHONE_RE = re.compile(r"(?<![\d.])(?:\+|00)?(?:213|0)[\s.-]?[567](?:[\s.-]?\d){8}(?!\d)|\+\d[\d\s.-]{7,}\d")
SEMVER_RE = re.compile(r"v?(\d+)\.(\d+)\.(\d+)")
SUBJECT_RE = re.compile(r"^(\w+)\(([^)]*)\)!?:\s*(.*?)(?:\s*\(#(\d+)\))?$")
CTX_RE = re.compile(r"^ctx:\s*(?:plan:)?([\w.-]+?)(?:/[\w.-]+)?(?:\s+\w+)?\s*$", re.M)
TZ_NOW = dt.datetime.now


def expand(p):
    return os.path.expanduser(p)


def load_rules(path=None):
    with open(path or os.path.join(HERE, "overview_rules.json"), encoding="utf-8") as f:
        return json.load(f)


def run(cmd, cwd=None, timeout=60):
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def frontmatter(path):
    """The flat key: value lines of a markdown file's front matter, and its body."""
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return {}, ""
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        return {}, text
    fm = {}
    for line in m.group(1).splitlines():
        k = re.match(r"^([\w-]+):\s*(.*)$", line)
        if k:
            v = k.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
                v = v[1:-1].replace("''", "'")
            fm[k.group(1)] = v
    return fm, m.group(2)


def cut(text, limit):
    """At most limit characters, cut at a word with an ellipsis."""
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:-") + "…"


def first_heading(body):
    m = re.search(r"^#\s+(.+)$", body, re.M)
    return m.group(1).strip() if m else ""


def first_paragraph(body, limit=170):
    for block in re.split(r"\n{2,}", body):
        b = block.strip()
        if b and not b.startswith("#"):
            b = re.sub(r"[`*_>#|]", "", re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", b))
            return cut(re.sub(r"\s+", " ", b), limit)
    return ""


def hub(rules, kind, slug):
    return f"/p/{rules['hub_project']}/{kind}/{slug}"


# ---- products, scopes -------------------------------------------------------

def scope_kind(rules, scope):
    """A product id, 'shared' or 'skip'; an unknown scope counts as shared and is reported."""
    kinds = [rules["scopes"].get(x.strip()) for x in scope.split(",")]
    if any(k is None for k in kinds):
        return None
    for k in kinds:
        if k in rules["products"]:
            return k
    return "shared" if "shared" in kinds else "skip"


def words_product(rules, text):
    for pid, p in rules["products"].items():
        if has_word(text, p["words"]):
            return pid
    return None


def has_word(text, words):
    """A word starts at a word boundary, so 'till' is not found in 'until'."""
    return any(re.search(r"\b" + re.escape(w), text, re.I) for w in words)


def semver_key(v):
    m = SEMVER_RE.search(v)
    return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)


# ---- git --------------------------------------------------------------------

def git_commits(rules):
    out = run(["git", "log", rules["branch"], "--format=%H%x1f%ad%x1f%s%x1f%b%x1e", "--date=short"], cwd=expand(rules["repo_dir"]), timeout=120)
    commits = []
    for rec in out.split("\x1e"):
        parts = rec.strip("\n").split("\x1f")
        if len(parts) == 4:
            commits.append({"sha": parts[0].strip(), "date": parts[1], "subject": parts[2], "body": parts[3]})
    return commits


def git_tags(rules):
    cwd = expand(rules["repo_dir"])
    tags = {}
    for line in run(["git", "tag", "--format=%(refname:short)|%(creatordate:short)"], cwd=cwd).splitlines():
        name, _, date = line.partition("|")
        tags[name] = date
    return tags


def plan_index(rules):
    """slug -> (file stem, title) for every plan, archived ones too."""
    base = os.path.join(expand(rules["repo_dir"]), "context", "plans")
    out = {}
    for path in glob.glob(os.path.join(base, "*.md")) + glob.glob(os.path.join(base, "archived", "*.md")):
        fm, _ = frontmatter(path)
        stem = os.path.basename(path)[:-3]
        title = fm.get("title") or re.sub(r"^\d{8}-", "", stem).replace("-", " ")
        for key in {stem, fm.get("slug", stem)}:
            out[key] = (stem, title)
    return out


def plan_for(plans, slug):
    if slug in plans:
        return plans[slug]
    for key, val in plans.items():
        if key.endswith("-" + slug):
            return val
    return None


def report_list(rules):
    """[(slug, date, title, tldr)] for every report."""
    base = os.path.join(expand(rules["repo_dir"]), "context", "reports")
    rows = []
    for path in glob.glob(os.path.join(base, "*.md")):
        fm, body = frontmatter(path)
        slug = os.path.basename(path)[:-3]
        m = re.match(r"^(\d{4})(\d{2})(\d{2})", slug)
        date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""
        rows.append((slug, date, fm.get("title") or first_heading(body) or slug, fm.get("tldr", ""), fm))
    return rows


def pr_link(rules, n):
    return {"label": f"PR {n}", "href": f"https://github.com/{rules['repo']}/pull/{n}"}


def clean_subject(s):
    s = SUBJECT_RE.match(s)
    return s.group(3) if s else ""


def build_dots(rules, warnings):
    commits = git_commits(rules)
    plans = plan_index(rules)
    tags = git_tags(rules)
    reports = report_list(rules)
    dots = defaultdict(list)
    products = rules["products"]

    # Versions: releases first, then version commits and tags the releases page lacks.
    versions = defaultdict(dict)  # product -> version -> {date, draft, pr, tag, href}
    for pid, p in products.items():
        if not p["releases_repo"]:
            continue
        raw = run(["gh", "release", "list", "-R", p["releases_repo"], "--limit", "100", "--json", "tagName,isDraft,publishedAt,createdAt"])
        try:
            rels = json.loads(raw) if raw else []
        except ValueError:
            rels = []
            warnings.append(f"gh release list failed for {p['releases_repo']}")
        for r in rels:
            m = SEMVER_RE.search(r["tagName"])
            if not m:
                continue
            published = r.get("publishedAt", "")
            date = (published if published and not published.startswith("0001") else r["createdAt"])[:10]
            versions[pid][".".join(m.groups())] = {"date": date, "draft": bool(r["isDraft"]), "tag": r["tagName"], "href": f"https://github.com/{p['releases_repo']}/releases/tag/{r['tagName']}"}
    for tag, date in tags.items():
        for pid, p in products.items():
            pre = p["tag_prefix"]
            if tag.startswith(pre) and SEMVER_RE.fullmatch(tag[len(pre):]):
                v = ".".join(SEMVER_RE.fullmatch(tag[len(pre):]).groups())
                versions[pid].setdefault(v, {"date": date, "draft": None, "tag": tag})
    vcommit = re.compile(r"^chore\((%s)\):\s*v?(\d+\.\d+\.\d+)" % "|".join(map(re.escape, list(products) + ["saydali"])))
    for c in commits:
        m = vcommit.match(c["subject"])
        if m:
            pid = "dinar" if m.group(1) == "saydali" else m.group(1)
            n = SUBJECT_RE.match(c["subject"])
            rec = versions[pid].setdefault(m.group(2), {"date": c["date"], "draft": None})
            rec["date"] = c["date"]
            if n and n.group(4):
                rec["pr"] = n.group(4)
    for pid, vs in versions.items():
        by_day = defaultdict(list)
        for v, rec in vs.items():
            by_day[rec["date"]].append((v, rec))
        for date, items in by_day.items():
            items.sort(key=lambda x: semver_key(x[0]))
            names = [v for v, _ in items]
            title = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
            draft = [r.get("draft") for _, r in items]
            state = "published" if any(d is False for d in draft) else "draft build" if any(d is True for d in draft) else "built from main"
            links = []
            for v, rec in items:
                if rec.get("pr"):
                    links.append(pr_link(rules, rec["pr"]))
                if rec.get("href"):
                    links.append({"label": f"Release {v}", "href": rec["href"]})
                for slug, _, rtitle, _, _ in reports:
                    if re.search(r"(?<![\d.])" + re.escape(v) + r"(?![\d])", rtitle) and len(links) < 6:
                        links.append({"label": "Report", "href": hub(rules, "reports", slug)})
            dots[pid].append({"date": date, "kind": "version", "title": title, "detail": f"{state.capitalize()}.", "links": links, "cross": [], "_v": semver_key(names[-1])})

    # Features: merged feat commits grouped by plan; the rest folded by month.
    groups = defaultdict(lambda: {"commits": [], "scopes": set()})
    unmapped = set()
    for c in commits:
        m = SUBJECT_RE.match(c["subject"])
        if not m or m.group(1) != "feat":
            continue
        scope = m.group(2)
        kind = scope_kind(rules, scope)
        if kind == "skip":
            continue
        if kind is None:
            unmapped.update(x.strip() for x in scope.split(",") if x.strip() not in rules["scopes"])
        slugs = CTX_RE.findall(c["body"])
        slug = next((s for s in slugs if plan_for(plans, s)), None)
        pid = kind if kind in products else None
        key = (slug or "month:" + c["date"][:7])
        groups[key]["commits"].append(c)
        groups[key]["scopes"].add(scope)
        groups[key].setdefault("pids", set())
        if pid:
            groups[key]["pids"].add(pid)
    if unmapped:
        warnings.append("scopes with no rule (counted as shared): " + ", ".join(sorted(unmapped)))
    monthly = defaultdict(lambda: defaultdict(list))
    for key, g in groups.items():
        cs = sorted(g["commits"], key=lambda c: c["date"])
        names = [clean_subject(c["subject"]) for c in cs]
        prs = []
        for c in cs:
            n = SUBJECT_RE.match(c["subject"])
            if n and n.group(4) and n.group(4) not in prs:
                prs.append(n.group(4))
        text_for_words = " ".join(names + ([plan_for(plans, key)[1]] if not key.startswith("month:") and plan_for(plans, key) else []))
        found = set(g["pids"])
        for pid, p in products.items():
            if has_word(text_for_words, p["words"][:1]):
                found.add(pid)
        tally = defaultdict(int)
        for c in cs:
            kind = scope_kind(rules, SUBJECT_RE.match(c["subject"]).group(2))
            if kind in products:
                tally[kind] += 1
        owner = max(tally, key=tally.get) if tally else (words_product(rules, text_for_words) or rules["default_product"])
        cross = sorted(found - {owner})
        if key.startswith("month:"):
            monthly[owner][key[6:]].extend(cs)
            continue
        stem, ptitle = plan_for(plans, key)
        detail = f"{len(cs)} change{'s' if len(cs) != 1 else ''}: " + "; ".join(names[:4]) + ("; and more" if len(names) > 4 else "") + "."
        links = [{"label": "Plan: " + ptitle[:60], "href": hub(rules, "plan", stem)}] + [pr_link(rules, n) for n in prs[:5]]
        dots[owner].append({"date": cs[0]["date"], "kind": "feature", "title": ptitle, "detail": detail, "links": links, "cross": cross, "_plan": key})
    for pid, months in monthly.items():
        for month, cs in months.items():
            cs.sort(key=lambda c: c["date"])
            prs = [SUBJECT_RE.match(c["subject"]).group(4) for c in cs if SUBJECT_RE.match(c["subject"]).group(4)]
            names = [clean_subject(c["subject"]) for c in cs]
            dots[pid].append({"date": cs[0]["date"], "kind": "feature", "title": f"Other changes, {month}", "detail": f"{len(cs)} changes with no plan: " + "; ".join(names[:3]) + ("; and more" if len(names) > 3 else "") + ".", "links": [pr_link(rules, n) for n in prs[:5]], "cross": []})

    # Installs: reports whose title says an install happened.
    for slug, date, title, tldr, _ in reports:
        low = title.lower()
        pid = words_product(rules, title + " " + slug)
        if pid and any(w in low for w in rules["install_words"]):
            dots[pid].append({"date": date, "kind": "install", "title": title[:90], "detail": cut(tldr or title, 200), "links": [{"label": "Report", "href": hub(rules, "reports", slug)}], "cross": []})
        # A report may declare its own dot: overview_product / overview_kind / overview_title in its front matter.
    for slug, date, title, tldr, fm in reports:
        if fm.get("overview_product") in products and fm.get("overview_kind") in KINDS:
            dots[fm["overview_product"]].append({"date": date, "kind": fm["overview_kind"], "title": fm.get("overview_title") or title[:90], "detail": cut(tldr or title, 200), "links": [{"label": "Report", "href": hub(rules, "reports", slug)}], "cross": []})
    return dots


# ---- customers, contacts ----------------------------------------------------

def licence_token(rules):
    for f in rules["licence_token_files"]:
        try:
            for line in open(expand(f), encoding="utf-8"):
                if line.startswith("ADMIN_TOKEN="):
                    return line.split("=", 1)[1].strip().strip("'\"")
        except OSError:
            continue
    return os.environ.get("LICENCE_ADMIN_TOKEN", "")


def licence_listing(url, token):
    req = urllib.request.Request(url.rstrip("/") + "/admin/licences", headers={"Authorization": "Bearer " + token, "User-Agent": "overview-collector"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def count_customers(listing, rules, today):
    """({product: {count, since}}, names): counts of live, paying licences; the names only to be refused."""
    out, names = {}, set()
    seen = defaultdict(set)
    for lic in listing.get("licences", []):
        for k in ("licensee", "customer"):
            if lic.get(k):
                names.add(str(lic[k]))
    for c in listing.get("customers", []):
        if isinstance(c, dict) and c.get("name"):
            names.add(str(c["name"]))
    for lic in listing.get("licences", []):
        label = f"{lic.get('licensee', '')} {lic.get('id', '')}".lower()
        if lic.get("revoked_at") or not lic.get("machine") or any(w in label for w in rules["demo_words"]):
            continue
        if str(lic.get("ends", "9999")) < today:
            continue
        pid = "dinar" if lic.get("product") == "saydali" else lic.get("product")
        who = str(lic.get("customer") or lic.get("licensee") or lic.get("id"))
        seen[pid].add(who)
        rec = out.setdefault(pid, {"count": 0, "since": str(lic.get("issued", ""))})
        rec["since"] = max(rec["since"], str(lic.get("issued", "")))
    for pid, who in seen.items():
        out[pid]["count"] = len(who)
    # Cabinets that run on an old-key licence are not in the ledger; the reports count them.
    for pid, n in rules.get("customers_outside_ledger", {}).items():
        rec = out.setdefault(pid, {"count": 0, "since": ""})
        rec["count"] += n
        rec["since"] = max(rec["since"], rules.get("customers_outside_since", ""))
    return out, names


def contacts_dots(rules):
    """One dot per week from the outreach stats file, when the rules name one and it exists."""
    path = expand(rules.get("contacts_stats", ""))
    if not rules.get("contacts_stats") or not os.path.exists(path):
        return []
    weeks = defaultdict(lambda: [0, 0])
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            d = (row.get("date") or "")[:10]
            try:
                day = dt.date.fromisoformat(d)
            except ValueError:
                continue
            monday = (day - dt.timedelta(days=day.weekday())).isoformat()
            weeks[monday][0] += int(row.get("sent") or 0)
            weeks[monday][1] += int(row.get("replied") or 0)
    return [{"date": w, "kind": "contacts", "title": f"Outreach week of {w[8:]}.{w[5:7]}: {s} messaged, {r} answered", "detail": "Counts only, from the outreach stats.", "links": [], "cross": []} for w, (s, r) in sorted(weeks.items())]


def lead_names(rules):
    names = set()
    for pattern in rules["lead_name_files"]:
        for path in glob.glob(expand(pattern)):
            try:
                with open(path, encoding="utf-8") as f:
                    for row in csv.DictReader(f):
                        for k in ("name", "nom", "doctor", "full_name"):
                            if row.get(k):
                                names.add(row[k].strip())
            except OSError:
                continue
    return names


# ---- loops ------------------------------------------------------------------

def hour_grain(t):
    """Last activity at the hour, so a watcher tick every ten minutes changes nothing."""
    return t.strftime("%Y-%m-%d %H:00")


def state_for(age_s, rules):
    if age_s < rules["running_minutes"] * 60:
        return "running"
    if age_s < rules["quiet_hours"] * 3600:
        return "quiet"
    return "stale"


def loops_from_sessions(rules, now):
    root = expand(rules["repo_dir"])
    path = os.path.join(root, ".dinar", "sessions.tsv")
    activity = {}
    for line in run(["tmux", "list-windows", "-a", "-F", "#{window_name} #{window_activity}"]).splitlines():
        name, _, ts = line.rpartition(" ")
        if ts.isdigit():
            activity[name] = max(activity.get(name, 0), int(ts))
    loops = []
    try:
        rows = list(csv.DictReader(open(path, encoding="utf-8"), delimiter="\t"))
    except OSError:
        return loops
    for r in rows:
        name = r.get("name", "")
        lf = expand(r.get("loop_file", ""))
        if not os.path.isabs(lf):
            lf = os.path.join(root, lf)
        fm, body = frontmatter(lf)
        title = rules["session_titles"].get(name) or re.sub(r"^(Brief|Loop):\s*", "", fm.get("title") or first_heading(body)) or name
        what = rules.get("session_what", {}).get(name) or fm.get("tldr") or "A session started from its brief."
        ts = activity.get(name)
        last = dt.datetime.fromtimestamp(ts) if ts else None
        link = ""
        if "/context/loops/" in lf or lf.startswith(os.path.join(root, "context", "loops")):
            link = hub(rules, "loops", os.path.basename(lf)[:-3])
        loops.append({"name": title[:70], "owner": "ours", "what": cut(what, 170), "last": hour_grain(last) if last else "", "link": link, "state": state_for((now - last).total_seconds(), rules) if last else "paused", "_file": lf})
    return loops


def loops_from_files(rules, now, taken):
    base = os.path.join(expand(rules["repo_dir"]), "context", "loops")
    loops = []
    for path in sorted(glob.glob(os.path.join(base, "*.md"))):
        if path in taken:
            continue
        fm, body = frontmatter(path)
        status = fm.get("status", "active")
        out = run(["git", "log", "-1", "--format=%cI", "--", path], cwd=expand(rules["repo_dir"]))
        try:
            last = dt.datetime.fromisoformat(out.strip()).replace(tzinfo=None) if out.strip() else None
        except ValueError:
            last = None
        if status in ("done", "archived", "cancelled"):
            state = "done"
        elif status == "paused":
            state = "paused"
        elif last and (now - last).days >= rules["stale_days"]:
            state = "stale"
        else:
            state = "quiet"
        loops.append({"name": (fm.get("title") or first_heading(body) or os.path.basename(path)[:-3])[:70], "owner": "ours", "what": cut(fm.get("tldr") or first_paragraph(body), 170), "last": hour_grain(last) if last else "", "link": hub(rules, "loops", os.path.basename(path)[:-3]), "state": state})
    return loops


def loops_from_schedules(rules, now):
    loops, other, plumbing = [], 0, 0
    ps = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
    if os.path.exists(ps):
        cmd = "Get-ScheduledTask | Where-Object {$_.TaskName -like 'dz-*'} | ForEach-Object { $i=$_ | Get-ScheduledTaskInfo; '{0}|{1}|{2}' -f $_.TaskName,$_.State,$i.LastRunTime.ToString('s') }"
        for line in run([ps, "-NoProfile", "-Command", cmd], timeout=90).splitlines():
            name, _, rest = line.strip().partition("|")
            st, _, last = rest.partition("|")
            if not name:
                continue
            if re.search(rules["scheduled_skip"], name):
                plumbing += 1
                continue
            try:
                t = dt.datetime.fromisoformat(last)
            except ValueError:
                t = None
            if t and t.year < 2000:
                t = None
            state = "paused" if st == "Disabled" else ("quiet" if t and (now - t).days > 14 else "scheduled")
            loops.append({"name": name, "owner": "ours", "what": rules["scheduled_what"].get(name, "A Windows scheduled task on the owner's PC."), "last": hour_grain(t) if t else "", "link": "", "state": state})
    for base in rules["cowork_dirs"]:
        for d in sorted(glob.glob(os.path.join(expand(base), "*"))):
            if not os.path.isdir(d):
                continue
            name = os.path.basename(d)
            if not name.startswith(rules["cowork_ours_prefix"]):
                other += 1
                continue
            if re.search(rules["scheduled_skip"], name):
                plumbing += 1
                continue
            skill = os.path.join(d, "SKILL.md")
            fm, body = frontmatter(skill)
            t = dt.datetime.fromtimestamp(os.path.getmtime(skill)) if os.path.exists(skill) else None
            loops.append({"name": name, "owner": "ours", "what": rules["scheduled_what"].get(name) or cut(fm.get("description") or first_paragraph(body) or "A scheduled Cowork task.", 170), "last": hour_grain(t) if t else "", "link": "", "state": "scheduled"})
    return loops, other, plumbing


def loops_from_chats(rules, now):
    """The owner's desktop chats about our apps, by title; the rest only counted."""
    keys = re.compile(rules["chat_keys"])
    root = rules["chats_root"]
    loops, other = [], 0
    for f in glob.glob(f"{root}/claude-code-sessions/*/*/local_*.json") + glob.glob(f"{root}/local-agent-mode-sessions/*/*/local_*.json"):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if d.get("scheduledTaskId"):
            continue
        last = d.get("lastActivityAt")
        title = d.get("title") or ""
        if not isinstance(last, (int, float)) or not title:
            continue
        if not keys.search(title):
            other += 1
            continue
        t = dt.datetime.fromtimestamp(last / 1000)
        age = (now - t).total_seconds()
        if age > rules["chat_days"] * 86400:
            other += 1
            continue
        state = "running" if age < rules["running_minutes"] * 60 else "quiet" if age < 3 * 86400 else "stale"
        loops.append({"name": title[:70], "owner": "owner", "what": "A chat on the owner's desktop about our apps.", "last": hour_grain(t), "link": "", "state": state})
    loops.sort(key=lambda l: l["last"], reverse=True)
    return loops[:40], other


# ---- assemble ---------------------------------------------------------------

def finish_dots(pid, dots):
    dots.sort(key=lambda d: (d["date"], KINDS.index(d["kind"]), d["title"]))
    counter = defaultdict(int)
    for d in dots:
        key = (d["date"], d["kind"])
        counter[key] += 1
        d["id"] = f"{pid}-{d['date'].replace('-', '')}-{d['kind']}-{counter[key]}"
    return dots


def link_cross(all_dots):
    """A cross chip names the other product's dot nearest in time."""
    for pid, dots in all_dots.items():
        for d in dots:
            chips = []
            for other in d.get("cross", []):
                cands = all_dots.get(other) or []
                if not cands:
                    continue
                t = dt.date.fromisoformat(d["date"])
                near = min(cands, key=lambda x: abs((dt.date.fromisoformat(x["date"]) - t).days))
                chips.append({"product": other, "id": near["id"], "date": near["date"], "title": near["title"]})
            d["cross"] = chips


def build(rules, now=None, listing=None, warnings=None):
    now = now or TZ_NOW()
    warnings = warnings if warnings is not None else []
    today = now.date().isoformat()
    dots = build_dots(rules, warnings)
    names = lead_names(rules)
    customers = {}
    try:
        listing = listing if listing is not None else licence_listing(rules["licence_url"], licence_token(rules))
        customers, ledger_names = count_customers(listing, rules, today)
        names |= ledger_names
        source = "licence server and reports"
    except Exception as e:  # network, token, shape: fall back to what the reports say
        warnings.append(f"licence counts not read ({type(e).__name__}); using the counts in the rules file")
        customers = {p: {"count": n, "since": ""} for p, n in rules.get("customers_outside_ledger", {}).items()}
        source = "reports"
    for pid in rules["products"]:
        rec = customers.get(pid, {"count": 0, "since": ""})
        if rec["count"] and rec["since"]:
            dots[pid].append({"date": rec["since"], "kind": "customer", "title": f"{rec['count']} customer{'s' if rec['count'] != 1 else ''}", "detail": f"Live paying licences, counted on the {source}.", "links": [], "cross": []})
    dots["tabib"].extend(contacts_dots(rules))
    all_dots = {pid: finish_dots(pid, dots.get(pid, [])) for pid in rules["products"]}
    link_cross(all_dots)

    products, index_products = {}, []
    for pid, p in rules["products"].items():
        ds = all_dots[pid]
        versions = [d for d in ds if d["kind"] == "version"]
        latest = max(versions, key=lambda d: d["_v"])["title"].split(" ")[-1] if versions else ""
        rec = customers.get(pid, {"count": 0, "since": ""})
        for d in ds:
            d.pop("_v", None)
            d.pop("_plan", None)
        products[pid] = {"id": pid, "name": p["name"], "tagline": p["tagline"], "latest": latest, "customers": {"count": rec["count"], "source": source}, "dots": ds}
        index_products.append({"id": pid, "name": p["name"], "tagline": p["tagline"], "latest": latest, "customers": rec["count"], "dots": len(ds), "contactWeeks": sum(1 for d in ds if d["kind"] == "contacts"), "first": ds[0]["date"] if ds else "", "kinds": {k: sum(1 for d in ds if d["kind"] == k) for k in KINDS}, "strip": [{"id": d["id"], "date": d["date"], "kind": d["kind"]} for d in ds]})

    sess = loops_from_sessions(rules, now)
    taken = {l.pop("_file") for l in sess}
    loops = sess + loops_from_files(rules, now, taken)
    sched, cowork_other, plumbing = loops_from_schedules(rules, now)
    chats, chats_other = loops_from_chats(rules, now)
    loops += sched + chats
    for i, l in enumerate(loops):
        l["id"] = f"loop-{i + 1}"
    order = ["running", "scheduled", "quiet", "stale", "paused", "done"]
    loops.sort(key=lambda l: order.index(l["state"]))
    for i, l in enumerate(loops):
        l["id"] = f"loop-{i + 1}"
    folded = []
    if cowork_other or chats_other:
        folded.append({"owner": "owner's PC", "text": f"The other business on the owner's PC: {cowork_other} scheduled tasks and {chats_other} chats, not listed."})
    if plumbing:
        folded.append({"owner": "ours", "text": f"{plumbing} helper tasks (browser keep-alives, screenshots, one-off runs) are not listed."})
    loops_doc = {"loops": loops, "folded": folded, "counts": {s: sum(1 for l in loops if l["state"] == s) for s in order}}
    docs = docs_list(rules)
    index = {"products": index_products, "loops": loops_doc["counts"], "docs": docs, "customersSource": source}
    files = {"index.json": index, "loops.json": loops_doc}
    for pid, doc in products.items():
        files[f"products/{pid}.json"] = doc
    return files, names, warnings


def docs_list(rules):
    base = os.path.join(expand(rules["repo_dir"]), "context", "overview", "docs")
    out = []
    paths = sorted(glob.glob(os.path.join(base, "*.md")))
    if not paths:  # before the files move into overview/docs
        paths = [os.path.join(expand(rules["repo_dir"]), p) for p in rules.get("docs_fallback", [])]
    for path in paths:
        fm, body = frontmatter(path)
        slug = os.path.basename(path)[:-3]
        given = rules.get("doc_notes", {}).get(slug, {})
        out.append({"slug": slug, "title": given.get("title") or fm.get("title") or first_heading(body) or slug, "note": given.get("note") or cut(fm.get("tldr") or first_paragraph(body), 160)})
    return out


# ---- refusal, writing, committing ------------------------------------------

def refusal(text, names):
    """Why this file text must not be written: a phone number, or a name from the lead lists or ledger."""
    m = PHONE_RE.search(text)
    if m:
        return "a phone number (" + m.group(0)[:4] + "...)"
    low = text.lower()
    for n in names:
        if len(n.strip()) >= 4 and n.strip().lower() in low:
            return "a name from the lead lists or the licence ledger"
    return ""


def scrub(value, names):
    """Every string with the people's names swapped for 'the owner'."""
    if isinstance(value, str):
        for n in names:
            value = re.sub(r"\b" + re.escape(n) + r"\b", "the owner", value)
        return value
    if isinstance(value, list):
        return [scrub(v, names) for v in value]
    if isinstance(value, dict):
        return {k: scrub(v, names) for k, v in value.items()}
    return value


def comparable(doc):
    d = dict(doc)
    d.pop("generated", None)
    return d


def write_files(files, names, out_dir, now, people=()):
    """Write the files whose content changed (the generated stamp aside); refuse before touching disk."""
    rendered = {}
    files = {rel: scrub(doc, people) for rel, doc in files.items()}
    for rel, doc in files.items():
        text = json.dumps({"generated": now.strftime("%Y-%m-%d %H:%M"), **doc}, indent=1, ensure_ascii=False) + "\n"
        why = refusal(text, names)
        if why:
            raise SystemExit(f"refusing to write {rel}: it holds {why}")
        rendered[rel] = text
    changed = []
    for rel, text in rendered.items():
        path = os.path.join(out_dir, rel)
        old = None
        try:
            old = json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError):
            pass
        if old is not None and comparable(old) == comparable(files[rel]):
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        changed.append(rel)
    return changed


def commit(rules, out_dir, changed):
    repo = expand(rules["repo_dir"])
    if not changed:
        return "nothing changed, no commit"
    if run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=repo).strip() != rules["branch"]:
        return f"not on {rules['branch']}, files left uncommitted"
    rel = os.path.relpath(out_dir, repo)
    run(["git", "add", "--", *[os.path.join(rel, c) for c in changed]], cwd=repo)
    msg = f"ctx(overview): data refreshed, {len(changed)} file{'s' if len(changed) != 1 else ''}\n\nctx: {rules['commit_plan']} progress\n"
    res = subprocess.run(["git", "commit", "-m", msg, "--", *[os.path.join(rel, c) for c in changed]], cwd=repo, capture_output=True, text=True)
    return "committed" if res.returncode == 0 else "commit failed: " + (res.stderr or res.stdout)[-300:]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--commit", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--rules")
    args = ap.parse_args(argv)
    rules = load_rules(args.rules)
    out_dir = expand(args.out or os.path.join(rules["repo_dir"], "context", "overview"))
    now = TZ_NOW()
    files, names, warnings = build(rules, now)
    changed = write_files(files, names, out_dir, now, rules.get("person_names", []))
    for w in warnings:
        print("warning:", w, file=sys.stderr)
    print(f"wrote {len(changed)} of {len(files)} files to {out_dir}: {', '.join(changed) or 'no change'}")
    if args.commit:
        print(commit(rules, out_dir, changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
