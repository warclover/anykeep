# 智能分类算法优化方案 v6.0

## 1. 背景与目标

### 1.1 现状问题

基于 V5.1 回测评估结果（100 条真实用户书签）：

| 指标      | 当前值 | 目标值 | 差距  |
| --------- | ------ | ------ | ----- |
| 准确率    | 14%    | >95%   | -81%  |
| T0 置信度 | 1.6%   | >75%   | -73%  |
| 平均延迟  | 6.7s   | <1s    | +5.7s |
| T1 触发率 | 100%   | <20%   | -80%  |

### 1.2 根因分析

```
┌─────────────────────────────────────────────────────────────┐
│                      问题层级分析                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: 数据层 ────────────────────────────────────���────  │
│  │                                                          │
│  │  ❌ 用户分类不规范（"claude 学习"包含各种内容）           │
│  │  ❌ 文件夹命名不语义化（无法推断内容类型）                │
│  │  ❌ 部分文件夹是"垃圾桶"（混杂无关内容）                  │
│  │                                                          │
│  Layer 2: 画像层 ─────────────────────────────────────────  │
│  │                                                          │
│  │  ❌ 画像基于所有书签生成，包含噪音                        │
│  │  ❌ 画像过于泛化，区分度低                                │
│  │  ❌ 缺乏文件夹语义描述                                    │
│  │                                                          │
│  Layer 3: 算法层 ─────────────────────────────────────────  │
│  │                                                          │
│  │  ❌ RRF 置信度计算问题（rrfK=60 过大）                    │
│  │  ❌ 向量相似度低（~0.05）但无其他信号补充                 │
│  │  ❌ 缺乏关键词/规则���配增强                               │
│  │                                                          │
│  Layer 4: LLM 层 ─────────────────────────────────────────  │
│  │                                                          │
│  │  ❌ 缺乏文件夹语义描述，LLM 只能靠名称猜测                │
│  │  ❌ 候选集可能不包含正确答案                              │
│  │  ❌ 提示词未优化，缺乏用户偏好信息                        │
│  │                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 优化目标

| 阶段    | 目标准确率 | 目标延迟 | 预计工期 |
| ------- | ---------- | -------- | -------- |
| Phase 1 | 40%+       | <3s      | 3天      |
| Phase 2 | 70%+       | <2s      | 5天      |
| Phase 3 | 85%+       | <1.5s    | 5天      |
| Phase 4 | 95%+       | <1s      | 持续迭代 |

---

## 2. Phase 1: 快速修复（3天）

### 2.1 修复 RRF 置信度计算

**问题**：当前 RRF 公式产生的分数过低（~1.6%），导致所有请求都触发 T1。

**当前公式**：

```typescript
// rrfK = 60, rank 从 0 开始
const rrf = 1 / (rrfK + rank + 1); // = 1/61 ≈ 0.0164
```

**修复方案**：

#### 方案 A：调整 RRF 参数

```typescript
// 降低 rrfK 到 1-5，使分数更有区分度
const rrfK = 3;
const rrf = 1 / (rrfK + rank + 1); // rank=0 时 = 1/4 = 0.25
```

#### 方案 B：使用原始向量相似度（推荐）

```typescript
// 直接使用向量相似度作为置信度
const confidence = contentResults[0].similarity; // 0.76-0.95
```

#### 方案 C：混合策略

```typescript
// 结合向量相似度和排名
const confidence = similarity * (1 - rank * 0.1);
```

**推荐**：方案 B（使用原始向量相似度）

**文件**：`src/lib/classification/v5/classification-pipeline/hybrid-retriever.ts`

---

### 2.2 添加关键词匹配增强

**问题**：书签标题包含文件夹名称关键词时，应直接匹配。

**实现**：

```typescript
// 在 HybridRetriever.retrieve() 中添加
private applyKeywordBoost(results: HybridRetrievalResult[], title: string): HybridRetrievalResult[] {
  const titleLower = title.toLowerCase();

  return results.map(result => {
    const folderNameLower = result.folderName.toLowerCase();

    // 标题包含文件夹名 → 加成 0.3
    if (titleLower.includes(folderNameLower)) {
      return { ...result, fusedScore: result.fusedScore + 0.3 };
    }

    // 文件夹名包含在标题中的关键词 → 加成 0.15
    const keywords = folderNameLower.split(/[+\s_-]+/);
    const matchCount = keywords.filter(kw => kw.length > 1 && titleLower.includes(kw)).length;
    if (matchCount > 0) {
      return { ...result, fusedScore: result.fusedScore + 0.15 * matchCount };
    }

    return result;
  }).sort((a, b) => b.fusedScore - a.fusedScore);
}
```

**文件**：`src/lib/classification/v5/classification-pipeline/hybrid-retriever.ts`

---

### 2.3 修复 null 分类问题

**问题**：某些分类返回 null。

**排查点**：

1. `HybridRetriever.retrieve()` 返回空数组
2. T1 LLM 响应解析失败
3. 异常未正确捕获

**修复**：

```typescript
// 在 ClassificationPipelineService.classify() 中添加兜底
if (!result.folderId || result.folderId === 'null') {
  // 使用默认文件夹（inbox）
  return {
    folderId: 'inbox',
    confidence: 0,
    usedT1: true,
    reasoning: 'Classification failed, using default folder',
    ...
  };
}
```

**文件**：`src/lib/classification/v5/classification-pipeline/classification-pipeline.service.ts`

---

### 2.4 Phase 1 验收标准

| 指标      | 当前 | Phase 1 目标 | 验收方式 |
| --------- | ---- | ------------ | -------- |
| 准确率    | 14%  | 40%+         | 回测评估 |
| T0 置信度 | 1.6% | >50%         | 日志检查 |
| T1 触发率 | 100% | <60%         | 日志统计 |
| null 分类 | 存在 | 0            | 回测验证 |

---

## 3. Phase 2: 算法优化（5天）

### 3.1 T0 置信度分层策略

**目标**：让高质量匹配直接通过 T0，减少 T1 调用。

```typescript
interface T0ConfidenceThresholds {
  high: 0.85; // 高置信度，直接使用 T0 结果
  medium: 0.65; // 中置信度，需要 T1 验证
  low: 0.45; // 低置信度，T1 必须纠正
  reject: 0.3; // 拒绝阈值，使用默认文件夹
}

// T0 决策逻辑
function makeT0Decision(
  confidence: number,
  topScore: number,
  secondScore: number,
): T0Decision {
  const gap = topScore - secondScore;

  // 高置信度 + 明显领先 → 直接使用
  if (confidence >= 0.85 && gap >= 0.15) {
    return { useT0: true, needsT1: false };
  }

  // 中置信度 或 竞争激烈 → T1 验证
  if (confidence >= 0.65 || gap < 0.1) {
    return { useT0: true, needsT1: true };
  }

  // 低置信度 → T1 必须纠正
  if (confidence >= 0.45) {
    return { useT0: false, needsT1: true };
  }

  // 极低置信度 → 使用默认
  return { useT0: false, needsT1: false, useDefault: true };
}
```

**文件**：`src/lib/classification/v5/classification-pipeline/llm-caller.ts`

---

### 3.2 多信号融合评分

**目标**：结合多种信号提升匹配准确度。

```typescript
interface MultiSignalScore {
  vectorSimilarity: number; // 向量相似度 (0-1)
  keywordMatch: number; // 关键词匹配 (0-1)
  recencyBias: number; // 最近使用偏好 (0-1)
  frequencyBias: number; // 使用频率偏好 (0-1)
}

function calculateFusedScore(signals: MultiSignalScore): number {
  return (
    signals.vectorSimilarity * 0.5 +
    signals.keywordMatch * 0.25 +
    signals.recencyBias * 0.15 +
    signals.frequencyBias * 0.1
  );
}
```

**新增表**：

```sql
-- 文件夹使用统计
CREATE TABLE folder_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  folder_id BIGINT NOT NULL REFERENCES folders(id),
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, folder_id)
);
```

**文件**：

- `src/lib/classification/v5/classification-pipeline/multi-signal-scorer.ts`（新建）
- `supabase/migrations/20260123000001_add_folder_usage_stats.sql`（新建）

---

### 3.3 优化 T1 LLM 提示词

**当前问题**：LLM 只知道文件夹名称，无法理解文件夹的实际用途。

**改进方案**：为每个候选文件夹生成描述。

```typescript
interface FolderContext {
  id: string;
  name: string;
  description: string; // 新增���文件夹描述
  sampleBookmarks: string[]; // 新增：示例书签标题
  keywordTags: string[]; // 新增：关键词标签
}

// 改进的 T1 提示词
const t1Prompt = `
你是一个智能书签分类助手。请根据书签内容和文件夹描述，选择最合适的文件夹。

## 待分类书签
- 标题：${bookmark.title}
- 摘要：${bookmark.summary || "无"}
- URL：${bookmark.url}

## 候选文件夹

${candidates
  .map(
    (c, i) => `
### ${i + 1}. ${c.name}
- 描述：${c.description}
- 示例书签：${c.sampleBookmarks.slice(0, 3).join("、")}
- 关键词：${c.keywordTags.join(", ")}
`,
  )
  .join("\n")}

## 输出格式
请返回 JSON：{"folderId": "选择的文件夹ID", "confidence": 0.0-1.0, "reasoning": "选择理由"}
`;
```

**文件**：`src/lib/classification/v5/classification-pipeline/llm-caller.ts`

---

### 3.4 Phase 2 验收标准

| 指标         | Phase 1 | Phase 2 目标 | 验收方式 |
| ------------ | ------- | ------------ | -------- |
| 准确率       | 40%     | 70%+         | 回测评估 |
| T1 触发率    | 60%     | <30%         | 日志统计 |
| 平均延迟     | 3s      | <2s          | 回测统计 |
| 高置信正确率 | 50%     | 85%+         | 分层统计 |

---

## 4. Phase 3: 画像增强（5天）

### 4.1 文件夹画像质量评估

**目标**：识别低质量画像并触发重建。

```typescript
interface ProfileQualityMetrics {
  bookmarkCount: number; // 书签数量
  contentDiversity: number; // 内容多样性（向量方差）
  keywordConsistency: number; // 关键词一致性
  classificationAccuracy: number; // 历史分类准确率
}

function evaluateProfileQuality(
  metrics: ProfileQualityMetrics,
): "high" | "medium" | "low" {
  const score =
    Math.min(metrics.bookmarkCount / 10, 1) * 0.3 +
    (1 - metrics.contentDiversity) * 0.2 + // 多样性低 = 质量高
    metrics.keywordConsistency * 0.25 +
    metrics.classificationAccuracy * 0.25;

  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
```

### 4.2 画像重建策略

**低质量画像处理**：

```typescript
async function rebuildLowQualityProfiles(userId: string): Promise<void> {
  const profiles = await getProfilesWithQuality(userId);

  for (const profile of profiles) {
    if (profile.quality === "low") {
      // 方案 1：使用最近 N 条高质量书签重建
      const recentBookmarks = await getRecentQualityBookmarks(
        profile.folderId,
        20,
      );

      // 方案 2：剔除异常书签后重建
      const filteredBookmarks = await filterOutlierBookmarks(profile.folderId);

      // 方案 3：结合文件夹名称语义
      const nameEmbedding = await generateEmbedding(profile.folderName);

      // 加权融合生成新画像
      const newEmbedding = weightedAverage([
        { embedding: filteredBookmarks.embedding, weight: 0.6 },
        { embedding: nameEmbedding, weight: 0.4 },
      ]);

      await updateProfile(profile.id, newEmbedding);
    }
  }
}
```

### 4.3 文件夹语义描述生成

**目标**：为每个文件夹自动生成语义描述。

```typescript
async function generateFolderDescription(folderId: string): Promise<string> {
  // 获取文件夹内书签的标题和摘要
  const bookmarks = await getBookmarksByFolder(folderId, 50);

  const prompt = `
分析以下书签列表，为这个文件夹生成一句话描述（不超过50字）。

文件夹名称：${folderName}

书签列表：
${bookmarks.map((b) => `- ${b.title}`).join("\n")}

请直接返回描述文本，不要其他内容。
`;

  const description = await llm.complete(prompt);
  return description;
}
```

**新增字段**：

```sql
ALTER TABLE folders ADD COLUMN IF NOT EXISTS ai_description TEXT;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS keyword_tags TEXT[];
```

### 4.4 Phase 3 验收标准

| 指标             | Phase 2 | Phase 3 目标 | 验收方式 |
| ---------------- | ------- | ------------ | -------- |
| 准确率           | 70%     | 85%+         | 回测评估 |
| 高质量画像比例   | 未知    | >80%         | 质量评估 |
| 文��夹描述覆盖率 | 0%      | 100%         | 数据检查 |

---

## 5. Phase 4: 持续迭代

### 5.1 在线学习机制

```typescript
// 用户纠正反馈
interface ClassificationFeedback {
  bookmarkId: string;
  predictedFolderId: string;
  actualFolderId: string;
  feedbackType: "correct" | "incorrect" | "moved";
}

// 收集反馈并更新画像
async function handleFeedback(feedback: ClassificationFeedback): Promise<void> {
  if (
    feedback.feedbackType === "incorrect" ||
    feedback.feedbackType === "moved"
  ) {
    // 更新正确文件夹的画像（增加该书签的权重）
    await updateProfileWithBookmark(
      feedback.actualFolderId,
      feedback.bookmarkId,
      1.5,
    );

    // 更新错误文件夹的画像（降低该书签的权重）
    await updateProfileWithBookmark(
      feedback.predictedFolderId,
      feedback.bookmarkId,
      -0.5,
    );

    // 记录纠正历史，用于评估系统性能
    await recordCorrectionHistory(feedback);
  }
}
```

### 5.2 A/B 测试框架

```typescript
interface ABTestConfig {
  testId: string;
  variants: {
    control: ClassificationConfig;
    treatment: ClassificationConfig;
  };
  userAllocation: number; // 0-1，treatment 组比例
  metrics: string[]; // 要追踪的指标
}

// 根据用户分配实验组
function assignVariant(
  userId: string,
  testId: string,
): "control" | "treatment" {
  const hash = hashCode(`${userId}-${testId}`);
  const allocation = (hash % 100) / 100;
  return allocation < testConfig.userAllocation ? "treatment" : "control";
}
```

### 5.3 监控与告警

```typescript
interface ClassificationMetrics {
  timestamp: Date;
  accuracy: number;
  t1TriggerRate: number;
  avgLatencyMs: number;
  errorRate: number;
}

// 异常检测
function detectAnomalies(metrics: ClassificationMetrics[]): Alert[] {
  const alerts: Alert[] = [];

  // 准确率突然下降
  if (metrics[0].accuracy < metrics[1].accuracy * 0.8) {
    alerts.push({ level: "critical", message: "Accuracy dropped by >20%" });
  }

  // 延迟突然增加
  if (metrics[0].avgLatencyMs > metrics[1].avgLatencyMs * 1.5) {
    alerts.push({ level: "warning", message: "Latency increased by >50%" });
  }

  return alerts;
}
```

---

## 6. 实施计划

### 6.1 时间线

```
Week 1 (Phase 1):
├── Day 1-2: 修复 RRF 置信度计算
├── Day 2-3: 添加关键词匹配增强
└── Day 3: 修复 null 分类问题 + 验收测试

Week 2-3 (Phase 2):
├── Day 1-2: T0 置信度分层策略
├── Day 3-4: 多信号融合评分
├── Day 5-6: 优化 T1 LLM 提示词
└── Day 7: 验收测试

Week 3-4 (Phase 3):
├── Day 1-2: 文件夹画像质量评估
├── Day 3-4: 画像重建策略
├── Day 5-6: 文件夹语义描述生成
└── Day 7: 验收测试

Week 5+ (Phase 4):
├── 在线学习机制
├── A/B 测试框架
└── 监控与告警
```

### 6.2 风险与缓解

| 风险                 | 影响 | 缓解措施                       |
| -------------------- | ---- | ------------------------------ |
| 画像重建影响现有分类 | 高   | 新旧画像并行运行，逐步切换     |
| LLM 调用成本增加     | 中   | 优化 T0 减少 T1 触发率         |
| 用户反馈数据不足     | 中   | 主动收集初始反馈，使用评估数据 |
| 性能回退             | 高   | Feature Flag 控制，随时回滚    |

### 6.3 成功指标

| 阶段    | 准确率 | T1 触发率 | 延迟  | 用户满意度 |
| ------- | ------ | --------- | ----- | ---------- |
| 当前    | 14%    | 100%      | 6.7s  | -          |
| Phase 1 | 40%+   | <60%      | <3s   | -          |
| Phase 2 | 70%+   | <30%      | <2s   | -          |
| Phase 3 | 85%+   | <20%      | <1.5s | -          |
| Phase 4 | 95%+   | <10%      | <1s   | >90%       |

---

## 7. 附录

### 7.1 相关文件

| 文件                                                 | 说明         |
| ---------------------------------------------------- | ------------ |
| `src/lib/classification/v5/classification-pipeline/` | 分类核心逻辑 |
| `src/lib/classification/v5/shared/`                  | 共享服务     |
| `supabase/migrations/`                               | 数据库迁移   |
| `scripts/evaluate-v5-backtest.ts`                    | 评估脚本     |
| `test-results/v5-backtest-report.md`                 | 评估报告     |

### 7.2 评估数据集

- 真实用户 ID：`fd8f3544-7ba6-4c65-b3ae-01141826fb9e`
- 已分类书签数：359 条
- 有效文件夹数：17 个
- 平台覆盖：6 个平台

### 7.3 参考资料

- [RRF (Reciprocal Rank Fusion) 论文](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [向量相似度搜索最佳实践](https://www.pinecone.io/learn/vector-similarity/)
- [LLM 分类任务优化](https://platform.openai.com/docs/guides/prompt-engineering)
