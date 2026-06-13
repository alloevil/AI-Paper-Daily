#!/usr/bin/env python3
"""
Primary 模型并发上限测试
逐步加压（5→10→20→30→50→80→100），找到并发上限。
"""
import json
import os
import time
import urllib.request
import urllib.error
import concurrent.futures

CONFIG_PATH = os.path.expanduser("~/.openclaw/openclaw.json")
TIMEOUT = 30
CONCURRENCY_LEVELS = [100, 150, 200, 300, 500]
SUCCESS_THRESHOLD = 0.8  # 成功率低于 80% 视为达到上限

def load_config():
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    primary = cfg["agents"]["defaults"]["model"]["primary"]
    provider = cfg["models"]["providers"]["openai"]
    return {
        "base_url": provider["baseUrl"].rstrip("/"),
        "api_key": provider["apiKey"],
        "model": primary.split("/", 1)[1] if "/" in primary else primary,
    }

def single_request(cfg, idx):
    payload = json.dumps({
        "model": cfg["model"],
        "messages": [{"role": "user", "content": f"Say hello in one word. #{idx}"}],
        "max_tokens": 10,
    }).encode()
    start = time.time()
    try:
        req = urllib.request.Request(
            f"{cfg['base_url']}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {cfg['api_key']}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            latency = int((time.time() - start) * 1000)
            return (idx, True, latency, resp.status)
    except urllib.error.HTTPError as e:
        latency = int((time.time() - start) * 1000)
        return (idx, False, latency, e.code)
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return (idx, False, latency, str(e))

def run_test(cfg, concurrency):
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(single_request, cfg, i) for i in range(concurrency)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    success = sum(1 for r in results if r[1])
    latencies = [r[2] for r in results if r[1]]
    avg_latency = sum(latencies) // len(latencies) if latencies else 0
    max_latency = max(latencies) if latencies else 0
    p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if len(latencies) >= 2 else max_latency

    return {
        "concurrency": concurrency,
        "success": success,
        "total": concurrency,
        "rate": f"{success}/{concurrency}",
        "pct": f"{success*100//concurrency}%",
        "avg_ms": avg_latency,
        "max_ms": max_latency,
        "p95_ms": p95_latency,
    }

def main():
    cfg = load_config()
    print(f"模型: {cfg['model']}")
    print(f"端点: {cfg['base_url']}")
    print(f"加压梯度: {CONCURRENCY_LEVELS}")
    print(f"{'='*60}")

    limit_found = False
    for level in CONCURRENCY_LEVELS:
        r = run_test(cfg, level)
        status = "✅" if r["success"] == r["total"] else "⚠️" if r["success"] / r["total"] >= SUCCESS_THRESHOLD else "❌"

        print(f"{status} 并发 {r['concurrency']:>3}: {r['rate']} ({r['pct']}) | avg {r['avg_ms']}ms | p95 {r['p95_ms']}ms | max {r['max_ms']}ms")

        if r["success"] / r["total"] < SUCCESS_THRESHOLD and not limit_found:
            print(f"\n🔴 并发上限在 {level - CONCURRENCY_LEVELS[CONCURRENCY_LEVELS.index(level) - 1]} ~ {level} 之间")
            limit_found = True

        # 每轮之间休息 2 秒，避免累积
        time.sleep(2)

    if not limit_found:
        print(f"\n🟢 所有级别全部通过，并发上限 ≥ {CONCURRENCY_LEVELS[-1]}")

if __name__ == "__main__":
    main()
