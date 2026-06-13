
## Checkpoint 机制（多步骤防重）

### 状态跟踪
```json
{
  "checkpoint": {
    "currentStep": "fetch_table",
    "completedSteps": [],
    "errors": [],
    "retryCount": 0
  }
}
```

### 步骤定义
| 步骤 | ID | 可重入 | 说明 |
|------|-----|--------|------|
| 获取项目表 | fetch_table | ✅ | 只读 |
| 获取文档 | fetch_doc | ✅ | 只读 |
| 获取讨论 | fetch_messages | ✅ | 只读 |
| 字段映射 | map_fields | ✅ | 内存操作 |
| 进度计算 | calc_progress | ✅ | 内存操作 |
| 风险识别 | identify_risks | ✅ | 内存操作 |
| 阻塞分析 | analyze_blockers | ✅ | 内存操作 |

### 断点恢复
- 本 skill 全部为只读操作，无写入风险
- 任何步骤失败后可直接重试
- 数据源获取失败 → 记录在 `errors`，继续处理其他数据源
- 最终输出中标注哪些数据源缺失
