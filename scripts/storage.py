"""数据存储 - 订阅者列表等轻量文件数据

论文数据的事实数据源是提交入库的 docs/*.md(写侧 common.render_report,
读侧 reports.parse_papers)。原 SQLite 层(papers.db/push_log)已删除:
CI runner 一次性且 papers.db 从未提交,写入的数据从未被任何生产
路径读回(#6,Option A)。
"""

from pathlib import Path
from typing import List

DATA_DIR = Path(__file__).parent.parent / "data"


def get_subscribers() -> List[str]:
    """获取邮件订阅者列表"""
    sub_file = DATA_DIR / "subscribers.txt"
    if not sub_file.exists():
        return []
    return [
        line.strip() for line in sub_file.read_text().splitlines()
        if line.strip() and not line.startswith("#")
        and "@" in line
    ]
