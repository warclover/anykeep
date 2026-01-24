# 智能分类 API 参考

**版本**: v2.0
**更新日期**: 2026-01-24

---

## 一、统一分类 API

### POST /api/classification/v2/classify

单条书签分类。

**请求体**:

```typescript
interface ClassifyRequest {
  bookmarkId: string; // 书签 ID
  title: string; // 标题
  summary?: string; // 摘要（可选）
  tags?: string[]; // 标签（可选）
  url?: string; // URL（可选）
  defaultFolderId?: string; // 默认文件夹（可选）
}
```

**响应**:

```typescript
interface ClassifyResponse {
  success: boolean;
  data: {
    folderId: string; // 推荐文件夹 ID
    folderName?: string; // 文件夹名称
    confidence: number; // 置信度 (0-1)
    action: "auto" | "suggest"; // 执行动作
    usedT1: boolean; // 是否使用了 T1 纠正
    reasoning?: string; // T1 推理过程
    latencyMs: number; // 总延迟
  };
}
```

**示例**:

```bash
curl -X POST /api/classification/v2/classify \
  -H "Content-Type: application/json" \
  -d '{
    "bookmarkId": "123",
    "title": "React 18 新特性详解",
    "tags": ["react", "前端"]
  }'
```

---

### POST /api/classification/v2/batch

批量分类。

**请求体**:

```typescript
interface BatchClassifyRequest {
  items: ClassifyRequest[];
  options?: {
    parallel?: boolean; // 并行处理（默认 true）
    maxConcurrency?: number; // 最大并发数（默认 5）
  };
}
```

**响应**:

```typescript
interface BatchClassifyResponse {
  success: boolean;
  data: {
    results: (ClassifyResponse["data"] | { error: string })[];
    stats: {
      total: number;
      success: number;
      failed: number;
      avgLatencyMs: number;
    };
  };
}
```

---

## 二、反馈 API

### POST /api/classification/v2/feedback

提交分类反馈（用于系统学习）。

**请求体**:

```typescript
interface FeedbackRequest {
  bookmarkId: string;
  feedbackType: "correct" | "incorrect" | "moved";
  originalFolderId?: string;
  correctedFolderId?: string;
  comment?: string;
}
```

**响应**:

```typescript
interface FeedbackResponse {
  success: boolean;
  message: string;
}
```

---

## 三、规则管理 API

### GET /api/classification/v2/rules

获取用户规则列表。

**响应**:

```typescript
interface RulesListResponse {
  success: boolean;
  data: {
    rules: UserClassificationRule[];
    total: number;
  };
}

interface UserClassificationRule {
  id: number;
  type: "domain" | "tag" | "keyword" | "regex";
  pattern_type: "exact" | "contains" | "regex";
  pattern: string;
  target_folder_id: number;
  priority: number;
  is_active: boolean;
  match_count: number;
  created_at: string;
}
```

### POST /api/classification/v2/rules

创建规则。

### PUT /api/classification/v2/rules/:id

更新���则。

### DELETE /api/classification/v2/rules/:id

删除规则。

### POST /api/classification/v2/rules/test

测试规则匹配。

---

## 四、建议管理 API

### GET /api/classification/v2/suggestions

获取待确认的分类建议。

### POST /api/classification/v2/suggestions/:id/accept

接受建议。

### POST /api/classification/v2/suggestions/:id/reject

拒绝建议。

---

## 五、指标查询 API

### GET /api/classification/v2/metrics

获取分类指标统计。

**查询参数**:

| 参数    | 类型   | 说明                          |
| ------- | ------ | ----------------------------- |
| period  | string | 时间范围：`7d`, `30d`, `90d`  |
| groupBy | string | 分组：`day`, `week`, `folder` |

**响应**:

```typescript
interface MetricsResponse {
  success: boolean;
  data: {
    successRate: number; // 分类成功率
    avgConfidence: number; // 平均置信度
    t1TriggerRate: number; // T1 触发率
    avgLatencyMs: number; // 平均延迟
    correctionRate: number; // 用户纠正率
    byFolder: FolderMetrics[]; // 按文件夹统计
  };
}
```

---

## 六、内部 API

### GET /api/classification/internal/debug

调试接口（仅开发环境）。

### POST /api/classification/internal/cron

定时任务触发（需要 API Key）。

---

## 七、错误码

| 状��码 | 错误码              | 说明           |
| ------ | ------------------- | -------------- |
| 400    | INVALID_REQUEST     | 请求参数无效   |
| 401    | UNAUTHORIZED        | 未授权         |
| 404    | NOT_FOUND           | 资源不存在     |
| 429    | RATE_LIMITED        | 请求过于频繁   |
| 500    | INTERNAL_ERROR      | 服务器内部错误 |
| 503    | SERVICE_UNAVAILABLE | 服务暂不可用   |

---

## 八、废弃端点

以下端点已废弃，将在 2026-04-01 后移除：

| 废弃端点                          | 替代端点                          |
| --------------------------------- | --------------------------------- |
| `/api/classification/classify`    | `/api/classification/v2/classify` |
| `/api/classification/v5/classify` | `/api/classification/v2/classify` |
| `/api/classification/v5/feedback` | `/api/classification/v2/feedback` |
| `/api/classification/feedback`    | `/api/classification/v2/feedback` |
