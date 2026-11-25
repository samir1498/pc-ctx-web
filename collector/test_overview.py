import json
import os
import tempfile
import unittest

import overview


class RefusalTest(unittest.TestCase):
    def test_a_phone_number_or_a_lead_name_is_refused_and_nothing_is_written(self):
        now = overview.TZ_NOW()
        with tempfile.TemporaryDirectory() as out:
            for dot_title, names in [("Call 0555 12 34 56 back", set()), ("Visit with Dr Amrani Karim", {"Amrani Karim"})]:
                files = {"index.json": {"products": [{"title": dot_title}]}}
                with self.assertRaises(SystemExit):
                    overview.write_files(files, names, out, now)
                self.assertEqual(os.listdir(out), [])
            ok = overview.write_files({"index.json": {"products": [{"title": "0.7.2 published 2026-11-19, PR 774"}]}}, {"Amrani Karim"}, out, now)
            self.assertEqual(ok, ["index.json"])
            self.assertEqual(json.load(open(os.path.join(out, "index.json")))["products"][0]["title"][:5], "0.7.2")


if __name__ == "__main__":
    unittest.main()
