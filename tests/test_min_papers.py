"""每期日报至少 min_papers 篇:放宽窗口 + 热度补足 + 不足则不发"""

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import main as main_mod


def P(i, votes=0):
    return {"id": f"2610.{i:05d}v1", "title": f"t{i}", "abstract": "a",
            "url": f"https://arxiv.org/abs/2610.{i:05d}", "votes": votes}


class FetchWindowsTest(unittest.TestCase):
    def test_widens_up_to_max(self):
        self.assertEqual(main_mod.fetch_windows(2, 14), [2, 5, 7, 14])
        self.assertEqual(main_mod.fetch_windows(4, 14), [4, 7, 14])
        self.assertEqual(main_mod.fetch_windows(3, 7), [3, 6, 7])


class TopUpTest(unittest.TestCase):
    def test_fills_to_min_by_hotness_without_duplicates(self):
        cands = [P(1), P(2, votes=5), P(3, votes=9), P(4), P(5, votes=1)]
        out = main_mod.top_up([cands[0]], cands, 4)
        self.assertEqual([p["id"] for p in out],
                         ["2610.00001v1", "2610.00003v1", "2610.00002v1", "2610.00005v1"])

    def test_leaves_enough_alone(self):
        cands = [P(i) for i in range(5)]
        self.assertIs(main_mod.top_up(cands, cands, 4), cands)


class MainMinPapersTest(unittest.TestCase):
    def _run(self, by_days):
        calls = []

        def collect(kw, cats, src, days, pushed):
            calls.append(days)
            return by_days.get(days, [])

        cfg = {"min_papers": 4, "max_fetch_days": 14, "max_papers": 10,
               "notify": {"feishu": False}}
        with mock.patch.object(main_mod, "load_config", return_value=cfg), \
                mock.patch.object(main_mod, "collect_candidates", side_effect=collect), \
                mock.patch.object(main_mod, "get_recent_pushed_ids", return_value=set()), \
                mock.patch.object(main_mod, "filter_papers",
                                  side_effect=lambda ps, *a: (ps[:2], "ai")), \
                mock.patch.object(main_mod, "generate_report") as gen, \
                mock.patch.object(sys, "argv", ["main.py"]):
            main_mod.main()
        return calls, gen

    def test_widens_then_tops_up_to_four(self):
        many = [P(i) for i in range(6)]
        calls, gen = self._run({7: many, 14: many})
        self.assertEqual(calls[-1], 7)
        papers = gen.call_args[0][0]
        self.assertEqual(len(papers), 4)

    def test_skips_digest_when_still_too_few(self):
        calls, gen = self._run({14: [P(1), P(2)]})
        self.assertEqual(calls[-1], 14)
        gen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
