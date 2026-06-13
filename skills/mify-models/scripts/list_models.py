#!/usr/bin/env python3
"""获取 Mify 最新可用模型列表"""
import json, urllib.request, sys, os

API_KEY = os.environ.get("LLM_API_KEY", "mit-VpJcWMSLf6VGBWlFSQgJfJ3YShbd6rq1XmiFCk660LSCVeVu")
BASE_URL = "http://model.mify.ai.srv/v1/models"

def fetch_models():
    req = urllib.request.Request(
        BASE_URL,
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    resp = urllib.request.urlopen(req, timeout=30)
    data = json.loads(resp.read())
    return sorted(data.get("data", []), key=lambda x: x.get("id", ""))

def group_by_owner(models):
    groups = {}
    for m in models:
        owner = m.get("owned_by", "unknown")
        groups.setdefault(owner, []).append(m["id"])
    return groups

if __name__ == "__main__":
    models = fetch_models()
    
    if "--json" in sys.argv:
        print(json.dumps(models, indent=2, ensure_ascii=False))
    elif "--group" in sys.argv:
        groups = group_by_owner(models)
        for owner, ids in sorted(groups.items()):
            print(f"\n## {owner} ({len(ids)})")
            for mid in ids:
                print(f"  {mid}")
    else:
        print(f"共 {len(models)} 个模型：\n")
        for m in models:
            print(f"  {m['id']}  ({m.get('owned_by', 'N/A')})")
