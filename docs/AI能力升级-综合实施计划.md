# AnyKeep AI 能力升级 - 综合实施计划

> **版本**: 1.0.0
> **日期**: 2025-12-24
> **总工期**: 5 周
> **策略**: 并行开发 + 分层交付

---

## 1. 实施总览

### 1.1 甘特图

```
Week 1          Week 2          Week 3          Week 4          Week 5
├───────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│               │               │               │               │               │
│ ████████████████████          │               │               │               │
│ 架构基础设施 (L1)             │               │               │               │
│               │               │               │               │               │
│     ░░░░░░░░░░████████████████████████████████               │               │
│     准备阶段    编排 Skills 开发 (L2)                         │               │
│               │               │               │               │               │
│         ░░░░░░████████████████████████████████████████████████               │
│         准备    前端适配 (L3)                                                 │
│               │               │               │               │               │
│               │               │               │       ████████████████████████│
│               │               │               │       集成测试 & 优化          │
│               │               │               │               │               │
├───────────────┼───────────────┼───────────────┼───────────────┼───────────────┤

█ = 主要开发    ░ = 准备/设计
```

### 1.2 里程碑

| 里程碑 | 日期      | 交付物                 | 验收标准                      |
| ------ | --------- | ---------------------- | ----------------------------- |
| **M1** | Week 1 末 | 路由层 MVP             | 能正确识别简单/复杂任务       |
| **M2** | Week 2 末 | 首个编排 Skill         | knowledge_review 可端到端运行 |
| **M3** | Week 3 末 | 3 个 Skills + 前端基础 | 进度条、交付物展示可用        |
| **M4** | Week 4 末 | 全部 9 个 Skills       | 所有 Skills 功能完整          |
| **M5** | Week 5 末 | 正式发布               | 测试通过、文档完善            |

---

## 2. Layer 1: 架构基础设施

### 2.1 任务清单

| 任务 ID | 任务名称                         | 预估 | 依赖        | 负责 |
| ------- | -------------------------------- | ---- | ----------- | ---- |
| L1.1    | IntentClassifier 意图分类器      | 4h   | -           | 后端 |
| L1.2    | ComplexityEvaluator 复杂度评估器 | 3h   | -           | 后端 |
| L1.3    | ModeSelector 模式选择器          | 2h   | L1.1, L1.2  | 后端 |
| L1.4    | IntentRouter 集成                | 2h   | L1.3        | 后端 |
| L1.5    | OrchestrationSkill 基类          | 6h   | -           | 后端 |
| L1.6    | ProgressReporter 进度报告        | 2h   | L1.5        | 后端 |
| L1.7    | DeliverableGenerator 交付物生成  | 4h   | L1.5        | 后端 |
| L1.8    | UnifiedOutputAdapter 输出适配    | 3h   | L1.5        | 后端 |
| L1.9    | UnifiedEngine 统一引擎           | 4h   | L1.4, L1.8  | 后端 |
| L1.10   | OrchestrationEngine 编排引擎     | 3h   | L1.5        | 后端 |
| L1.11   | API 路由集成                     | 2h   | L1.9, L1.10 | 后端 |
| L1.12   | 单元测试                         | 4h   | All         | 后端 |

**小计**: 39h (约 1 周)

### 2.2 文件创建清单

```
src/lib/ai-skills/
├── router/
│   ├── intent-classifier.ts      # L1.1
│   ├── complexity-evaluator.ts   # L1.2
│   ├── mode-selector.ts          # L1.3
│   ├── intent-router.ts          # L1.4
│   ├── types.ts
│   └── index.ts
├── orchestration/
│   ├── orchestration-skill.ts    # L1.5
│   ├── progress-reporter.ts      # L1.6
│   ├── deliverable-generator.ts  # L1.7
│   ├── confirmation-handler.ts
│   ├── types.ts
│   └── index.ts
├── engine/
│   ├── unified-engine.ts         # L1.9
│   ├── orchestration-engine.ts   # L1.10
│   ├── types.ts
│   └── index.ts
├── output/
│   ├── types.ts
│   ├── adapter.ts                # L1.8
│   └── index.ts
└── __tests__/
    ├── intent-router.test.ts     # L1.12
    ├── orchestration-skill.test.ts
    └── unified-engine.test.ts
```

### 2.3 验收标准

```typescript
// 验收测试用例

// 1. 意图路由正确
test("简单查询路由到原子模式", async () => {
  const result = await router.route({ message: "有多少收藏" });
  expect(result.mode).toBe("atomic");
});

test("复杂任务路由到编排模式", async () => {
  const result = await router.route({ message: "帮我整理收藏" });
  expect(result.mode).toBe("orchestration");
  expect(result.suggestedSkill).toBe("smart_organize");
});

// 2. 编排 Skill 基类可用
test("OrchestrationSkill 支持进度报告", async () => {
  const chunks = [];
  for await (const chunk of skill.executeStream(context)) {
    chunks.push(chunk);
  }
  expect(chunks.some((c) => c.type === "progress")).toBe(true);
});

// 3. 统一引擎正常工作
test("UnifiedEngine 自动路由", async () => {
  const chunks = [];
  for await (const chunk of engine.execute("有多少收藏", context)) {
    chunks.push(chunk);
  }
  expect(chunks[0].type).toBe("routing");
  expect(chunks[0].data.mode).toBe("atomic");
});
```

---

## 3. Layer 2: 编排 Skills 开发

### 3.1 Skills 开发顺序

```
Week 2 (与架构并行收尾)
├── P0-1: knowledge_review (知识回顾) - 首个 Skill，验证架构

Week 3
├── P0-2: duplicate_cleanup (重复清理)
├── P0-3: quick_digest (快速摘要)
└── P1-1: smart_tagging (智能标签)

Week 4
├── P1-2: reading_planner (阅读规划)
├── P1-3: related_discovery (关联发现)
├── P2-1: periodic_report (周期报告)
├── P2-2: learning_path (学习路径)
└── P2-3: share_bundle (分享包)
```

### 3.2 详细任务清单

#### P0 Skills (Week 2-3)

| 任务 ID  | Skill            | 子任务       | 预估    | 依赖       |
| -------- | ---------------- | ------------ | ------- | ---------- |
| S1.1     | knowledge_review | 输入解析     | 2h      | L1.5       |
| S1.2     |                  | 候选筛选逻辑 | 3h      | S1.1       |
| S1.3     |                  | 遗忘曲线算法 | 2h      | -          |
| S1.4     |                  | 回顾卡片生成 | 3h      | S1.2, S1.3 |
| S1.5     |                  | 流式执行实现 | 3h      | S1.4       |
| S1.6     |                  | 单元测试     | 2h      | S1.5       |
| **小计** |                  |              | **15h** |            |

| 任务 ID  | Skill             | 子任务         | 预估    | 依赖       |
| -------- | ----------------- | -------------- | ------- | ---------- |
| S2.1     | duplicate_cleanup | URL 去重逻辑   | 2h      | L1.5       |
| S2.2     |                   | 语义相似度检测 | 4h      | S2.1       |
| S2.3     |                   | 过期内容检测   | 3h      | -          |
| S2.4     |                   | 清理建议生成   | 2h      | S2.2, S2.3 |
| S2.5     |                   | 确认流程实现   | 2h      | S2.4       |
| S2.6     |                   | 单元测试       | 2h      | S2.5       |
| **小计** |                   |                | **15h** |            |

| 任务 ID  | Skill        | 子任务       | 预估    | 依赖 |
| -------- | ------------ | ------------ | ------- | ---- |
| S3.1     | quick_digest | 范围解析     | 2h      | L1.5 |
| S3.2     |              | 批量摘要生成 | 4h      | S3.1 |
| S3.3     |              | 主题聚类     | 3h      | S3.2 |
| S3.4     |              | 多格式输出   | 3h      | S3.3 |
| S3.5     |              | 单元测试     | 2h      | S3.4 |
| **小计** |              |              | **14h** |      |

#### P1 Skills (Week 3-4)

| Skill             | 预估 | 说明                  |
| ----------------- | ---- | --------------------- |
| smart_tagging     | 12h  | 标签推荐 + 标签规范化 |
| reading_planner   | 10h  | 时间评估 + 计划生成   |
| related_discovery | 12h  | 语义相似 + 知识图谱   |

#### P2 Skills (Week 4)

| Skill           | 预估 | 说明          |
| --------------- | ---- | ------------- |
| periodic_report | 8h   | 周报/月报生成 |
| learning_path   | 10h  | 学习路径构建  |
| share_bundle    | 8h   | 打包分享      |

### 3.3 文件创建清单

```
src/lib/ai-skills/skills/
├── knowledge-review/
│   ├── knowledge-review.skill.ts
│   ├── forgetting-curve.ts
│   ├── types.ts
│   └── index.ts
├── duplicate-cleanup/
│   ├── duplicate-cleanup.skill.ts
│   ├── similarity-detector.ts
│   ├── expiry-checker.ts
│   ├── types.ts
│   └── index.ts
├── quick-digest/
│   ├── quick-digest.skill.ts
│   ├── theme-clusterer.ts
│   ├── formatters/
│   │   ├── markdown.ts
│   │   ├── mindmap.ts
│   │   └── cards.ts
│   ├── types.ts
│   └── index.ts
├── smart-tagging/
│   └── ...
├── reading-planner/
│   └── ...
├── related-discovery/
│   └── ...
├── periodic-report/
│   └── ...
├── learning-path/
│   └── ...
└── share-bundle/
    └── ...
```

### 3.4 数据库迁移

```sql
-- migrations/20251224000001_add_ai_review_tables.sql

-- 回顾记录表
CREATE TABLE review_records (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_mode TEXT NOT NULL CHECK (review_mode IN ('quick', 'deep', 'quiz')),
  retention_score DECIMAL(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 阅读计划表
CREATE TABLE reading_plans (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  total_items INTEGER,
  completed_items INTEGER DEFAULT 0,
  total_minutes INTEGER,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 书签扩展字段
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ;

-- 索引
CREATE INDEX idx_review_records_user ON review_records(user_id);
CREATE INDEX idx_review_records_bookmark ON review_records(bookmark_id);
CREATE INDEX idx_reading_plans_user ON reading_plans(user_id);
```

---

## 4. Layer 3: 前端适配

### 4.1 任务清单

| 任务 ID | 任务名称                   | 预估 | 依赖  | 说明                   |
| ------- | -------------------------- | ---- | ----- | ---------------------- |
| F1.1    | 统一输出协议类型定义       | 1h   | L1.8  | TypeScript 类型        |
| F1.2    | 流式解析器升级             | 2h   | F1.1  | 支持新 chunk 类型      |
| F1.3    | ProgressBar 进度条组件     | 3h   | F1.2  | 分步进度展示           |
| F1.4    | DeliverableCard 交付物卡片 | 4h   | F1.2  | 多类型交付物展示       |
| F1.5    | OrchestrationConfirmDialog | 3h   | F1.2  | 编排确认对话框         |
| F1.6    | SuggestionChips 建议按钮   | 2h   | F1.2  | 后续操作建议           |
| F1.7    | ReviewCard 回顾卡片        | 3h   | S1    | knowledge_review 专用  |
| F1.8    | CleanupPreview 清理预览    | 3h   | S2    | duplicate_cleanup 专用 |
| F1.9    | DigestView 摘要视图        | 3h   | S3    | quick_digest 专用      |
| F1.10   | MindmapViewer 思维导图     | 4h   | S3    | 可选，摘要可视化       |
| F1.11   | AI 面板集成                | 4h   | All   | 统一集成到面板         |
| F1.12   | 响应式适配                 | 2h   | F1.11 | 移动端适配             |

**小计**: 34h

### 4.2 文件创建清单

```
src/components/ai/
├── output/                        # 统一输出组件
│   ├── types.ts                   # F1.1
│   ├── stream-parser.ts           # F1.2
│   ├── ProgressBar.tsx            # F1.3
│   ├── DeliverableCard.tsx        # F1.4
│   ├── OrchestrationConfirmDialog.tsx  # F1.5
│   ├── SuggestionChips.tsx        # F1.6
│   └── index.ts
├── skills/                        # Skill 专用组件
│   ├── knowledge-review/
│   │   ├── ReviewCard.tsx         # F1.7
│   │   ├── ReviewList.tsx
│   │   └── index.ts
│   ├── duplicate-cleanup/
│   │   ├── CleanupPreview.tsx     # F1.8
│   │   ├── DuplicateGroupCard.tsx
│   │   └── index.ts
│   └── quick-digest/
│       ├── DigestView.tsx         # F1.9
│       ├── MindmapViewer.tsx      # F1.10
│       └── index.ts
└── ai-panel-content.tsx           # F1.11 (修改现有)
```

### 4.3 组件设计稿

#### ProgressBar 进度条

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 知识回顾助手                                    [取消]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ████████████░░░░░░░░  60%                                 │
│                                                             │
│  ✅ 分析收藏数据         完成                               │
│  ✅ 计算回顾优先级       完成                               │
│  🔄 生成回顾卡片         进行中...                          │
│  ⏳ 准备交付物           等待中                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### DeliverableCard 交付物卡片

```
┌─────────────────────────────────────────────────────────────┐
│  📦 本周前端学习摘要                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 包含内容:                                               │
│  • 12 篇文章摘要                                            │
│  • 3 个主题分类                                             │
│  • 核心要点提取                                             │
│                                                             │
│  预览:                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ## React 性能优化                                    │   │
│  │ - 使用 memo 减少不必要渲染                           │   │
│  │ - useMemo 缓存计算结果...                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [复制内容]  [下载 Markdown]  [生成思维导图]  [分享]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### SuggestionChips 建议按钮

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  💡 接下来你可以:                                           │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 开始回顾  │ │ 导出清单  │ │ 设置提醒  │ │ 更多选项  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 API 响应适配

```typescript
// src/hooks/use-ai-chat.ts (升级)

interface UseAIChatOptions {
  onText?: (text: string) => void;
  onProgress?: (progress: ProgressData) => void; // 🆕
  onDeliverable?: (deliverable: Deliverable) => void; // 🆕
  onConfirmation?: (confirmation: Confirmation) => void;
  onSuggestions?: (suggestions: Suggestion[]) => void; // 🆕
  onRouting?: (routing: RoutingInfo) => void; // 🆕 调试用
  onDone?: (result: ExecutionResult) => void;
  onError?: (error: string) => void;
}

export function useAIChat(options: UseAIChatOptions) {
  const processChunk = useCallback(
    (chunk: UnifiedStreamChunk) => {
      switch (chunk.type) {
        case "text":
          options.onText?.(chunk.data.text);
          break;
        case "progress":
          options.onProgress?.(chunk.data);
          break;
        case "deliverable":
          options.onDeliverable?.(chunk.data);
          break;
        case "confirmation":
          options.onConfirmation?.(chunk.data);
          break;
        case "suggestions":
          options.onSuggestions?.(chunk.data.suggestions);
          break;
        case "routing":
          options.onRouting?.(chunk.data);
          break;
        case "done":
          options.onDone?.(chunk.data);
          break;
        case "error":
          options.onError?.(chunk.data.message);
          break;
      }
    },
    [options],
  );

  // ...
}
```

---

## 5. 周度详细计划

### Week 1: 架构基础设施

| 日  | 任务                         | 产出                                       |
| --- | ---------------------------- | ------------------------------------------ |
| D1  | L1.1 意图分类器              | intent-classifier.ts                       |
| D1  | L1.2 复杂度评估器            | complexity-evaluator.ts                    |
| D2  | L1.3 模式选择器              | mode-selector.ts                           |
| D2  | L1.4 IntentRouter 集成       | intent-router.ts                           |
| D3  | L1.5 OrchestrationSkill 基类 | orchestration-skill.ts                     |
| D4  | L1.6 进度报告                | progress-reporter.ts                       |
| D4  | L1.7 交付物生成              | deliverable-generator.ts                   |
| D5  | L1.8-L1.10 引擎              | unified-engine.ts, orchestration-engine.ts |

**周末验收**: IntentRouter 可路由，OrchestrationSkill 基类可用

### Week 2: 首个 Skill + 前端基础

| 日  | 后端任务                        | 前端任务                |
| --- | ------------------------------- | ----------------------- |
| D1  | S1.1-S1.2 knowledge_review 核心 | F1.1-F1.2 类型 + 解析器 |
| D2  | S1.3 遗忘曲线算法               | F1.3 ProgressBar        |
| D3  | S1.4 回顾卡片生成               | F1.4 DeliverableCard    |
| D4  | S1.5 流式执行实现               | F1.5 ConfirmDialog      |
| D5  | S1.6 测试 + L1.11 API 集成      | F1.6 SuggestionChips    |

**周末验收**: knowledge_review 端到端可用，前端能展示进度和交付物

### Week 3: P0 Skills 完成 + Skill 专用组件

| 日  | 后端任务                         | 前端任务                   |
| --- | -------------------------------- | -------------------------- |
| D1  | S2.1-S2.2 duplicate_cleanup 去重 | F1.7 ReviewCard            |
| D2  | S2.3-S2.4 过期检测 + 建议        | F1.8 CleanupPreview        |
| D3  | S2.5-S2.6 确认流程 + 测试        | F1.9 DigestView            |
| D4  | S3.1-S3.2 quick_digest 摘要      | F1.10 MindmapViewer (可选) |
| D5  | S3.3-S3.5 聚类 + 格式化          | 组件联调                   |

**周末验收**: 3 个 P0 Skills 全部可用

### Week 4: P1 + P2 Skills

| 日  | 任务                         |
| --- | ---------------------------- |
| D1  | smart_tagging                |
| D2  | reading_planner              |
| D3  | related_discovery            |
| D4  | periodic_report              |
| D5  | learning_path + share_bundle |

**周末验收**: 全部 9 个 Skills 功能完整

### Week 5: 集成测试 + 优化 + 发布

| 日  | 任务                          |
| --- | ----------------------------- |
| D1  | 集成测试 - 全流程             |
| D2  | Bug 修复                      |
| D3  | 性能优化                      |
| D4  | F1.11-F1.12 面板集成 + 响应式 |
| D5  | 文档完善 + 发布准备           |

**周末**: 正式发布 🎉

---

## 6. 依赖关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              依赖关系图                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [L1.1 意图分类] ──┐                                                        │
│                   ├──► [L1.4 IntentRouter] ──┐                              │
│  [L1.2 复杂度]  ──┤                          │                              │
│                   │                          │                              │
│  [L1.3 模式选择] ─┘                          │                              │
│                                              │                              │
│  [L1.5 OrchestrationSkill] ──┬──────────────►├──► [L1.9 UnifiedEngine]     │
│         │                    │               │            │                 │
│         ├──► [L1.6 进度报告]  │               │            │                 │
│         │                    │               │            │                 │
│         ├──► [L1.7 交付物]   │               │            ▼                 │
│         │                    │               │     [L1.11 API 集成]         │
│         └──► [L1.8 输出适配] ┘               │            │                 │
│                                              │            │                 │
│  [L1.10 OrchestrationEngine] ────────────────┘            │                 │
│         │                                                 │                 │
│         ▼                                                 │                 │
│  ┌─────────────────────────────────────────┐              │                 │
│  │ [S1 knowledge_review]                   │◄─────────────┘                 │
│  │ [S2 duplicate_cleanup]                  │                                │
│  │ [S3 quick_digest]                       │                                │
│  │ ...                                     │                                │
│  └─────────────────────────────────────────┘                                │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────┐                                │
│  │ [F1.1 类型] ──► [F1.2 解析器]           │                                │
│  │      │                │                 │                                │
│  │      ▼                ▼                 │                                │
│  │ [F1.3 ProgressBar]                      │                                │
│  │ [F1.4 DeliverableCard]                  │                                │
│  │ [F1.5 ConfirmDialog]                    │                                │
│  │ [F1.6 SuggestionChips]                  │                                │
│  │ [F1.7-F1.10 Skill 专用组件]              │                                │
│  │      │                                  │                                │
│  │      ▼                                  │                                │
│  │ [F1.11 AI 面板集成]                      │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. 风险与应对

| 风险                | 概率 | 影响 | 应对措施                             |
| ------------------- | ---- | ---- | ------------------------------------ |
| 意图分类不准确      | 中   | 高   | 默认回退到原子模式；收集数据迭代优化 |
| 编排 Skill 执行超时 | 中   | 中   | 分步超时控制；允许中途取消           |
| 前端组件复杂度高    | 低   | 中   | 复用现有组件；渐进增强               |
| 数据库迁移风险      | 低   | 高   | 先测试环境验证；可回滚               |
| 并行开发协调难      | 中   | 中   | 每日站会同步；接口先行               |

---

## 8. 资源需求

| 角色     | 人数 | 工作量                       |
| -------- | ---- | ---------------------------- |
| 后端开发 | 1    | 100h (架构 39h + Skills 61h) |
| 前端开发 | 1    | 34h                          |
| 测试     | 0.5  | 16h                          |
| **总计** |      | **150h**                     |

---

## 9. 验收清单

### 9.1 功能验收

- [ ] 意图路由正确率 > 90%
- [ ] 简单任务响应时间 < 2s
- [ ] 编排 Skill 完整执行成功率 > 95%
- [ ] 回退机制正常工作
- [ ] 9 个 Skills 全部功能完整

### 9.2 体验验收

- [ ] 进度条平滑展示
- [ ] 交付物可正确下载/分享
- [ ] 确认对话框交互流畅
- [ ] 移动端适配良好

### 9.3 质量验收

- [ ] 单元测试覆盖率 > 80%
- [ ] 无 P0/P1 级 Bug
- [ ] 代码 Review 通过
- [ ] 文档完整

---

**文档结束**

> 请审核以上实施计划，如有疑问或建议，欢迎讨论。
