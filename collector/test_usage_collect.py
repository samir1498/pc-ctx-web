import datetime as dt
import json
import os
import sqlite3
import subprocess
import tempfile
import unittest

import usage_collect as uc

START = dt.datetime(2026, 9, 28, tzinfo=uc.TZ)
END = dt.datetime(2026, 10, 1, tzinfo=uc.TZ)
PRICES = {"models": {
    "anthropic/claude-opus-5-5": {"input": 4, "output": 20, "cache_read": 0.2, "cache_write": 5},
    "opencode-go/deepseek-v4.1-flash": {"input": 0.15, "output": 0.6, "cache_read": 0.003},
    "opencode/big-pickle": {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0},
}, "overrides": {}}


def assistant(mid, out, ts="2026-09-29T10:00:00Z", model="claude-opus-5-5", w1h=0):
    usage = {"input_tokens": 10, "output_tokens": out, "cache_read_input_tokens": 1000,
             "cache_creation_input_tokens": 200, "cache_creation": {"ephemeral_1h_input_tokens": w1h}}
    return json.dumps({"type": "assistant", "timestamp": ts,
                       "message": {"id": mid, "model": model, "usage": usage,
                                   "content": [{"type": "text", "text": "never leaves"}]}})


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        self.tally = uc.Tally()

    def tearDown(self):
        self.tmp.cleanup()

    def rows(self):
        days, unpriced = uc.priced_rows(self.tally, PRICES)
        return days, unpriced


class ClaudeTest(Base):
    def write(self, name, lines):
        path = os.path.join(self.dir, "proj", name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            fh.write("\n".join(lines) + "\n")

    def test_last_line_per_message_id_wins(self):
        # One line per content block; output_tokens grows, so the last line is the total.
        self.write("a.jsonl", [assistant("m1", 5), assistant("m1", 50), assistant("m2", 7)])
        self.write("sub/b.jsonl", [assistant("m1", 50)])  # same id seen again after a resume
        uc.read_claude(self.dir, START, END, self.tally)
        (row,) = self.rows()[0]["2026-09-29"]
        self.assertEqual((row["calls"], row["output"], row["input"]), (2, 57, 20))

    def test_synthetic_and_out_of_window_lines_are_dropped(self):
        self.write("a.jsonl", [assistant("s", 9, model="<synthetic>"),
                               assistant("old", 9, ts="2026-09-01T10:00:00Z"),
                               '{"type":"user","message":{"content":"assistant"}}'])
        uc.read_claude(self.dir, START, END, self.tally)
        self.assertEqual(self.rows()[0], {})

    def test_berlin_day_boundary(self):
        self.write("a.jsonl", [assistant("late", 1, ts="2026-09-29T22:30:00Z")])
        uc.read_claude(self.dir, START, END, self.tally)
        self.assertIn("2026-09-30", self.rows()[0])

    def test_one_hour_cache_writes_bill_at_twice_input(self):
        self.write("a.jsonl", [assistant("m", 0, w1h=200)])
        uc.read_claude(self.dir, START, END, self.tally)
        (row,) = self.rows()[0]["2026-09-29"]
        # 10*4 + 1000*0.2 + 200*(4*2), per million
        self.assertAlmostEqual(row["cost"], (40 + 200 + 1600) / 1e6)
        self.assertEqual(row["pricing"], "list")

    def test_dated_model_id_is_normalised(self):
        self.write("a.jsonl", [assistant("m", 1, model="claude-opus-5-5-20260101")])
        uc.read_claude(self.dir, START, END, self.tally)
        self.assertEqual(self.rows()[0]["2026-09-29"][0]["model"], "claude-opus-5-5")


class RouterTest(Base):
    def db(self, rows):
        path = os.path.join(self.dir, "storage.sqlite")
        con = sqlite3.connect(path)
        con.execute("create table call_logs (id integer, timestamp text, path text, status int,"
                    " requested_model text, model text, provider text, api_key_name text,"
                    " tokens_in int, tokens_out int, tokens_cache_read int,"
                    " tokens_cache_creation int, correlation_id text)")
        con.executemany("insert into call_logs values (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
        con.commit()
        con.close()
        return path

    def test_retry_under_one_correlation_id_counts_once(self):
        ts = "2026-09-29T08:00:0{}.000Z"
        path = self.db([
            (1, ts.format(1), "/v1/chat/completions", 504, "cheap", "cheap", "cheap", "hermes", 0, 0, 0, 0, "c1"),
            (2, ts.format(2), "/v1/chat/completions", 200, "opencode-go/deepseek-v4.1-flash", "x", "x",
             "hermes", 1500, 100, 1000, 0, "c1"),
            (3, ts.format(3), "/api/providers/test", 200, None, None, None, None, 0, 0, 0, 0, None),
            (4, ts.format(4), "/v1/chat/completions", 504, "cheap", "cheap", "cheap", None, 0, 0, 0, 0, "c2"),
        ])
        uc.read_router(path, START, END, self.tally)
        rows = {(r["tool"], r["provider"], r["model"]): r for r in self.rows()[0]["2026-09-29"]}
        hermes = rows[("hermes", "opencode-go", "deepseek-v4.1-flash")]
        self.assertEqual((hermes["calls"], hermes["input"], hermes["cacheRead"]), (1, 500, 1000))
        self.assertEqual(rows[("router", "omniroute", "cheap")]["errors"], 1)
        self.assertEqual(len(rows), 2)  # the provider test is not a call

    def test_gemini_is_filed_under_google(self):
        self.assertEqual(uc.split_router_model("gemini/gemini-2.5-flash", None, "omniroute"),
                         ("google", "gemini-2.5-flash"))


class OpencodeTest(Base):
    def db(self, messages):
        path = os.path.join(self.dir, "opencode.db")
        con = sqlite3.connect(path)
        con.execute("create table message (id text, time_created int, data text)")
        base = int(dt.datetime(2026, 9, 29, 12, tzinfo=uc.TZ).timestamp() * 1000)
        con.executemany("insert into message values (?,?,?)",
                        [(str(i), base + i, json.dumps(m)) for i, m in enumerate(messages)])
        con.commit()
        con.close()
        return path

    def msg(self, model, cost=0.0, **extra):
        m = {"role": "assistant", "providerID": "opencode", "modelID": model, "cost": cost,
             "time": {"created": 1, "completed": 2},
             "tokens": {"input": 100, "output": 10, "reasoning": 0, "cache": {"read": 5, "write": 0}}}
        m.update(extra)
        return m

    def test_reported_cost_errors_and_in_flight(self):
        path = self.db([
            self.msg("paid", cost=0.25),
            self.msg("paid", error={"name": "MessageAbortedError"}),
            self.msg("paid", time={"created": 1}),
            self.msg("space-bunny-free"),
            {"role": "user", "modelID": "paid"},
        ])
        uc.read_opencode(path, START, END, self.tally)
        rows = {r["model"]: r for r in self.rows()[0]["2026-09-29"]}
        self.assertEqual((rows["paid"]["calls"], rows["paid"]["errors"]), (1, 1))
        self.assertEqual((rows["paid"]["cost"], rows["paid"]["pricing"]), (0.25, "reported"))
        self.assertEqual(rows["space-bunny-free"]["pricing"], "free")


class PricingTest(Base):
    def test_zero_price_is_free_and_unknown_is_unpriced(self):
        self.tally.add("2026-09-29", "router", "opencode", "big-pickle", input=10)
        self.tally.add("2026-09-29", "router", "mystery", "m1", input=10)
        rows = {r["model"]: r for r in self.rows()[0]["2026-09-29"]}
        self.assertEqual(rows["big-pickle"]["pricing"], "free")
        self.assertEqual(rows["m1"]["pricing"], "unpriced")
        self.assertEqual(self.rows()[1], {"mystery/m1"})

    def test_refresh_keeps_overrides_and_reads_models_dev(self):
        catalog = os.path.join(self.dir, "md.json")
        with open(catalog, "w") as fh:
            json.dump({"groq": {"models": {"x": {"cost": {"input": 1, "output": 2, "reasoning": 9}}}}}, fh)
        out = uc.refresh_prices({"models": {}, "overrides": {"a/b": {"input": 0}}}, {"groq/x", "no/such"}, catalog)
        self.assertEqual(out["models"], {"groq/x": {"input": 1, "output": 2}})
        self.assertEqual(out["overrides"], {"a/b": {"input": 0}})


class MainTest(Base):
    def test_daily_run_writes_counts_only_and_is_idempotent(self):
        now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        os.makedirs(os.path.join(self.dir, "proj"))
        with open(os.path.join(self.dir, "proj", "a.jsonl"), "w") as fh:
            fh.write(assistant("m", 3, ts=now) + "\n")
        prices = os.path.join(self.dir, "prices.json")
        with open(prices, "w") as fh:
            json.dump(PRICES, fh)
        out = os.path.join(self.dir, "out")
        missing = os.path.join(self.dir, "none")
        args = ["--claude", self.dir, "--opencode", missing, "--router", missing,
                "--hermes", missing, "--prices", prices, "--out", out]
        uc.main(args)
        (name,) = os.listdir(out)
        with open(os.path.join(out, name)) as fh:
            body = fh.read()
        self.assertNotIn("never leaves", body)
        self.assertEqual(json.loads(body)["rows"][0]["output"], 3)
        self.assertFalse(uc.write_day(out, name[:-5], json.loads(body)["rows"]))


class PublishTest(Base):
    def setUp(self):
        super().setUp()
        run = lambda *a, cwd=self.dir: subprocess.run(a, cwd=cwd, check=True, capture_output=True)
        self.run = run
        run("git", "init", "-q", "--bare", "-b", "main", "remote.git")
        run("git", "clone", "-q", "remote.git", "store")
        self.store = os.path.join(self.dir, "store")
        for k, v in (("user.email", "t@t"), ("user.name", "t"), ("commit.gpgsign", "false")):
            run("git", "config", k, v, cwd=self.store)
        run("git", "commit", "-q", "--allow-empty", "-m", "init", cwd=self.store)
        run("git", "push", "-q", "origin", "main", cwd=self.store)
        self.usage = os.path.join(self.store, "usage")
        os.makedirs(self.usage)

    def remote_log(self):
        return subprocess.run(["git", "--git-dir", os.path.join(self.dir, "remote.git"), "log",
                               "--name-only", "--format=%s", "main"], capture_output=True, text=True).stdout

    def test_commits_and_pushes_only_usage_files(self):
        with open(os.path.join(self.store, "plan.md"), "w") as fh:
            fh.write("another session's work\n")
        self.run("git", "add", "plan.md", cwd=self.store)
        uc.write_day(self.usage, "2026-09-29", [])
        self.assertTrue(uc.publish(self.usage).endswith("pushed"))
        log = self.remote_log()
        self.assertIn("usage/2026-09-29.json", log)
        self.assertNotIn("plan.md", log)
        self.assertEqual(uc.publish(self.usage), "nothing to commit")

    def test_does_not_push_other_unpushed_commits(self):
        self.run("git", "commit", "-q", "--allow-empty", "-m", "theirs", cwd=self.store)
        uc.write_day(self.usage, "2026-09-29", [])
        self.assertIn("not pushed", uc.publish(self.usage))
        self.assertNotIn("theirs", self.remote_log())


if __name__ == "__main__":
    unittest.main()
