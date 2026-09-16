"""主题 token 的不变式(浅色默认 + auto/light/dark 三态切换)

两个容易悄悄坏掉的地方:

1) 同一份模板里,「系统暗色」那块与「手动选暗色」那块必须逐字一致。
   它们是两份复制出来的 token,只改一处就会让"点按钮切暗色"和"系统切暗色"
   得到两种不同的暗色。
2) 首页(docs/template.html)与日报/周报(scripts/generate_site.py 的
   PAGE_TEMPLATE)是两份独立的 CSS 源。同名 token 必须同值,否则首页与
   内页会慢慢长成两套配色。

运行:python -m unittest discover tests
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent
TEMPLATE = (ROOT / "docs" / "template.html").read_text(encoding="utf-8")
GENERATOR = (ROOT / "scripts" / "generate_site.py").read_text(encoding="utf-8")
# Python 模板串里的 CSS 转义:{{ }} → { }
GENERATOR_CSS = GENERATOR.replace("{{", "{").replace("}}", "}")
# 生成产物:用户真正看到的东西
DAILY_PAGE = (ROOT / "docs" / "2026-09-14.html").read_text(encoding="utf-8")

MEDIA_DARK = (r'@media \(prefers-color-scheme: dark\) \{\s*'
              r':root:not\(\[data-theme="light"\]\) \{(?P<body>[^}]*)\}')
ATTR_DARK = r':root\[data-theme="dark"\] \{(?P<body>[^}]*)\}'
BASE_LIGHT = r':root \{(?P<body>[^}]*)\}'

SOURCES = (("template.html", TEMPLATE), ("generate_site.py", GENERATOR_CSS))


def _tokens(css: str, pattern: str) -> dict:
    """取出某个选择器块里的 --token: value 声明。"""
    match = re.search(pattern, css)
    assert match, f"找不到匹配 {pattern} 的规则块"
    return dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", match.group("body")))


class ThemeTokenTest(unittest.TestCase):

    def test_auto_dark_matches_manual_dark(self):
        # 系统暗色与手动暗色必须是同一套值
        for name, css in SOURCES:
            with self.subTest(source=name):
                media, manual = _tokens(css, MEDIA_DARK), _tokens(css, ATTR_DARK)
                self.assertGreaterEqual(len(media), 10, "暗色 token 抽取失败")
                self.assertEqual(media, manual)

    def test_system_dark_yields_to_explicit_light(self):
        # 系统暗色那块必须被 :not([data-theme="light"]) 挡着,否则手动选浅色无效
        for name, css in SOURCES:
            with self.subTest(source=name):
                self.assertIsNone(
                    re.search(r'@media \(prefers-color-scheme: dark\) \{\s*:root \{', css),
                    "系统暗色直接写在 :root 上,会盖掉手动选的浅色")

    def test_light_default_and_dark_differ_on_canvas(self):
        # 浅色不能是近黑:修掉 #010102 这类纯黑画布后不允许回潮
        for name, css in SOURCES:
            with self.subTest(source=name):
                light, dark = _tokens(css, BASE_LIGHT), _tokens(css, ATTR_DARK)
                self.assertEqual(light["--canvas"].strip(), "#ffffff")
                self.assertNotIn(dark["--canvas"].strip(), ("#000000", "#010102"))

    def test_shared_tokens_agree_between_templates(self):
        # 首页与日报页:同名 token 同值
        for pattern, label in ((BASE_LIGHT, "浅色"), (ATTR_DARK, "暗色")):
            index, daily = _tokens(TEMPLATE, pattern), _tokens(GENERATOR_CSS, pattern)
            shared = sorted(set(index) & set(daily))
            self.assertGreaterEqual(len(shared), 10, f"{label} token 抽取失败")
            for key in shared:
                self.assertEqual(index[key].strip(), daily[key].strip(),
                                 f"{label} {key} 在首页与日报模板里不一致")

    def test_three_state_switch_present_in_both_templates_and_output(self):
        # 三态切换必须同时存在于首页模板、日报模板与生成产物里
        for name, text in (("template.html", TEMPLATE),
                           ("generate_site.py", GENERATOR),
                           ("2026-09-14.html", DAILY_PAGE)):
            with self.subTest(artifact=name):
                self.assertIn('id="theme-toggle"', text)
                self.assertIn("cycleTheme()", text)
                self.assertIn("paperTheme", text)


if __name__ == "__main__":
    unittest.main()
