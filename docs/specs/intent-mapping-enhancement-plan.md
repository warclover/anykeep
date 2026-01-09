# AI 意图映射体系深度优化方案

> **版本**: v1.0.0
> **创建日期**: 2026-01-09
> **状态**: 待审核
> **负责人**: AI 架构组

---

## 一、现状分析

### 1.1 当前架构

```
用户输入
    ↓
┌─────────────────────────────────────────────────────────────┐
│                 意图分类层 (Intent Classification)            │
│  - 37 个意图模式，正则匹配                                      │
│  - 按权重(30-95)排序，O(n) 线性扫描                             │
│  - 输出: { type, subType, confidence, complexity }            │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│                  模式选择层 (Mode Selection)                   │
│  - 45 个 Skill 映射规则                                        │
│  - 5 个通配符兜底                                              │
│  - 输出: { skillId, mode: atomic|orchestration }              │
└─────────────────────────────────────────────────────────────┘
    ↓
┌──────────────────┐         ┌──────────────────────────────┐
│   Atomic 模式     │         │    Orchestration 模式         │
│   KnowledgeAgent │         │    OrchestrationEngine       │
│   直接调用 Tools  │         │    多步骤 Skill 执行          │
└──────────────────┘         └──────────────────────────────┘
    ↓                               ↓
┌─────────────────────────────────────────────────────────────┐
│                      工具层 (Tool Layer)                      │
│                        78 个 Tools                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心痛点

| 维度         | 痛点                                        | 影响       | 严重度 |
| ------------ | ------------------------------------------- | ---------- | ------ |
| **准确性**   | 正则匹配无法理解语义，同义词/变体表达易误判 | 用户体验差 | 🔴 高  |
| **灵活性**   | 新增意图需手动添加模式，无法自学习          | 迭代效率低 | 🔴 高  |
| **智能度**   | 无上下文感知，相同输入总是相同结果          | 交互僵硬   | 🟡 中  |
| **可解释性** | 用户不知道 AI 为何这样理解                  | 信任度低   | 🟡 中  |
| **容错性**   | 低置信度时直接兜底，无消歧机制              | 错误操作   | 🟡 中  |

### 1.3 关键指标基线

| 指标           | 当前值      | 目标值  | 说明             |
| -------------- | ----------- | ------- | ---------------- |
| 意图识别准确率 | ~75% (估)   | >90%    | 正确识别用户意图 |
| 首次成功率     | ~60% (估)   | >85%    | 一次对话完成任务 |
| 平均交互轮次   | 2.5 轮 (估) | <1.5 轮 | 完成任务所需轮次 |
| 映射覆盖率     | 100%        | 100%    | 保持完整覆盖     |
| 响应延迟       | ~200ms      | <150ms  | 意图识别延迟     |

---

## 二、优化目标

### 2.1 核心目标

> **让 AI 真正"理解"用户，而不只是"匹配"关键词**

### 2.2 分层目标

| 层级           | 目标                       | 关键结果                       |
| -------------- | -------------------------- | ------------------------------ |
| **意图理解**   | 从关键词匹配升级为语义理解 | 准确率 >90%，支持口语化表达    |
| **上下文感知** | 结合对话历史和用户状态     | 同一输入在不同上下文有不同响应 |
| **智能路由**   | 动态选择最优执行路径       | 减少误触发编排 Skill 30%       |
| **自适应学习** | 从用户反馈中持续优化       | 新意图自动识别率 >70%          |
| **透明可解释** | 让用户理解 AI 的决策       | 可展示意图识别理由             |

---

## 三、架构演进方案

### 3.1 目标架构

```
用户输入
    ↓
┌─────────────────────────────────────────────────────────────┐
│              语义理解层 (Semantic Understanding)              │
│  Phase 1: 混合匹配（规则 + Embedding 相似度）                   │
│  Phase 2: LLM 意图分类（轻量模型）                              │
│  Phase 3: 多模态理解（文本 + 图片 + 语音）                       │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              上下文增强层 (Context Enhancement)               │
│  - 对话历史摘要                                               │
│  - 用户状态注入（收藏数量、最近操作、偏好）                       │
│  - 意图消歧（多候选时主动询问）                                  │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              智能路由层 (Intelligent Routing)                 │
│  - 动态复杂度评估                                             │
│  - 执行路径优化（跳过不必要步骤）                                │
│  - 风险预评估                                                 │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              自适应学习层 (Adaptive Learning)                  │
│  - 用户反馈收集（隐式 + 显式）                                  │
│  - 意图模式自动发现                                            │
│  - 映射规则动态调整                                            │
└─────────────────────────────────────────────────────────────┘
    ↓
┌──────────────────┐         ┌──────────────────────────────┐
│   Atomic 模式     │         │    Orchestration 模式         │
└──────────────────┘         └──────────────────────────────┘
    ↓                               ↓
┌─────────────────────────────────────────────────────────────┐
│                      工具层 (Tool Layer)                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 演进路线图

```
          Phase 1              Phase 2              Phase 3
        (2 周)               (3 周)               (4 周)
    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
    │  混合意图识别   │ → │  LLM 意图分类   │ → │  自适应学习    │
    │  + 映射验证    │    │  + 上下文感知   │    │  + 多模态理解  │
    └───────────────┘    └───────────────┘    └───────────────┘
         MVP                 增强版                完整版
```

---

## 四、Phase 1: 混合意图识别（2 周）

### 4.1 目标

- 意图识别准确率从 ~75% 提升到 ~85%
- 支持口语化、模糊表达
- 不增加显著延迟（<50ms）

### 4.2 技术方案

#### 4.2.1 Embedding 相似度匹配

**原理**：将意图模式和用户输入都转换为向量，通过余弦相似度匹配

```typescript
// 新增文件: src/lib/ai-skills/router/semantic-intent-matcher.ts

interface IntentEmbedding {
  type: string;
  subType: string;
  embedding: number[]; // 768 维向量
  examples: string[]; // 训练样本
}

export class SemanticIntentMatcher {
  private embeddings: Map<string, IntentEmbedding>;
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddings = new Map();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * 预计算所有意图的 Embedding
   * 在应用启动时执行一次
   */
  async precomputeEmbeddings(): Promise<void> {
    for (const pattern of INTENT_PATTERNS) {
      const examples = this.generateExamples(pattern);
      const embedding = await this.embeddingService.embed(examples.join(" "));

      this.embeddings.set(`${pattern.type}:${pattern.subType}`, {
        type: pattern.type,
        subType: pattern.subType,
        embedding,
        examples,
      });
    }
  }

  /**
   * 语义匹配
   */
  async match(input: string): Promise<SemanticMatch[]> {
    const inputEmbedding = await this.embeddingService.embed(input);

    const matches: SemanticMatch[] = [];
    for (const [key, intent] of this.embeddings) {
      const similarity = cosineSimilarity(inputEmbedding, intent.embedding);
      if (similarity > 0.7) {
        // 阈值
        matches.push({
          type: intent.type,
          subType: intent.subType,
          similarity,
          method: "semantic",
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 为意图生成训练样本
   */
  private generateExamples(pattern: IntentPattern): string[] {
    // 基于 pattern.pattern 的正则生成变体
    const baseExamples = pattern.pattern.split("|");
    const expanded: string[] = [];

    for (const base of baseExamples) {
      expanded.push(base);
      // 添加口语化变体
      expanded.push(`帮我${base}`);
      expanded.push(`我想${base}`);
      expanded.push(`能不能${base}`);
      expanded.push(`${base}一下`);
    }

    return expanded;
  }
}
```

#### 4.2.2 混合匹配策略

```typescript
// 新增文件: src/lib/ai-skills/router/hybrid-intent-classifier.ts

export class HybridIntentClassifier {
  private ruleClassifier: IntentClassifier; // 现有规则分类器
  private semanticMatcher: SemanticIntentMatcher; // 新增语义匹配器

  /**
   * 混合分类策略
   * 1. 先尝试规则匹配（快速）
   * 2. 置信度不足时使用语义匹配（精准）
   * 3. 综合两者结果
   */
  async classify(
    input: string,
    context: ClassificationContext,
  ): Promise<IntentMatch> {
    // 1. 规则匹配
    const ruleMatch = this.ruleClassifier.classify(input);

    // 高置信度直接返回
    if (ruleMatch.confidence >= 0.85) {
      return {
        ...ruleMatch,
        method: "rule",
        debugInfo: { ruleConfidence: ruleMatch.confidence },
      };
    }

    // 2. 语义匹配
    const semanticMatches = await this.semanticMatcher.match(input);

    // 3. 融合结果
    return this.fuseResults(ruleMatch, semanticMatches, input);
  }

  /**
   * 结果融合策略
   */
  private fuseResults(
    ruleMatch: IntentMatch,
    semanticMatches: SemanticMatch[],
    input: string,
  ): IntentMatch {
    // 如果规则和语义匹配结果一致，提升置信度
    const topSemantic = semanticMatches[0];

    if (
      topSemantic &&
      ruleMatch.type === topSemantic.type &&
      ruleMatch.subType === topSemantic.subType
    ) {
      return {
        ...ruleMatch,
        confidence: Math.min(
          0.95,
          ruleMatch.confidence + topSemantic.similarity * 0.2,
        ),
        method: "hybrid_agree",
      };
    }

    // 如果语义匹配明显更优，使用语义结果
    if (topSemantic && topSemantic.similarity > ruleMatch.confidence + 0.15) {
      return {
        type: topSemantic.type,
        subType: topSemantic.subType,
        confidence: topSemantic.similarity,
        complexity: this.inferComplexity(topSemantic.type, topSemantic.subType),
        method: "semantic",
      };
    }

    // 否则使用规则匹配结果
    return {
      ...ruleMatch,
      method: "rule",
    };
  }
}
```

#### 4.2.3 映射验证工具

```typescript
// 新增文件: scripts/validate-intent-mappings.ts

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: CoverageReport;
}

export async function validateMappings(): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. 检查意图→映射完整性
  for (const pattern of INTENT_PATTERNS) {
    const key = `${pattern.type}:${pattern.subType}`;
    const mapping = findMapping(
      getMappingIndex(),
      pattern.type,
      pattern.subType,
    );

    if (!mapping) {
      errors.push({
        type: "MISSING_MAPPING",
        message: `意图 ${key} 缺少 Skill 映射`,
        severity: "error",
      });
    }
  }

  // 2. 检查映射→Skill 实现
  for (const mapping of SKILL_MAPPINGS) {
    if (mapping.mode === "orchestration") {
      const skill = orchestrationSkillRegistry.get(mapping.skillId);
      if (!skill) {
        errors.push({
          type: "MISSING_SKILL",
          message: `编排 Skill ${mapping.skillId} 未实现`,
          severity: "error",
        });
      }
    }
  }

  // 3. 检查原子映射的 Tool 存在性
  for (const mapping of SKILL_MAPPINGS) {
    if (mapping.mode === "atomic" && mapping.skillId !== "chat") {
      // 建议：原子模式应直接指定 toolId
      if (!mapping.toolId) {
        warnings.push({
          type: "IMPLICIT_TOOL",
          message: `原子映射 ${mapping.key} 未显式指定 toolId，依赖 AI 推断`,
          severity: "warning",
        });
      }
    }
  }

  // 4. 检查权重冲突
  const weightGroups = groupBy(INTENT_PATTERNS, "weight");
  for (const [weight, patterns] of Object.entries(weightGroups)) {
    if (patterns.length > 3) {
      warnings.push({
        type: "WEIGHT_COLLISION",
        message: `权重 ${weight} 有 ${patterns.length} 个意图，可能导致歧义`,
        severity: "warning",
      });
    }
  }

  // 5. 检查通配符覆盖
  const types = new Set(INTENT_PATTERNS.map((p) => p.type));
  for (const type of types) {
    const hasWildcard = SKILL_MAPPINGS.some((m) => m.key === `${type}:*`);
    if (!hasWildcard) {
      warnings.push({
        type: "NO_WILDCARD",
        message: `意图类型 ${type} 缺少通配符兜底`,
        severity: "warning",
      });
    }
  }

  // 6. 生成覆盖率报告
  const coverage = generateCoverageReport();

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverage,
  };
}

// 在 CI 中运行
// npm run validate:mappings
```

### 4.3 实施计划

| 天数 | 任务                        | 产出                   |
| ---- | --------------------------- | ---------------------- |
| D1-2 | 实现 SemanticIntentMatcher  | 语义匹配器             |
| D3-4 | 实现 HybridIntentClassifier | 混合分类器             |
| D5   | 集成到 UnifiedEngine        | 替换现有分类器         |
| D6-7 | 实现映射验证工具            | validate-mappings 脚本 |
| D8-9 | 编写测试用例                | 50+ 单元测试           |
| D10  | 性能优化与调优              | 延迟 <50ms             |

### 4.4 预期收益

| 指标           | 当前 | Phase 1 后 | 提升 |
| -------------- | ---- | ---------- | ---- |
| 意图识别准确率 | ~75% | ~85%       | +13% |
| 口语化支持     | 差   | 良好       | -    |
| 映射验证       | 无   | 自动化     | -    |

---

## 五、Phase 2: LLM 意图分类 + 上下文感知（3 周）

### 5.1 目标

- 意图识别准确率提升到 >90%
- 支持上下文相关的意图理解
- 实现意图消歧机制

### 5.2 技术方案

#### 5.2.1 轻量 LLM 意图分类

**设计原则**：使用小模型（如 deepseek-chat）做意图分类，避免高延迟

```typescript
// 新增文件: src/lib/ai-skills/router/llm-intent-classifier.ts

const INTENT_CLASSIFICATION_PROMPT = `你是一个意图分类专家。根据用户输入，从以下意图类型中选择最匹配的：

## 意图类型
${INTENT_TYPES_DESCRIPTION}

## 用户输入
"{input}"

## 对话上下文
{context}

## 输出格式（JSON）
{
  "type": "意图类型",
  "subType": "子类型",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由（简短）",
  "alternatives": [{ "type": "...", "subType": "...", "confidence": ... }]
}`;

export class LLMIntentClassifier {
  private llm: LLMProvider;
  private cache: LRUCache<string, IntentMatch>;

  constructor() {
    this.llm = new LLMProvider({ model: "deepseek-chat", temperature: 0 });
    this.cache = new LRUCache({ max: 1000, ttl: 5 * 60 * 1000 }); // 5分钟缓存
  }

  async classify(
    input: string,
    context: ConversationContext,
  ): Promise<LLMIntentResult> {
    // 1. 检查缓存（相同输入+上下文）
    const cacheKey = this.buildCacheKey(input, context);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 2. 构建 Prompt
    const prompt = this.buildPrompt(input, context);

    // 3. LLM 调用
    const response = await this.llm.complete(prompt, {
      maxTokens: 200,
      timeout: 3000, // 3秒超时
    });

    // 4. 解析结果
    const result = this.parseResponse(response);

    // 5. 缓存
    this.cache.set(cacheKey, result);

    return result;
  }

  private buildPrompt(input: string, context: ConversationContext): string {
    // 提取关键上下文
    const contextSummary = [
      context.lastIntent ? `上一轮意图: ${context.lastIntent}` : "",
      context.selectedBookmarks?.length
        ? `已选中 ${context.selectedBookmarks.length} 条书签`
        : "",
      context.currentFolder ? `当前文件夹: ${context.currentFolder}` : "",
      context.recentActions?.length
        ? `最近操作: ${context.recentActions.slice(0, 3).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return INTENT_CLASSIFICATION_PROMPT.replace("{input}", input).replace(
      "{context}",
      contextSummary || "无",
    );
  }
}
```

#### 5.2.2 上下文增强管道

```typescript
// 新增文件: src/lib/ai-skills/context/intent-context-enhancer.ts

export class IntentContextEnhancer {
  /**
   * 增强意图分类的上下文
   */
  async enhance(
    baseMatch: IntentMatch,
    context: ConversationContext,
  ): Promise<EnhancedIntentMatch> {
    // 1. 指代消解
    const resolvedInput = await this.resolveReferences(
      context.currentInput,
      context,
    );

    // 2. 上下文相关度评估
    const contextRelevance = this.evaluateContextRelevance(baseMatch, context);

    // 3. 动态复杂度调整
    const adjustedComplexity = this.adjustComplexity(
      baseMatch.complexity,
      context,
    );

    // 4. 候选意图过滤
    const filteredAlternatives = this.filterByContext(
      baseMatch.alternatives,
      context,
    );

    return {
      ...baseMatch,
      resolvedInput,
      contextRelevance,
      complexity: adjustedComplexity,
      alternatives: filteredAlternatives,
      contextFactors: {
        hasSelection: context.selectedBookmarks?.length > 0,
        hasRecentSearch: !!context.lastSearchResults,
        sessionTurnCount: context.turnCount,
      },
    };
  }

  /**
   * 指代消解
   * "这些" → 选中的书签
   * "那个" → 上一条提到的
   * "刚才的" → 最近操作的
   */
  private async resolveReferences(
    input: string,
    context: ConversationContext,
  ): Promise<string> {
    let resolved = input;

    // "这些/这几个" → 选中项
    if (/这些|这几个/.test(input) && context.selectedBookmarks?.length) {
      resolved = resolved.replace(
        /这些|这几个/g,
        `选中的 ${context.selectedBookmarks.length} 条书签`,
      );
    }

    // "那个/那篇" → 上文提到的
    if (/那个|那篇/.test(input) && context.lastMentionedBookmark) {
      resolved = resolved.replace(
        /那个|那篇/g,
        `「${context.lastMentionedBookmark.title}」`,
      );
    }

    // "刚才的/上次的" → 最近操作
    if (/刚才的|上次的/.test(input) && context.lastActionResult) {
      resolved = resolved.replace(
        /刚才的|上次的/g,
        `上次操作的 ${context.lastActionResult.affectedCount} 条`,
      );
    }

    return resolved;
  }

  /**
   * 动态复杂度调整
   */
  private adjustComplexity(
    baseComplexity: Complexity,
    context: ConversationContext,
  ): Complexity {
    // 选中项多于 50 条，提升复杂度
    if (context.selectedBookmarks?.length > 50) {
      return this.increaseComplexity(baseComplexity);
    }

    // 用户是新手（交互少于 10 轮），降低复杂度
    if (context.totalInteractions < 10) {
      return this.decreaseComplexity(baseComplexity);
    }

    return baseComplexity;
  }
}
```

#### 5.2.3 意图消歧机制

```typescript
// 新增文件: src/lib/ai-skills/router/intent-disambiguator.ts

export class IntentDisambiguator {
  /**
   * 判断是否需要消歧
   */
  needsDisambiguation(match: IntentMatch): boolean {
    // 条件 1: 置信度在模糊区间
    if (match.confidence >= 0.5 && match.confidence < 0.75) {
      // 条件 2: 有高置信度的备选项
      const hasStrongAlternative = match.alternatives?.some(
        (alt) => alt.confidence > match.confidence - 0.1,
      );

      return hasStrongAlternative;
    }

    return false;
  }

  /**
   * 生成消歧问题
   */
  generateDisambiguationQuestion(match: IntentMatch): DisambiguationQuestion {
    const options = [
      {
        label: this.getIntentLabel(match.type, match.subType),
        value: `${match.type}:${match.subType}`,
        description: this.getIntentDescription(match.type, match.subType),
      },
      ...match.alternatives.slice(0, 2).map((alt) => ({
        label: this.getIntentLabel(alt.type, alt.subType),
        value: `${alt.type}:${alt.subType}`,
        description: this.getIntentDescription(alt.type, alt.subType),
      })),
    ];

    return {
      type: "disambiguation",
      question: "我不太确定您的意思，您是想要：",
      options,
      allowCustomInput: true,
      timeout: 30000, // 30秒超时，超时后使用最高置信度
    };
  }

  /**
   * 获取意图的用户友好标签
   */
  private getIntentLabel(type: string, subType: string): string {
    const labels: Record<string, Record<string, string>> = {
      organize: {
        cleanup: "整理收藏",
        dedupe: "清理重复",
        classify: "自动分类",
        tag: "智能标签",
      },
      create: {
        digest: "生成摘要",
        export: "导出数据",
        md_collection: "保存为笔记",
      },
      // ... 其他
    };

    return labels[type]?.[subType] || `${type}:${subType}`;
  }
}
```

### 5.3 实施计划

| 周  | 任务             | 产出                  |
| --- | ---------------- | --------------------- |
| W1  | LLM 意图分类器   | LLMIntentClassifier   |
| W1  | 分类 Prompt 调优 | 准确率 >88%           |
| W2  | 上下文增强管道   | IntentContextEnhancer |
| W2  | 指代消解         | 支持 "这些/那个/刚才" |
| W3  | 意图消歧机制     | IntentDisambiguator   |
| W3  | 集成测试与调优   | E2E 测试通过          |

### 5.4 预期收益

| 指标           | Phase 1 后 | Phase 2 后 | 提升 |
| -------------- | ---------- | ---------- | ---- |
| 意图识别准确率 | ~85%       | >90%       | +6%  |
| 上下文理解     | 无         | 支持       | -    |
| 消歧成功率     | N/A        | >80%       | -    |
| 首次成功率     | ~70%       | >80%       | +14% |

---

## 六、Phase 3: 自适应学习 + 多模态（4 周）

### 6.1 目标

- 系统能从用户反馈中学习
- 自动发现新的意图模式
- 支持图片、语音等多模态输入

### 6.2 技术方案

#### 6.2.1 用户反馈收集

```typescript
// 新增文件: src/lib/ai-skills/learning/feedback-collector.ts

export interface UserFeedback {
  sessionId: string;
  turnId: string;
  originalInput: string;
  predictedIntent: IntentMatch;
  actualBehavior: "accepted" | "corrected" | "abandoned";
  correctedIntent?: string; // 用户纠正后的意图
  timestamp: Date;
}

export class FeedbackCollector {
  /**
   * 隐式反馈：根据用户行为推断
   */
  collectImplicitFeedback(
    intent: IntentMatch,
    action: UserAction,
  ): UserFeedback {
    let behavior: "accepted" | "corrected" | "abandoned";

    if (action.type === "execute_success") {
      behavior = "accepted";
    } else if (action.type === "cancel" || action.type === "retry_different") {
      behavior = "abandoned";
    } else if (action.type === "manual_correction") {
      behavior = "corrected";
    }

    return {
      sessionId: action.sessionId,
      turnId: action.turnId,
      originalInput: action.originalInput,
      predictedIntent: intent,
      actualBehavior: behavior,
      correctedIntent: action.correctedIntent,
      timestamp: new Date(),
    };
  }

  /**
   * 显式反馈：用户主动评价
   */
  collectExplicitFeedback(
    sessionId: string,
    turnId: string,
    rating: "helpful" | "not_helpful",
    comment?: string,
  ): void {
    // 存储到数据库
  }
}
```

#### 6.2.2 意图模式自动发现

```typescript
// 新增文件: src/lib/ai-skills/learning/pattern-discoverer.ts

export class IntentPatternDiscoverer {
  /**
   * 分析失败案例，发现新模式
   */
  async discoverNewPatterns(
    feedbacks: UserFeedback[],
  ): Promise<SuggestedPattern[]> {
    // 1. 筛选失败案例
    const failedCases = feedbacks.filter(
      (f) =>
        f.actualBehavior === "abandoned" || f.actualBehavior === "corrected",
    );

    // 2. 聚类相似输入
    const clusters = await this.clusterSimilarInputs(
      failedCases.map((f) => f.originalInput),
    );

    // 3. 使用 LLM 提取模式
    const suggestions: SuggestedPattern[] = [];
    for (const cluster of clusters) {
      if (cluster.size >= 5) {
        // 至少 5 个相似案例
        const pattern = await this.extractPatternFromCluster(cluster);
        if (pattern) {
          suggestions.push(pattern);
        }
      }
    }

    return suggestions;
  }

  /**
   * 使用 LLM 从聚类中提取模式
   */
  private async extractPatternFromCluster(
    cluster: InputCluster,
  ): Promise<SuggestedPattern | null> {
    const prompt = `分析以下用户输入，提取共同的意图模式：

用户输入样本：
${cluster.samples.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

请输出：
1. 意图类型（type）
2. 子类型（subType）
3. 触发词正则表达式（pattern）
4. 建议权重（weight）
5. 置信度（你对这个模式的确信程度）`;

    const response = await this.llm.complete(prompt);
    return this.parsePatternSuggestion(response);
  }
}
```

#### 6.2.3 多模态输入处理

```typescript
// 新增文件: src/lib/ai-skills/multimodal/multimodal-intent-classifier.ts

export class MultimodalIntentClassifier {
  private textClassifier: HybridIntentClassifier;
  private imageAnalyzer: ImageAnalyzer;
  private speechRecognizer: SpeechRecognizer;

  /**
   * 处理多模态输入
   */
  async classify(input: MultimodalInput): Promise<IntentMatch> {
    // 1. 预处理：将多模态转换为文本
    let textInput = input.text || "";

    if (input.image) {
      const imageDescription = await this.imageAnalyzer.describe(input.image);
      textInput += ` [图片内容: ${imageDescription}]`;
    }

    if (input.audio) {
      const transcription = await this.speechRecognizer.transcribe(input.audio);
      textInput = transcription; // 语音优先
    }

    // 2. 使用增强后的文本进行分类
    return this.textClassifier.classify(textInput, input.context);
  }
}
```

### 6.3 实施计划

| 周  | 任务                 | 产出                       |
| --- | -------------------- | -------------------------- |
| W1  | 反馈收集系统         | FeedbackCollector          |
| W1  | 反馈存储（数据库）   | ai_intent_feedback 表      |
| W2  | 模式发现算法         | IntentPatternDiscoverer    |
| W2  | 管理后台（模式审核） | 意图模式管理 UI            |
| W3  | 多模态预处理         | 图片描述、语音转写         |
| W3  | 多模态分类器         | MultimodalIntentClassifier |
| W4  | A/B 测试框架         | 新旧模式对比               |
| W4  | 监控与告警           | 意图准确率仪表盘           |

### 6.4 预期收益

| 指标           | Phase 2 后 | Phase 3 后 | 提升 |
| -------------- | ---------- | ---------- | ---- |
| 意图识别准确率 | >90%       | >95%       | +5%  |
| 新意图发现     | 手动       | 自动建议   | -    |
| 多模态支持     | 无         | 图片+语音  | -    |
| 首次成功率     | >80%       | >90%       | +12% |

---

## 七、数据库设计

### 7.1 新增表结构

```sql
-- 意图反馈表
CREATE TABLE ai_intent_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL,
  turn_id UUID NOT NULL,
  original_input TEXT NOT NULL,
  predicted_type VARCHAR(50) NOT NULL,
  predicted_subtype VARCHAR(50) NOT NULL,
  predicted_confidence DECIMAL(5,4) NOT NULL,
  actual_behavior VARCHAR(20) NOT NULL,  -- accepted, corrected, abandoned
  corrected_type VARCHAR(50),
  corrected_subtype VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_feedback_user (user_id),
  INDEX idx_feedback_behavior (actual_behavior),
  INDEX idx_feedback_predicted (predicted_type, predicted_subtype)
);

-- 意图模式建议表
CREATE TABLE ai_intent_pattern_suggestions (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(50) NOT NULL,
  pattern TEXT NOT NULL,
  weight INTEGER NOT NULL,
  sample_inputs TEXT[] NOT NULL,
  discovery_confidence DECIMAL(5,4) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  UNIQUE (type, subtype, pattern)
);

-- 意图分类缓存表
CREATE TABLE ai_intent_cache (
  id BIGSERIAL PRIMARY KEY,
  input_hash VARCHAR(64) NOT NULL,  -- SHA256(input + context_key)
  intent_type VARCHAR(50) NOT NULL,
  intent_subtype VARCHAR(50) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  method VARCHAR(20) NOT NULL,  -- rule, semantic, llm, hybrid
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- 索引
  UNIQUE (input_hash),
  INDEX idx_cache_expires (expires_at)
);
```

---

## 八、监控与告警

### 8.1 核心指标

| 指标           | 计算方式                | 告警阈值 |
| -------------- | ----------------------- | -------- |
| 意图识别准确率 | accepted / total        | <85%     |
| 消歧触发率     | disambiguations / total | >20%     |
| LLM 调用延迟   | p95 延迟                | >3s      |
| 缓存命中率     | cache_hits / total      | <60%     |
| 新模式发现数   | 每周新增                | <3 个/周 |

### 8.2 监控仪表盘

```typescript
// 新增文件: src/lib/ai-skills/monitoring/intent-metrics.ts

export interface IntentMetrics {
  // 准确率
  accuracy: {
    overall: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
  };

  // 延迟
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };

  // 分布
  distribution: {
    byType: Record<string, number>;
    byComplexity: Record<string, number>;
    byConfidence: { high: number; medium: number; low: number };
  };

  // 失败分析
  failures: {
    abandoned: number;
    corrected: number;
    topFailedInputs: string[];
  };
}
```

---

## 九、风险与缓解

| 风险                 | 影响         | 缓解措施                  |
| -------------------- | ------------ | ------------------------- |
| LLM 调用延迟过高     | 用户体验差   | 3 秒超时 + 回退到规则匹配 |
| LLM 成本失控         | 预算超支     | 缓存 + 降级策略           |
| 自动发现模式质量差   | 误导用户     | 人工审核 + A/B 测试       |
| Embedding 服务不可用 | 语义匹配失效 | 回退到纯规则匹配          |
| 用户隐私泄露         | 法律风险     | 脱敏 + 本地化处理         |

---

## 十、里程碑与验收标准

### Phase 1 验收标准（第 2 周末）

- [ ] 混合意图分类器上线
- [ ] 意图识别准确率 ≥85%（测试集）
- [ ] 映射验证工具集成到 CI
- [ ] 响应延迟 <100ms（p95）

### Phase 2 验收标准（第 5 周末）

- [ ] LLM 意图分类上线
- [ ] 上下文感知支持指代消解
- [ ] 消歧机制上线，成功率 >80%
- [ ] 首次成功率 ≥80%

### Phase 3 验收标准（第 9 周末）

- [ ] 反馈收集系统上线
- [ ] 每周自动发现 ≥3 个有效模式
- [ ] 多模态支持（图片+语音）
- [ ] 意图识别准确率 ≥95%

---

## 十一、资源需求

### 人力

| 阶段    | 前端 | 后端 | AI  | 测试 |
| ------- | ---- | ---- | --- | ---- |
| Phase 1 | 0    | 1    | 0.5 | 0.5  |
| Phase 2 | 0.5  | 1    | 1   | 0.5  |
| Phase 3 | 1    | 1    | 1   | 1    |

### 基础设施

| 资源           | Phase 1 | Phase 2        | Phase 3         |
| -------------- | ------- | -------------- | --------------- |
| Embedding 服务 | ✅ 现有 | ✅ 现有        | ✅ 现有         |
| LLM 调用配额   | -       | +50k tokens/天 | +100k tokens/天 |
| 数据库存储     | +1GB    | +5GB           | +10GB           |
| 语音服务       | -       | -              | 新增            |

---

## 十二、附录

### A. 意图类型完整定义

```typescript
const INTENT_TYPES_DESCRIPTION = `
## 学习类 (learn)
- active_recall_start: 开始主动复习
- review: 知识回顾
- path: 学习路径规划
- plan: 阅读计划

## 整理类 (organize)
- cleanup: 智能整理
- dedupe: 去除重复
- classify: 自动分类
- tag: 智能标签

## 分析类 (analyze)
- report: 周期报告
- insight: 数据洞察
- discover: 相关发现

## 创建类 (create)
- digest: 内容摘要
- export: 数据导出
- share: 分享
- extract: 知识提取
- tts: 语音朗读
- md_collection: 保存为笔记
- smart_list: 创建智能列表
- import: 导入书签

## 查询类 (query)
- search: 搜索
- list: 列表
- count: 统计
- get: 获取详情

## 操作类 (action)
- delete: 删除
- move: 移动
- tag: 打标签
- archive: 归档

## 闲聊类 (chitchat)
- greeting: 问候
- help: 帮助
- thanks: 感谢
`;
```

### B. 测试用例样本

```typescript
// 新增文件: src/lib/ai-skills/router/__tests__/intent-test-cases.ts

export const INTENT_TEST_CASES = [
  // 标准表达
  { input: "整理一下我的收藏", expected: "organize:cleanup" },
  { input: "删除这个书签", expected: "action:delete" },

  // 口语化
  { input: "帮我把收藏弄一弄", expected: "organize:cleanup" },
  { input: "这个不要了", expected: "action:delete" },

  // 指代
  {
    input: "把这些移到工作文件夹",
    expected: "action:move",
    context: { selected: 5 },
  },
  {
    input: "那个文章再看一下",
    expected: "query:get",
    context: { lastMentioned: true },
  },

  // 复合意图
  {
    input: "整理并导出为 Markdown",
    expected: ["organize:cleanup", "create:export"],
  },

  // 边界情况
  { input: "你好", expected: "chitchat:greeting" },
  { input: "随便说说", expected: "chitchat:*" },
];
```

---

**文档版本**: v1.0.0
**最后更新**: 2026-01-09
**下一步**: 提交审核，确认优先级和资源
