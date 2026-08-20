"""LLM 筛选失败可见性测试:区分无 key 降级与调用失败告警

运行:python -m unittest discover tests
"""

import io
import sys
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import filter as filter_mod


def _papers(n=3):
    return [
        {"id": str(i), "title": f"paper {i}", "abstract": "a" * 50,
         "votes": i, "stars": 0, "has_code": False}
        for i in range(n)
    ]


class CallLLMTest(unittest.TestCase):
    """call_llm:无 key 返回空串;有 key 但请求失败抛 LLMError"""

    @mock.patch.dict("os.environ", {"LLM_API_KEY": ""})
    def test_no_key_returns_empty(self):
        self.assertEqual(filter_mod.call_llm("prompt"), "")

    @mock.patch.dict("os.environ", {"LLM_API_KEY": "sk-test"})
    @mock.patch("filter.urllib.request.urlopen", side_effect=OSError("connection refused"))
    def test_request_failure_raises(self, _urlopen):
        with self.assertRaises(filter_mod.LLMError):
            filter_mod.call_llm("prompt")


class FilterFailureVisibilityTest(unittest.TestCase):
    """filter_papers:失败路径必须产生 stderr 输出 + 飞书告警,并返回 mode='error'"""

    @mock.patch("filter.send_feishu_alert")
    @mock.patch("filter.call_llm", side_effect=filter_mod.LLMError("HTTP 500"))
    def test_llm_error_alerts_and_falls_back(self, _llm, alert):
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            selected, mode = filter_mod.filter_papers(_papers(), ["LLM"], max_papers=2)

        self.assertEqual(mode, "error")
        self.assertEqual(len(selected), 2)  # 热度回退仍出结果
        self.assertIn("FAILED", stderr.getvalue())
        alert.assert_called_once()
        self.assertIn("LLM 筛选失败", alert.call_args[0][0])

    @mock.patch("filter.send_feishu_alert")
    @mock.patch("filter.call_llm", return_value="not json at all")
    def test_parse_failure_alerts(self, _llm, alert):
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            selected, mode = filter_mod.filter_papers(_papers(), ["LLM"], max_papers=2)

        self.assertEqual(mode, "error")
        self.assertEqual(len(selected), 2)
        alert.assert_called_once()

    @mock.patch("filter.send_feishu_alert")
    @mock.patch("filter.call_llm", return_value="")
    def test_no_key_degrades_without_alert(self, _llm, alert):
        selected, mode = filter_mod.filter_papers(_papers(), ["LLM"], max_papers=2)

        self.assertEqual(mode, "no-key")
        self.assertEqual(len(selected), 2)
        alert.assert_not_called()

    @mock.patch("filter.send_feishu_alert")
    @mock.patch("filter.call_llm",
                return_value='[{"index": 1, "reason": "值得读"}]')
    def test_success_returns_ai_mode(self, _llm, alert):
        selected, mode = filter_mod.filter_papers(_papers(), ["LLM"], max_papers=2)

        self.assertEqual(mode, "ai")
        self.assertEqual([p["id"] for p in selected], ["1"])
        alert.assert_not_called()


class ReportFooterTest(unittest.TestCase):
    """generate_report footer 标注本期筛选方式"""

    def test_footer_marks_filter_mode(self):
        import tempfile
        import main as main_mod

        papers = [{"title": "t", "reason": "r", "abstract": "a",
                   "url": "https://arxiv.org/abs/2608.00001"}]
        for mode, label in [("ai", "AI 语义筛选"),
                            ("no-key", "热度回退（未配置 LLM）"),
                            ("error", "热度回退（AI 筛选失败）")]:
            with tempfile.TemporaryDirectory() as tmp:
                docs = Path(tmp) / "docs"
                with mock.patch.object(main_mod, "__file__",
                                       str(Path(tmp) / "scripts" / "main.py")):
                    main_mod.generate_report(papers, "2026-08-20", mode)
                content = (docs / "2026-08-20.md").read_text(encoding="utf-8")
                self.assertIn(f"本期筛选方式：{label}", content)


if __name__ == "__main__":
    unittest.main()
