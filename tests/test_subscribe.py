"""订阅入口测试(#7):站点订阅表单、RSS 按钮、subscribers.txt 读取层

运行:python -m unittest discover tests
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import storage

REPO_ROOT = Path(__file__).parent.parent
TEMPLATE = (REPO_ROOT / "docs" / "template.html").read_text(encoding="utf-8")


class GetSubscribersTest(unittest.TestCase):
    """storage.get_subscribers 读 data/subscribers.txt:
    跳过注释/空行/无 @ 的行,是邮件通道的收件人来源"""

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._orig = storage.DATA_DIR
        storage.DATA_DIR = Path(self._tmpdir.name)

    def tearDown(self):
        storage.DATA_DIR = self._orig
        self._tmpdir.cleanup()

    def test_missing_file_returns_empty(self):
        self.assertEqual(storage.get_subscribers(), [])

    def test_parses_emails_skipping_comments_and_blanks(self):
        (Path(self._tmpdir.name) / "subscribers.txt").write_text(
            "# AI Paper Daily subscribers\n"
            "\n"
            "alice@example.com\n"
            "not-an-email\n"
            "  bob@example.org  \n",
            encoding="utf-8")
        self.assertEqual(storage.get_subscribers(),
                         ["alice@example.com", "bob@example.org"])

    def test_seed_file_exists_and_is_all_comments(self):
        """仓库自带 data/subscribers.txt 种子文件,GAS 端点向它追加邮箱;
        种子内容只有注释,不产生真实收件人"""
        seed = REPO_ROOT / "data" / "subscribers.txt"
        self.assertTrue(seed.exists())
        self.assertEqual(storage.get_subscribers(), [])


class SubscribeFormTest(unittest.TestCase):
    """docs/template.html 携带订阅转化入口(#7 验收):
    邮箱表单 → GAS 端点,成功态,RSS 升级为醒目按钮"""

    def test_subscribe_form_present(self):
        self.assertIn('class="subscribe-form"', TEMPLATE)
        self.assertIn('type="email"', TEMPLATE)
        self.assertIn('handleSubscribe', TEMPLATE)

    def test_success_state_present(self):
        self.assertIn('subscribe-success', TEMPLATE)

    def test_gas_endpoint_configured(self):
        self.assertIn("script.google.com/macros/s/", TEMPLATE)

    def test_rss_is_visible_button(self):
        # RSS 从页脚纯文本链接升级为头部醒目按钮
        self.assertIn('class="rss-btn"', TEMPLATE)
        head = TEMPLATE.split('<!-- CONTENT_MARKER -->')[0]
        self.assertIn('feed.xml', head)

    def test_gas_handler_targets_this_repo(self):
        gs = (REPO_ROOT / "scripts" / "subscribe_handler.gs").read_text(
            encoding="utf-8")
        self.assertIn("alloevil/AI-Paper-Daily", gs)
        self.assertIn("data/subscribers.txt", gs)


if __name__ == "__main__":
    unittest.main()
