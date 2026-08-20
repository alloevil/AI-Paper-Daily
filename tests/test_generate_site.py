"""站点生成解析测试:日报 md 是事实数据源,标题不得携带展示性标签

运行:python -m unittest discover tests
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from generate_site import parse_papers

SAMPLE_MD = """# 📄 论文日报 | 2026-08-20（周四）

## 1. One Gate Is Not Enough: Verified Routing 📦代码

_高票/有代码_

> Some abstract text here.

[📄 论文](https://arxiv.org/abs/2608.11111) | [📥 PDF](https://arxiv.org/pdf/2608.11111) | [💻 代码](https://github.com/x/y)

## 2. Plain Title Without Tag

_最新论文_

> Another abstract.

[📄 论文](https://arxiv.org/abs/2608.22222)

## 3. Double Tagged Title 📦代码 📦代码

_高票/有代码_

> Weekly regenerated entry.

[📄 论文](https://arxiv.org/abs/2608.33333)
"""


class ParsePapersTitleTest(unittest.TestCase):
    """parse_papers 剥离标题尾部『 📦代码』标签,防止回流污染站点/RSS/周报"""

    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile(
            "w", suffix=".md", encoding="utf-8", delete=False)
        self._tmp.write(SAMPLE_MD)
        self._tmp.close()
        self.papers = parse_papers(self._tmp.name)

    def tearDown(self):
        Path(self._tmp.name).unlink(missing_ok=True)

    def test_strips_code_tag_suffix(self):
        self.assertEqual(self.papers[0]["title"],
                         "One Gate Is Not Enough: Verified Routing")

    def test_plain_title_untouched(self):
        self.assertEqual(self.papers[1]["title"], "Plain Title Without Tag")

    def test_strips_repeated_tags(self):
        self.assertEqual(self.papers[2]["title"], "Double Tagged Title")

    def test_links_survive_parsing(self):
        links = self.papers[0]["links"]
        self.assertEqual(links["paper"], "https://arxiv.org/abs/2608.11111")
        self.assertEqual(links["code"], "https://github.com/x/y")


if __name__ == "__main__":
    unittest.main()
