"""稍后读清单测试(#8):模板携带 ☆ 收藏、模态视图、导出与徽章的前端结构

纯前端逻辑(localStorage 持久化、BibTeX/Markdown 导出)在 headless
浏览器里做行为验证;这里守护 template.html 的结构契约,防止站点
重构时悄悄丢掉稍后读入口。

运行:python -m unittest discover tests
"""

import unittest
from pathlib import Path

TEMPLATE = (Path(__file__).parent.parent / "docs" /
            "template.html").read_text(encoding="utf-8")


class ReadLaterTemplateTest(unittest.TestCase):

    def test_header_entry_with_badge(self):
        self.assertIn('openReadLater', TEMPLATE)
        self.assertIn('id="rl-badge"', TEMPLATE)

    def test_modal_view_present(self):
        self.assertIn('id="rl-overlay"', TEMPLATE)
        self.assertIn('id="rl-list"', TEMPLATE)

    def test_export_buttons_present(self):
        self.assertIn('exportBibtex', TEMPLATE)
        self.assertIn('exportMarkdown', TEMPLATE)
        self.assertIn('read-later.bib', TEMPLATE)
        self.assertIn('read-later.md', TEMPLATE)

    def test_localstorage_persistence(self):
        self.assertIn("localStorage.getItem", TEMPLATE)
        self.assertIn("localStorage.setItem", TEMPLATE)
        self.assertIn("paperReadLater", TEMPLATE)

    def test_star_buttons_injected_into_cards(self):
        self.assertIn('rlInjectButtons', TEMPLATE)
        self.assertIn('star-btn', TEMPLATE)

    def test_bibtex_uses_arxiv_id(self):
        # BibTeX entry 由 arXiv id 构造(eprint + archivePrefix)
        self.assertIn('archivePrefix', TEMPLATE)
        self.assertIn('eprint', TEMPLATE)

    def test_search_and_hash_filters_survive(self):
        # 稍后读注入不得破坏既有搜索/hash 过滤初始化
        self.assertIn('restoreFromHash()', TEMPLATE)
        self.assertIn("addEventListener('hashchange', restoreFromHash)", TEMPLATE)


if __name__ == "__main__":
    unittest.main()
