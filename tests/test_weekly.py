"""周报模式测试：7 天窗口查询 + 重排逻辑(fixture DB)

运行:python -m unittest discover tests
"""

import json
import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import storage
import weekly
from weekly import rank_papers, weekly_score, papers_from_reports


def _insert_paper(conn, pid, title, created_at, votes=0, stars=0,
                  has_code=False, published=""):
    conn.execute("""
        INSERT INTO papers
        (id, title, abstract, authors, url, pdf_url, published,
         source, categories, has_code, code_url, votes, stars,
         reason, pushed, created_at)
        VALUES (?, ?, '', '[]', '', '', ?, 'arxiv', '[]', ?, '', ?, ?, '', 0, ?)
    """, (pid, title, published, 1 if has_code else 0, votes, stars, created_at))


class WeeklyWindowTest(unittest.TestCase):
    """get_papers_since 只返回最近 N 天入库的论文"""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        tmp_path = Path(self._tmp.name)
        self._orig_data_dir = storage.DATA_DIR
        self._orig_db_path = storage.DB_PATH
        storage.DATA_DIR = tmp_path
        storage.DB_PATH = tmp_path / "papers.db"

        conn = storage.init_db()
        now = datetime.now(timezone.utc)
        _insert_paper(conn, "2608.00001", "fresh paper",
                      (now - timedelta(days=1)).isoformat())
        _insert_paper(conn, "2608.00002", "week-edge paper",
                      (now - timedelta(days=6)).isoformat())
        _insert_paper(conn, "2607.00003", "stale paper",
                      (now - timedelta(days=10)).isoformat())
        conn.commit()
        conn.close()

    def tearDown(self):
        storage.DATA_DIR = self._orig_data_dir
        storage.DB_PATH = self._orig_db_path
        self._tmp.cleanup()

    def test_window_excludes_older_papers(self):
        papers = storage.get_papers_since(days=7)
        ids = {p["id"] for p in papers}
        self.assertEqual(ids, {"2608.00001", "2608.00002"})

    def test_window_deserializes_fields(self):
        papers = storage.get_papers_since(days=7)
        p = papers[0]
        self.assertIsInstance(p["authors"], list)
        self.assertIsInstance(p["categories"], list)
        self.assertIsInstance(p["has_code"], bool)

    def test_narrower_window(self):
        papers = storage.get_papers_since(days=3)
        self.assertEqual([p["id"] for p in papers], ["2608.00001"])


class WeeklyRankingTest(unittest.TestCase):
    """rank_papers 按 votes+stars+代码加成 重排,同分按发布时间新者优先"""

    def test_score_composition(self):
        self.assertEqual(weekly_score({"votes": 5, "stars": 3, "has_code": True}), 18)
        self.assertEqual(weekly_score({"votes": 0, "stars": 0, "has_code": False}), 0)
        self.assertEqual(weekly_score({}), 0)

    def test_rank_orders_by_score(self):
        papers = [
            {"id": "a", "votes": 1, "stars": 0, "has_code": False, "published": "2026-08-14"},
            {"id": "b", "votes": 20, "stars": 5, "has_code": True, "published": "2026-08-15"},
            {"id": "c", "votes": 0, "stars": 0, "has_code": True, "published": "2026-08-16"},
        ]
        ranked = rank_papers(papers, top_n=3)
        self.assertEqual([p["id"] for p in ranked], ["b", "c", "a"])

    def test_rank_truncates_to_top_n(self):
        papers = [{"id": str(i), "votes": i, "published": ""} for i in range(20)]
        ranked = rank_papers(papers, top_n=15)
        self.assertEqual(len(ranked), 15)
        self.assertEqual(ranked[0]["id"], "19")

    def test_tie_break_prefers_newer(self):
        papers = [
            {"id": "old", "votes": 5, "published": "2026-08-10"},
            {"id": "new", "votes": 5, "published": "2026-08-16"},
        ]
        ranked = rank_papers(papers, top_n=2)
        self.assertEqual(ranked[0]["id"], "new")


class PapersFromReportsTest(unittest.TestCase):
    """papers_from_reports 用日报 tag 行的真实 👍n 重建 votes(#5)

    修复前所有『高票/有代码』论文一律 votes=10,排序退化为日期序;
    修复后不同论文的真实票数直接决定周报排名。
    """

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._orig_docs = weekly.DOCS_DIR
        weekly.DOCS_DIR = Path(self._tmp.name)

        now = datetime.now(timezone(timedelta(hours=8)))
        newer = now.strftime("%Y-%m-%d")
        older = (now - timedelta(days=2)).strftime("%Y-%m-%d")

        # 新文件里是低票论文,老文件里是高票论文:按日期排会颠倒
        (Path(self._tmp.name) / f"{newer}.md").write_text(
            f"""# 📄 论文日报 | {newer}（周X）

## 1. Low Votes Recent Paper

_高票/有代码 👍3_

[📄 论文](https://arxiv.org/abs/2608.00001)
""", encoding="utf-8")
        (Path(self._tmp.name) / f"{older}.md").write_text(
            f"""# 📄 论文日报 | {older}（周X）

## 1. High Votes Older Paper

_高票/有代码 👍200_

[📄 论文](https://arxiv.org/abs/2608.00002)

## 2. Legacy Paper Without Votes

_高票/有代码_

[📄 论文](https://arxiv.org/abs/2608.00003)
""", encoding="utf-8")

    def tearDown(self):
        weekly.DOCS_DIR = self._orig_docs
        self._tmp.cleanup()

    def test_votes_recovered_from_reports(self):
        papers = {p["id"]: p for p in papers_from_reports(days=7)}
        self.assertEqual(papers["2608.00001"]["votes"], 3)
        self.assertEqual(papers["2608.00002"]["votes"], 200)

    def test_legacy_report_without_votes_falls_back(self):
        """历史日报无 👍n 时按旧信号兜底(高票 tag -> 10),不崩溃"""
        papers = {p["id"]: p for p in papers_from_reports(days=7)}
        self.assertEqual(papers["2608.00003"]["votes"], 10)

    def test_ranking_follows_votes_not_file_date(self):
        """周报排序由真实票数决定:老文件里的高票论文排在新文件低票论文之前"""
        ranked = rank_papers(papers_from_reports(days=7), top_n=3)
        self.assertEqual(ranked[0]["id"], "2608.00002")

    def test_reason_tag_not_polluted_by_votes(self):
        papers = {p["id"]: p for p in papers_from_reports(days=7)}
        self.assertEqual(papers["2608.00002"]["reason"], "高票/有代码")


if __name__ == "__main__":
    unittest.main()
