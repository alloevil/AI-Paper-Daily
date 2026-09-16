#!/usr/bin/env python3
"""同步 + 校验 + 推送：把每天的 cron 日报提交先本地化。

这个仓库每天都有一次自动提交（日报流水线），它提交的文件和设计改动改的是同一批：

  自动提交   docs/2026-09-15.md（数据）
             + docs/2026-09-15.html、docs/index.html、docs/2026-09-14.html、
               docs/feed.xml、docs/sitemap.xml（重新生成的页面）
  设计改动   改 docs/template.html / scripts/generate_site.py 后，重新生成**全部**页面

所以推送前几乎总会撞车，而且解法是固定的 —— 但**只对生成物成立**：

  · 生成物（docs/*.html 除 template.html 外、feed.xml、sitemap.xml、robots.txt）：
    取我方版本，然后重跑 scripts/generate_site.py。**重新生成的结果才同时包含**
    “远端的新一天”和“新的模板”，手工合并生成物一定会错。
  · 数据与源码（docs/*.md、docs/index.md、docs/template.html、scripts/**、tests/**、
    claims.json）：必须人工处理，脚本停下来不动它们。

用法：
    python3 scripts/sync.py                    # 同步 → 校验 → 推送
    python3 scripts/sync.py --no-push          # 只同步 + 校验，不推
    python3 scripts/sync.py --remote upstream  # 换远端名（默认 origin）
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

# 生成物：可以自动“取我方 + 重生成”，因为生成器能重建它们
GENERATED_EXACT = {"docs/feed.xml", "docs/sitemap.xml", "docs/robots.txt"}


def is_generated(path: str) -> bool:
    """这个路径是不是生成物？

    是生成物 → 冲突可以自动解决（取我方版本，再重跑生成器）。
    不是（数据 / 模板 / 脚本 / 测试 / 回执）→ 必须人工合并。
    docs/template.html 是生成器的**输入**，不是生成物。
    """
    if path in GENERATED_EXACT:
        return True
    return (path.startswith("docs/") and path.endswith(".html")
            and path != "docs/template.html")


def classify(paths: list[str]) -> tuple[list[str], list[str]]:
    """把冲突文件分成（可自动解决的生成物，必须人工处理的其它）。"""
    generated = [p for p in paths if is_generated(p)]
    manual = [p for p in paths if not is_generated(p)]
    return generated, manual


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, text=True, capture_output=True, **kwargs)


def git(*args: str) -> str:
    return run(["git", *args]).stdout.strip()


def die(message: str) -> None:
    print(f"\n[sync] {message}", file=sys.stderr)
    raise SystemExit(1)


def regenerate() -> None:
    """重跑生成器：让页面同时反映远端的数据与本地的模板。"""
    result = run([sys.executable, "scripts/generate_site.py"])
    if result.returncode != 0:
        die("scripts/generate_site.py 失败：\n" + result.stdout + result.stderr)


def verify(upstream: str) -> None:
    """推送前必须过的两关：生成器幂等 + 单元测试。

    重新生成后若工作区变脏，说明这个提交里的页面不是当前模板的输出 —— 典型情况是
    rebase 时远端当天新增的那一页（由旧模板生成）被自动合并进来。把它并进当前提交，
    而不是中止；只有当那个提交已经在远端时才要求新建提交（否则会改写已推送的历史）。
    """
    regenerate()
    dirty = git("status", "--porcelain")
    if dirty:
        print("[sync] 重新生成后有变化，并入当前提交：")
        for line in dirty.splitlines():
            print("        " + line)
        if run(["git", "merge-base", "--is-ancestor", "HEAD", upstream]).returncode == 0:
            die("当前提交已经在远端，请新建一个提交把这些变化带上：\n" + dirty)
        run(["git", "add", "-A"])
        env = {**os.environ, "GIT_EDITOR": "true"}
        if run(["git", "commit", "--amend", "--no-edit"], env=env).returncode != 0:
            die("git commit --amend 失败，请手工查看：\n" + git("status"))
        regenerate()
        still = git("status", "--porcelain")
        if still:
            die("并入后工作区仍不干净，请手工查看：\n" + still)

    result = run([sys.executable, "-m", "unittest", "discover", "tests", "-q"])
    if result.returncode != 0:
        die("单元测试失败，未推送：\n" + result.stdout + result.stderr)
    print("[sync] 生成器幂等 ✅  单元测试 ✅")


def resolve_generated_conflicts(generated: list[str]) -> None:
    """rebase 中 --theirs 指“正在重放的那个提交”，也就是我方版本。"""
    for path in generated:
        result = run(["git", "checkout", "--theirs", "--", path])
        if result.returncode != 0:
            die(f"取我方版本失败：{path}\n{result.stderr}")
    print(f"[sync] {len(generated)} 个生成物取我方版本，接下来重生成：")
    for path in generated:
        print(f"        {path}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="把 cron 的日报提交先本地化，再校验推送")
    parser.add_argument("--remote", default="origin", help="远端名（默认 origin）")
    parser.add_argument("--no-push", action="store_true", help="只同步与校验，不推送")
    args = parser.parse_args(argv)

    if git("status", "--porcelain"):
        die("工作区有未提交的改动，先 commit 或 stash，再来同步。")
    if git("status", "--porcelain", "--untracked-files=no"):
        die("有已跟踪文件尚未提交，先 commit 再来同步。")

    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    if branch in ("", "HEAD"):
        die("当前不在分支上（detached HEAD），先切回 main。")
    upstream = f"{args.remote}/{branch}"

    print(f"[sync] fetch {args.remote} …")
    if run(["git", "fetch", args.remote]).returncode != 0:
        die(f"git fetch {args.remote} 失败")

    behind = int(git("rev-list", "--count", f"HEAD..{upstream}") or 0)
    ahead = int(git("rev-list", "--count", f"{upstream}..HEAD") or 0)
    if behind == 0:
        print(f"[sync] 不需要 rebase（本地领先 {ahead} 个提交，{upstream} 没有新提交）")
    else:
        print(f"[sync] {upstream} 领先 {behind} 个提交，rebase …")
        if run(["git", "rebase", upstream]).returncode == 0:
            print("[sync] rebase 完成（没有冲突；远端若新增了页面，下一步的重生成会补上）")
        else:
            conflicted = git("diff", "--name-only", "--diff-filter=U").split()
            if not conflicted:
                die("rebase 失败但没有文件冲突，请手工查看：\n" + git("status"))
            generated, manual = classify(conflicted)
            if manual:
                die("以下冲突文件是数据或源码，必须人工合并（rebase 仍停在这里）：\n"
                    + "\n".join(f"        {p}" for p in manual)
                    + "\n\n处理完执行：git add <文件> && git rebase --continue"
                    + "\n放弃这次同步：git rebase --abort")
            resolve_generated_conflicts(generated)
            regenerate()
            run(["git", "add", "-A"])
            env = {**os.environ, "GIT_EDITOR": "true"}
            if run(["git", "rebase", "--continue"], env=env).returncode != 0:
                die("git rebase --continue 失败，请手工查看：\n" + git("status"))
            print("[sync] rebase 完成（冲突按“取我方 + 重生成”解决）")

    verify(upstream)

    if args.no_push:
        print(f"[sync] 完成（--no-push）：本地 {branch} 已就绪，推送用 git push {args.remote} {branch}")
        return 0

    print(f"[sync] push {args.remote} {branch} …")
    push = run(["git", "push", args.remote, branch])
    if push.returncode != 0:
        die("推送失败：\n" + push.stdout + push.stderr)
    print("[sync] 推送完成 ✅")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
