"""scripts/sync.py 的分类契约

这个脚本唯一“危险”的判断是：哪些冲突文件可以自动解决（生成物 → 取我方 + 重生成），
哪些必须让人来处理（数据 / 模板 / 脚本 / 测试 / 回执）。

判错的代价是不对称的：
  · 把生成物当人工 → 只是麻烦一次；
  · 把数据或模板当生成物 → 静默丢掉另一边的改动（比如把 docs/template.html
    判成生成物，就等于用局部模板覆盖掉别人的改动），而且提交还能通过大部分回执。

所以这里把边界钉死，docs/template.html 尤其要留在“人工”那一侧。

运行：python -m unittest discover tests
"""

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from sync import classify, is_generated  # noqa: E402


class GeneratedClassificationTest(unittest.TestCase):

    def test_built_pages_are_generated(self):
        for path in ("docs/index.html", "docs/2026-09-15.html",
                     "docs/weekly-2026-W38.html", "docs/feed.xml",
                     "docs/sitemap.xml", "docs/robots.txt"):
            with self.subTest(path=path):
                self.assertTrue(is_generated(path))

    def test_template_is_not_generated(self):
        # 它是生成器的输入：自动取我方版本会静默覆盖别人的改动
        self.assertFalse(is_generated("docs/template.html"))

    def test_data_and_source_are_not_generated(self):
        for path in ("docs/2026-09-15.md", "docs/index.md", "docs/README.md",
                     "scripts/generate_site.py", "scripts/sync.py",
                     "tests/test_sync.py", "claims.json", "README.md",
                     "docs/.nojekyll", ".github/workflows/daily.yml"):
            with self.subTest(path=path):
                self.assertFalse(is_generated(path))

    def test_classify_splits_conflicts(self):
        generated, manual = classify([
            "docs/index.html",
            "docs/2026-09-15.md",
            "docs/template.html",
            "docs/feed.xml",
        ])
        self.assertEqual(generated, ["docs/index.html", "docs/feed.xml"])
        self.assertEqual(manual, ["docs/2026-09-15.md", "docs/template.html"])

    def test_classify_keeps_order_within_each_side(self):
        generated, manual = classify(["docs/a.html", "x.md", "docs/b.html", "y.html"])
        self.assertEqual(generated, ["docs/a.html", "docs/b.html"])
        self.assertEqual(manual, ["x.md", "y.html"])


if __name__ == "__main__":
    unittest.main()
