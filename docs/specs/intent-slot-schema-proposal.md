# 意图-槽位定义表 (Intent-Slot Schema)

> **版本**: v1.0.0  
> **创建日期**: 2026-01-09  
> **状态**: 提案

## 一、槽位定义结构

### 1.1 扩展类型定义

```typescript
// src/lib/ai-skills/router/types.ts

/**
 * 槽位定义（结构化参数）
 */
export interface IntentSlot {
  /** 槽位名称 */
  name: string;
  /** 槽位值 */
  value: unknown;
  /** 槽位类型 */
  type: "string" | "number" | "boolean" | "array" | "object";
  /** 置信度 0-1 */
  confidence: number;
  /** 是否必需 */
  required: boolean;
  /** 来源（extracted: 从输入提取, inferred: 从上下文推断, default: 默认值） */
  source: "extracted" | "inferred" | "default" | "context";
}

/**
 * 意图槽位映射（按意图类型定义）
 */
export interface IntentSlotSchema {
  /** 意图类型 */
  intentType: `${IntentType}:${string}`;
  /** 槽位定义 */
  slots: Record<string, IntentSlot>;
  /** 槽位完整性评分 0-1 */
  completeness: number;
}

/**
 * 扩展的意图分类结果（包含槽位）
 */
export interface EnhancedIntentClassification extends IntentClassification {
  /** 结构化槽位 */
  slots?: IntentSlotSchema;
  /** 原始实体列表（保留兼容性） */
  entities: ExtractedEntity[];
}
```

### 1.2 核心意图槽位定义

| 意图类型           | 必需槽位       | 可选槽位                                | 示例                                                         |
| ------------------ | -------------- | --------------------------------------- | ------------------------------------------------------------ |
| `organize:move`    | `targetFolder` | `sourceFolder`, `bookmarkIds`, `filter` | `{ targetFolder: "前端开发", filter: { keyword: "React" } }` |
| `query:search`     | `query`        | `filters`, `limit`, `sortBy`            | `{ query: "React", filters: { platform: "bilibili" } }`      |
| `action:tag`       | `tags`         | `bookmarkIds`, `scope`                  | `{ tags: ["前端"], scope: "selected" }`                      |
| `create:export`    | `format`       | `bookmarkIds`, `fields`, `outputPath`   | `{ format: "markdown", fields: ["title", "url"] }`           |
| `organize:cleanup` | -              | `scope`, `strategy`, `dryRun`           | `{ scope: "all", strategy: "duplicate" }`                    |

### 1.3 LLM Prompt 增强

```typescript
// src/lib/ai-skills/router/llm-classifier.ts

const INTENT_WITH_SLOTS_PROMPT = `你是一个意图分类和参数提取专家。

## 任务
1. 识别用户意图（type + subType）
2. 提取结构化参数（slots）

## 意图类型
${INTENT_TYPES_DESCRIPTION}

## 槽位定义（按意图类型）
${SLOT_SCHEMAS_DESCRIPTION}

## 用户输入
"{input}"

## 对话上下文
{context}

## 输出格式（JSON）
{
  "type": "意图类型",
  "subType": "子类型",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由",
  "slots": {
    "slotName": {
      "value": "槽位值",
      "type": "string|number|boolean|array",
      "confidence": 0.0-1.0,
      "source": "extracted|inferred|default"
    }
  },
  "alternatives": [...]
}`;
```

### 1.4 实施优先级

**Phase 1.5（插入在 Phase 1 和 Phase 2 之间）**：

1. **Week 1**: 扩展类型定义 + 槽位 Schema 定义（20 个核心意图）
2. **Week 2**: LLM Prompt 增强 + 槽位提取逻辑
3. **Week 3**: 集成到 `HybridIntentClassifier` + 测试

**关键优化**：

- 槽位提取与意图分类**合并为一次 LLM 调用**（避免两次调用）
- 使用 `generateObject` 的 Zod Schema 约束输出格式
- 槽位验证层：提取后立即验证是否符合 Tool/Skill 的参数要求

---

## 二、延迟优化：快慢道策略

### 2.1 架构设计

```typescript
// src/lib/ai-skills/router/fast-track-classifier.ts

export class FastTrackClassifier {
  private ruleCache: LRUCache<string, IntentClassification>;
  private embeddingCache: LRUCache<string, SemanticMatch[]>;
  private hotIntentCache: LRUCache<string, IntentClassification>; // 高频意图缓存

  /**
   * 快慢道分类
   */
  async classify(
    input: string,
    context: ClassificationContext,
  ): Promise<FastTrackResult> {
    const startTime = performance.now();

    // ============================================
    // Fast Track (<100ms)
    // ============================================

    // 1. 规则缓存命中（<5ms）
    const ruleCacheKey = this.buildRuleCacheKey(input);
    const cachedRule = this.ruleCache.get(ruleCacheKey);
    if (cachedRule && cachedRule.confidence >= 0.9) {
      return {
        result: cachedRule,
        track: "fast_cache",
        latencyMs: performance.now() - startTime,
      };
    }

    // 2. 高频意图缓存（<10ms）
    const hotIntent = this.hotIntentCache.get(input);
    if (hotIntent) {
      return {
        result: hotIntent,
        track: "fast_hot",
        latencyMs: performance.now() - startTime,
      };
    }

    // 3. 规则匹配（<20ms）
    const ruleMatch = this.ruleClassifier.matchRules(input);
    if (ruleMatch && ruleMatch.confidence >= 0.85) {
      // 更新缓存
      this.ruleCache.set(ruleCacheKey, ruleMatch);
      return {
        result: ruleMatch,
        track: "fast_rule",
        latencyMs: performance.now() - startTime,
      };
    }

    // 4. Embedding 语义缓存（<50ms）
    const embeddingCacheKey = this.buildEmbeddingCacheKey(input);
    const cachedSemantic = this.embeddingCache.get(embeddingCacheKey);
    if (cachedSemantic && cachedSemantic[0]?.similarity > 0.85) {
      return {
        result: this.semanticToIntent(cachedSemantic[0]),
        track: "fast_semantic_cache",
        latencyMs: performance.now() - startTime,
      };
    }

    // ============================================
    // Slow Track (LLM) - 仅在 Fast Track 失败时触发
    // ============================================

    if (ruleMatch && ruleMatch.confidence >= 0.6) {
      // 中置信度：使用流式 LLM（边识别边执行）
      return {
        result: ruleMatch,
        track: "slow_streaming",
        latencyMs: performance.now() - startTime,
        streaming: true, // 标记为流式
      };
    }

    // 低置信度：完整 LLM 分类
    const llmResult = await this.llmClassifier.classify(input, context);
    return {
      result: llmResult,
      track: "slow_llm",
      latencyMs: performance.now() - startTime,
    };
  }
}
```

### 2.2 流式意图识别

```typescript
// src/lib/ai-skills/router/streaming-intent-classifier.ts

/**
 * 流式意图识别：一旦识别出意图类型，立即返回，后台继续解析参数
 */
export class StreamingIntentClassifier {
  async *classifyStream(
    input: string,
    context: ClassificationContext,
  ): AsyncGenerator<IntentStreamChunk> {
    // 1. 快速返回意图类型（<200ms）
    const quickType = await this.quickTypeDetection(input);

    yield {
      type: "intent_detected",
      data: {
        type: quickType.type,
        subType: quickType.subType,
        confidence: quickType.confidence,
        partial: true, // 标记为部分结果
      },
    };

    // 2. 后台继续解析槽位（不阻塞前端）
    const fullResult = await this.extractSlots(input, quickType, context);

    yield {
      type: "slots_extracted",
      data: {
        slots: fullResult.slots,
        completeness: fullResult.completeness,
      },
    };

    // 3. 最终结果
    yield {
      type: "complete",
      data: fullResult,
    };
  }
}
```

### 2.3 前端优化

```typescript
// src/components/ai/streaming-intent-handler.tsx

export function StreamingIntentHandler({ input }: Props) {
  const [intent, setIntent] = useState<PartialIntent | null>(null);
  const [slots, setSlots] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const stream = intentClassifier.classifyStream(input);

    for await (const chunk of stream) {
      if (chunk.type === "intent_detected") {
        // 立即渲染骨架屏
        setIntent(chunk.data);
        // 预加载对应的 UI 组件
        preloadComponent(chunk.data.type);
      } else if (chunk.type === "slots_extracted") {
        setSlots(chunk.data.slots);
      }
    }
  }, [input]);

  // 基于部分意图渲染骨架屏
  if (intent && intent.partial) {
    return <IntentSkeleton type={intent.type} />;
  }

  return <IntentUI intent={intent} slots={slots} />;
}
```

**性能目标**：

- Fast Track 命中率 >70%（通过缓存预热）
- 感官延迟 <200ms（骨架屏渲染）
- 完整识别延迟 <500ms（p95）

---

## 三、黄金数据集与回归测试

### 3.1 数据集结构

```typescript
// src/lib/ai-skills/router/golden-dataset.ts

export interface GoldenTestCase {
  id: string;
  input: string;
  expectedIntent: {
    type: IntentType;
    subType: string;
    confidence: number; // 最低置信度要求
  };
  expectedSlots?: Record<string, unknown>;
  context?: Partial<ClassificationContext>;
  tags: string[]; // "critical", "edge_case", "ambiguous"
}

export const GOLDEN_DATASET: GoldenTestCase[] = [
  // 核心用例（必须 100% 通过）
  {
    id: "golden-001",
    input: "整理一下我的收藏",
    expectedIntent: { type: "organize", subType: "cleanup", confidence: 0.85 },
    tags: ["critical"],
  },
  {
    id: "golden-002",
    input: "把最近关于 React 的文章整理到前端开发文件夹里",
    expectedIntent: { type: "organize", subType: "move", confidence: 0.8 },
    expectedSlots: {
      targetFolder: "前端开发",
      filter: { keyword: "React", time: "recent" },
    },
    tags: ["critical", "slot_extraction"],
  },
  // ... 100+ 核心用例
];
```

### 3.2 回归测试机制

```typescript
// scripts/validate-golden-dataset.ts

export async function validateGoldenDataset(
  classifier: IntentClassifier,
): Promise<ValidationReport> {
  const results: TestResult[] = [];

  for (const testCase of GOLDEN_DATASET) {
    const result = await classifier.classify(testCase.input, testCase.context);

    const passed =
      result.type === testCase.expectedIntent.type &&
      result.subType === testCase.expectedIntent.subType &&
      result.confidence >= testCase.expectedIntent.confidence;

    results.push({
      testCaseId: testCase.id,
      passed,
      actual: result,
      expected: testCase.expectedIntent,
    });
  }

  const criticalPassRate =
    results.filter((r) => r.passed && r.testCase.tags.includes("critical"))
      .length /
    GOLDEN_DATASET.filter((t) => t.tags.includes("critical")).length;

  return {
    totalTests: results.length,
    passed: results.filter((r) => r.passed).length,
    criticalPassRate,
    failures: results.filter((r) => !r.passed),
    // 如果关键用例通过率 <100%，阻止部署
    canDeploy: criticalPassRate === 1.0,
  };
}
```

### 3.3 CI 集成

```yaml
# .github/workflows/intent-validation.yml

name: Intent Classification Validation

on:
  pull_request:
    paths:
      - "src/lib/ai-skills/router/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run validate:golden-dataset
        # 如果关键用例失败，PR 无法合并
```

---

## 四、推测执行策略

### 4.1 风险分级执行

```typescript
// src/lib/ai-skills/router/speculative-executor.ts

export class SpeculativeExecutor {
  /**
   * 判断是否应该推测执行
   */
  shouldSpeculate(match: IntentMatch): boolean {
    // 高风险操作：必须确认
    if (this.isHighRiskOperation(match)) {
      return false;
    }

    // 无副作用操作：可以推测执行
    if (this.isSideEffectFree(match)) {
      return true;
    }

    // 中风险：置信度 >0.8 时推测执行
    return match.confidence >= 0.8;
  }

  private isHighRiskOperation(match: IntentMatch): boolean {
    const highRiskTypes = [
      "action:delete",
      "action:batch_delete",
      "organize:dedupe",
    ];
    return highRiskTypes.includes(`${match.type}:${match.subType}`);
  }

  private isSideEffectFree(match: IntentMatch): boolean {
    const safeTypes = [
      "query:search",
      "query:list",
      "query:count",
      "analyze:report",
    ];
    return safeTypes.includes(`${match.type}:${match.subType}`);
  }
}
```

### 4.2 撤销机制

```typescript
// src/lib/ai-skills/router/undo-manager.ts

export class UndoManager {
  private undoStack: UndoAction[] = [];

  /**
   * 执行操作并记录撤销信息
   */
  async executeWithUndo<T>(
    action: () => Promise<T>,
    undoAction: () => Promise<void>,
  ): Promise<T> {
    const result = await action();

    this.undoStack.push({
      undo: undoAction,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * 撤销最近一次操作
   */
  async undo(): Promise<void> {
    const lastAction = this.undoStack.pop();
    if (lastAction) {
      await lastAction.undo();
    }
  }
}
```

### 4.3 UI 提示

```typescript
// src/components/ai/speculative-action-banner.tsx

export function SpeculativeActionBanner({ intent, onSwitch }: Props) {
  return (
    <Banner variant="info">
      <span>已为您执行 {getIntentLabel(intent)}</span>
      <Button variant="link" onClick={onSwitch}>
        原本是想 {intent.alternatives[0]?.label} 吗？点击切换
      </Button>
    </Banner>
  );
}
```

---

## 五、Phase 3 调整建议

### 5.1 多模态 → 个性化学习

**建议**：将 Phase 3 的多模态部分推迟，改为**个性化捷径学习**。

**理由**：

1. 书签管理场景中，语音/图片输入需求极低
2. 用户更需要的是一键执行复杂操作（"老规矩"）
3. 个性化学习 ROI 更高

**替代方案**：

```typescript
// src/lib/ai-skills/learning/personalized-shortcuts.ts

export class PersonalizedShortcutLearner {
  /**
   * 学习用户习惯
   */
  async learnShortcut(
    userId: string,
    trigger: string, // "老规矩"
    action: ExecutedAction, // 实际执行的操作序列
  ): Promise<void> {
    // 存储到数据库
    await db.shortcuts.create({
      userId,
      trigger,
      actionSequence: action,
      usageCount: 1,
      lastUsed: new Date(),
    });
  }

  /**
   * 匹配用户捷径
   */
  async matchShortcut(
    userId: string,
    input: string,
  ): Promise<ShortcutMatch | null> {
    const shortcuts = await db.shortcuts.findMany({
      where: { userId },
      orderBy: { usageCount: "desc" },
    });

    // 精确匹配
    const exactMatch = shortcuts.find((s) => s.trigger === input);
    if (exactMatch) {
      return {
        shortcut: exactMatch,
        confidence: 1.0,
      };
    }

    // 模糊匹配（语义相似度）
    const semanticMatches = await this.semanticMatch(input, shortcuts);
    if (semanticMatches[0]?.similarity > 0.85) {
      return semanticMatches[0];
    }

    return null;
  }
}
```

---

## 六、实施路线图调整

```
原计划：
Phase 1 (2周) → Phase 2 (3周) → Phase 3 (4周)

调整后：
Phase 1 (2周) → Phase 1.5 (3周) → Phase 2 (3周) → Phase 3 (4周)
              ↑ 槽位填充        ↑ 延迟优化      ↑ 个性化学习
```

**关键里程碑**：

| 阶段          | 验收标准          | 指标                     |
| ------------- | ----------------- | ------------------------ |
| Phase 1       | 混合意图识别      | 准确率 ≥85%              |
| **Phase 1.5** | **槽位提取**      | **槽位完整率 ≥80%**      |
| Phase 2       | LLM 分类 + 上下文 | 准确率 ≥90%，延迟 <500ms |
| Phase 3       | 个性化学习        | 捷径匹配准确率 ≥85%      |

---

## 七、总结

### 7.1 核心改进点

1. ✅ **槽位填充**：扩展类型定义，LLM 一次调用完成意图+参数
2. ✅ **延迟优化**：快慢道策略 + 流式识别，感官延迟 <200ms
3. ✅ **黄金数据集**：100+ 核心用例，回归测试阻止部署
4. ✅ **推测执行**：风险分级，无副作用操作直接执行
5. ✅ **Phase 3 调整**：多模态 → 个性化学习

### 7.2 下一步行动

1. **立即执行**：Phase 1（混合匹配）按原计划进行
2. **并行准备**：开始设计槽位 Schema（20 个核心意图）
3. **建立基线**：收集当前准确率数据，建立 Golden Dataset（100 用例）
4. **技术预研**：验证流式意图识别的可行性（POC）

---

**文档版本**: v1.0.0  
**最后更新**: 2026-01-09  
**状态**: 待架构组审核
