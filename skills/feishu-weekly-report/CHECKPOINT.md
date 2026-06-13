
## Checkpoint 机制（多步骤防重）

### 状态跟踪
每步执行前记录当前步骤到上下文：
```json
{
  "checkpoint": {
    "currentStep": "fetch_data",
    "completedSteps": ["confirm_intent", "calc_time"],
    "fetchErrors": [],
    "docId": null,
    "retryCount": 0
  }
}
```

### 步骤定义
| 步骤 | ID | 可重入 | 说明 |
|------|-----|--------|------|
| 确认意图 | confirm_intent | ✅ | 无副作用 |
| 计算时间 | calc_time | ✅ | 无副作用 |
| 拉取数据 | fetch_data | ✅ | 只读，可重跑 |
| 清洗归类 | classify | ✅ | 内存操作 |
| 生成草稿 | draft | ✅ | 内存操作 |
| 写入文档 | write_doc | ⚠️ | **需幂等检查** |

### 写入幂等保障
写入前检查目标是否已存在：
1. **新建文档**：检查同名文档是否已存在（`feishu_search_doc_wiki`）
   - 已存在 → 追加而非重复创建
   - 不存在 → 正常创建
2. **追加更新**：检查内容是否已追加（比较文档末尾）
   - 已包含 → 跳过写入，返回"已写入"
   - 未包含 → 正常追加

### 断点恢复
- 若执行中断，下次调用时检查 `checkpoint.completedSteps`
- 已完成的步骤跳过，从 `currentStep` 继续
- 写操作失败后，先检查是否已部分写入（文档已创建但内容不完整）
- 部分写入 → 补充剩余内容，不重复创建
