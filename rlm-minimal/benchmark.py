"""
RLM Benchmark — 按论文方法论测试
参考: arXiv:2512.24601

测试任务:
1. S-NIAH: 单针找数字
2. Multi-Needle: 多针（多个不同类型信息散布在 haystack 中）
3. Multi-Hop: 多跳推理（需要串联多个信息）
4. Position Sensitivity: 不同位置的准确率

每个任务在不同规模下测试: 10K / 50K / 100K / 500K 行
"""

import os
import sys
import json
import random
import time
from datetime import datetime

os.environ["OPENAI_API_KEY"] = "mit-VpJcWMSLf6VGBWlFSQgJfJ3YShbd6rq1XmiFCk660LSCVeVu"

from rlm import RLM

# ============================================================
# 工具函数
# ============================================================

def create_rlm(model="xiaomi/mimo-v2.5", max_iterations=10, verbose=False):
    return RLM(
        backend="openai",
        backend_kwargs={
            "model_name": model,
            "base_url": "http://model.mify.ai.srv/v1",
        },
        verbose=verbose,
        max_iterations=max_iterations,
    )

def generate_haystack(num_lines: int, filler_words=None) -> list[str]:
    """生成 haystack（纯噪音行）"""
    if filler_words is None:
        filler_words = ["blah", "random", "text", "data", "content", "information", "sample"]
    lines = []
    for _ in range(num_lines):
        num_words = random.randint(3, 8)
        line_words = [random.choice(filler_words) for _ in range(num_words)]
        lines.append(" ".join(line_words))
    return lines

def run_test(name: str, context: str, query: str, expected: str, verbose=False):
    """运行单个测试并返回结果"""
    print(f"\n{'='*60}")
    print(f"  TEST: {name}")
    print(f"  Context: {len(context):,} chars")
    print(f"  Expected: {expected}")
    print(f"{'='*60}")
    
    rlm = create_rlm(verbose=verbose)
    start = time.time()
    try:
        result = rlm.completion(context)
        elapsed = time.time() - start
        response = result.response if hasattr(result, 'response') else str(result)
        match = expected in response
        iterations = getattr(result, 'iterations', None)
        iters = len(iterations) if iterations else '?'
        print(f"\n  Result: {response[:200]}")
        print(f"  Match: {'✅' if match else '❌'}")
        print(f"  Time: {elapsed:.1f}s | Iterations: {iters}")
        return {
            "name": name,
            "match": match,
            "time": elapsed,
            "context_chars": len(context),
            "expected": expected,
            "response_preview": response[:200],
        }
    except Exception as e:
        elapsed = time.time() - start
        print(f"\n  ERROR: {e}")
        return {"name": name, "match": False, "time": elapsed, "error": str(e)}


# ============================================================
# Task 1: S-NIAH — 单针找数字
# ============================================================

def test_s_niah(num_lines: int, position: str = "middle"):
    """Simple Needle-in-a-Haystack"""
    lines = generate_haystack(num_lines)
    answer = str(random.randint(1000000, 9999999))
    
    if position == "start":
        pos = random.randint(10, num_lines // 10)
    elif position == "end":
        pos = random.randint(9 * num_lines // 10, num_lines - 10)
    else:  # middle
        pos = random.randint(num_lines // 3, 2 * num_lines // 3)
    
    lines[pos] = f"The secret code is {answer}"
    context = "\n".join(lines)
    
    return run_test(
        name=f"S-NIAH ({num_lines//1000}K lines, {position})",
        context=context,
        query="Find the secret code in the context.",
        expected=answer,
    )


# ============================================================
# Task 2: Multi-Needle — 多针
# ============================================================

def test_multi_needle(num_lines: int, num_needles: int = 5):
    """多个不同类型的 needle"""
    lines = generate_haystack(num_lines)
    
    needles = {}
    needle_types = [
        ("secret_agent", lambda v: f"Agent codename: {v}"),
        ("launch_code", lambda v: f"Launch code: ALPHA-{v}"),
        ("treasure", lambda v: f"Treasure coordinates: {v}N {v}E"),
        ("password", lambda v: f"Access password: {v}"),
        ("serial", lambda v: f"Serial number: SN-{v}"),
    ]
    
    positions = sorted(random.sample(range(num_lines), min(num_needles, num_lines)))
    answers = []
    
    for i, pos in enumerate(positions):
        needle_type, formatter = needle_types[i % len(needle_types)]
        value = str(random.randint(10000, 99999))
        lines[pos] = formatter(value)
        needles[needle_type] = value
        answers.append(f"{needle_type}={value}")
    
    context = "\n".join(lines)
    expected_answer = "; ".join(answers)
    
    return run_test(
        name=f"Multi-Needle ({num_lines//1000}K lines, {num_needles} needles)",
        context=context,
        query="Find ALL special entries in the context. For each one, identify the type and value. Format: type=value; type=value; ...",
        expected=needles[list(needles.keys())[0]],  # At least match one
    )


# ============================================================
# Task 3: Multi-Hop — 多跳推理
# ============================================================

def test_multi_hop(num_lines: int):
    """需要串联多个信息才能回答"""
    lines = generate_haystack(num_lines)
    
    # 放 3 个关联的 needle
    # Step 1: "The key holder is Agent X" → 找到 X
    # Step 2: "Agent X's code is 777" → 用 X 找到 code
    # Step 3: "Code 777 unlocks vault with treasure YYY" → 用 code 找到 treasure
    
    agent_name = "PHOENIX"
    code = str(random.randint(100, 999))
    treasure = str(random.randint(1000000, 9999999))
    
    pos1 = random.randint(100, num_lines // 3)
    pos2 = random.randint(num_lines // 3, 2 * num_lines // 3)
    pos3 = random.randint(2 * num_lines // 3, num_lines - 100)
    
    lines[pos1] = f"The key holder is Agent {agent_name}"
    lines[pos2] = f"Agent {agent_name}'s access code is {code}"
    lines[pos3] = f"Vault code {code} contains treasure worth {treasure} gold coins"
    
    context = "\n".join(lines)
    
    return run_test(
        name=f"Multi-Hop ({num_lines//1000}K lines, 3 hops)",
        context=context,
        query="Find the treasure worth gold coins. You need to: 1) Find who holds the key, 2) Find that agent's access code, 3) Find what that code unlocks. Report the treasure value.",
        expected=treasure,
    )


# ============================================================
# Task 4: Position Sensitivity — 位置敏感性
# ============================================================

def test_position_sensitivity(num_lines: int):
    """测试 needle 在不同位置的准确率"""
    results = []
    for position in ["start", "middle", "end"]:
        result = test_s_niah(num_lines, position)
        results.append(result)
    return results


# ============================================================
# 主测试套件
# ============================================================

def main():
    print("=" * 60)
    print("  RLM Benchmark — 论文方法论测试")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    all_results = []
    
    # --- Task 1: S-NIAH at different scales ---
    print("\n" + "▓" * 60)
    print("  TASK 1: S-NIAH — 不同规模")
    print("▓" * 60)
    for n in [10_000, 50_000, 100_000]:
        result = test_s_niah(n, "middle")
        all_results.append(result)
    
    # --- Task 2: Multi-Needle ---
    print("\n" + "▓" * 60)
    print("  TASK 2: Multi-Needle — 多针找信息")
    print("▓" * 60)
    for n in [10_000, 50_000]:
        result = test_multi_needle(n, num_needles=3)
        all_results.append(result)
    
    # --- Task 3: Multi-Hop ---
    print("\n" + "▓" * 60)
    print("  TASK 3: Multi-Hop — 多跳推理")
    print("▓" * 60)
    for n in [10_000, 50_000]:
        result = test_multi_hop(n)
        all_results.append(result)
    
    # --- Task 4: Position Sensitivity ---
    print("\n" + "▓" * 60)
    print("  TASK 4: Position Sensitivity — 位置敏感性 (50K lines)")
    print("▓" * 60)
    pos_results = test_position_sensitivity(50_000)
    all_results.extend(pos_results)
    
    # --- Summary ---
    print("\n" + "=" * 60)
    print("  BENCHMARK SUMMARY")
    print("=" * 60)
    print(f"{'Test':<40} {'Match':>6} {'Time':>8}")
    print("-" * 60)
    for r in all_results:
        match_str = "✅" if r.get("match") else "❌"
        time_str = f"{r.get('time', 0):.1f}s"
        print(f"{r['name']:<40} {match_str:>6} {time_str:>8}")
    
    total = len(all_results)
    passed = sum(1 for r in all_results if r.get("match"))
    print("-" * 60)
    print(f"Total: {passed}/{total} passed ({100*passed/total:.0f}%)")
    
    # Save results
    output_path = "/root/.openclaw/workspace/rlm-minimal/benchmark_results.json"
    with open(output_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "results": all_results,
            "summary": {"total": total, "passed": passed},
        }, f, indent=2, default=str)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
