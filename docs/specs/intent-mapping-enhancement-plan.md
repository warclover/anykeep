# AI 意图映射体系深度优化方案

> **版本**: v1.1.0
> **创建日期**: 2026-01-09
> **最后更新**: 2026-01-10
> **状态**: 已审核（整合审核建议）
> **负责人**: AI 架构组
>
> **变更记录**:
> | 版本 | 日期 | 变更内容 |
> |------|------|---------|
> | v1.1.0 | 2026-01-10 | 整合审核建议：Slot Filling、Fast/Slow Track、Golden Dataset、Speculative Execution、个性化快捷指令 |
> | v1.0.0 | 2026-01-09 | 初始版本 |
>
> **补充文档**:
>
> - [意图-槽位定义表](./intent-slot-schema.md) - 定义每个意图需要提取哪些参数
> - [回归测试集标准](./regression-test-suite-standard.md) - 100个必须100%通过的"死命令"Case

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
│         语义理解层 (Semantic Understanding + Slot Filling)    │
│  Phase 1: 混合匹配（规则 + Embedding 相似度）+ 槽位提取          │
│  Phase 2: LLM 意图+槽位联合分类（轻量模型）                       │
│  Phase 3: 个性化快捷指令学习                                    │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              上下文增强层 (Context Enhancement)               │
│  - 对话历史摘要                                               │
│  - 用户状态注入（收藏数量、最近操作、偏好）                       │
│  - Speculative Execution + Undo（替代主动询问）                 │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              智能路由层 (Intelligent Routing)                 │
│  - Fast Track: 规则匹配 ≤200ms                               │
│  - Slow Track: LLM 分类 ≤1500ms                              │
│  - 风险预评估                                                 │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│            个性化学习层 (Personalized Learning)               │
│  - 用户反馈收集（隐式 + 显式）                                  │
│  - 个性化快捷指令学习（替代多模态）                              │
│  - 映射规则动态调整                                            │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              Golden Dataset 门禁 (Quality Gate)               │
│  - 30 Critical Cases: 必须 100% 通过                          │
│  - 50 Important Cases: 必须 95% 通过                          │
│  - CI/CD 自动验证                                             │
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
    │  混合意图识别   │ → │  LLM 意图分类   │ → │  个性化学习    │
    │  + Slot 提取   │    │  + Fast/Slow  │    │  + 快捷指令    │
    │  + Golden门禁  │    │  + Speculative│    │  + 自动发现    │
    └───────────────┘    └───────────────┘    └───────────────┘
         MVP                 增强版                完整版
```

> **重要设计决策**（基于审核建议）:
>
> 1. **Slot Filling 前置**: 意图分类与参数提取同步进行，避免二次调用
> 2. **Fast/Slow Track**: 规则匹配 ≤200ms，LLM ≤1500ms，总体控制在 2s 内
> 3. **Golden Dataset 门禁**: 30 Critical + 50 Important Cases，发版前必须通过
> 4. **Speculative Execution**: 中等置信度时先执行再提供 Undo，减少交互轮次
> 5. **个性化快捷指令**: 替代多模态，专注文本理解的深度优化

---

## 四、Phase 1: 混合意图识别 + Slot Filling（2 周）

### 4.1 目标

- 意图识别准确率从 ~75% 提升到 ~85%
- **同步提取槽位参数**，避免二次解析
- 支持口语化、模糊表达
- 不增加显著延迟（<200ms for Fast Track）
- **建立 Golden Dataset 门禁**，确保核心 Case 100% 通过

### 4.2 技术方案

#### 4.2.1 意图 + 槽位联合提取

> 详细槽位定义请参考 [intent-slot-schema.md](./intent-slot-schema.md)

```typescript
// 新增文件: src/lib/ai-skills/router/intent-with-slots.ts

/**
 * 意图 + 槽位联合结构（核心数据模型）
 */
export interface IntentWithSlots {
  // 意图分类
  type: IntentType;
  subType: string;
  confidence: number;

  // 槽位提取
  slots: Record<string, unknown>;
  missingRequiredSlots: string[];
  ambiguousSlots: AmbiguousSlot[];

  // 调试信息
  method: "rule" | "semantic" | "llm" | "hybrid";
  reasoning?: string;
}

interface AmbiguousSlot {
  slot: string;
  candidates: string[];
  question: string; // 用于消歧时的问题
}

/**
 * 槽位提取器
 */
export class SlotExtractor {
  private slotSchema: SlotSchemaRegistry;

  /**
   * 从用户输入中提取槽位
   */
  extract(
    input: string,
    intentType: string,
    intentSubType: string,
    context: ConversationContext,
  ): ExtractedSlots {
    const schema = this.slotSchema.get(intentType, intentSubType);
    if (!schema) {
      return { slots: {}, missing: [], ambiguous: [] };
    }

    const slots: Record<string, unknown> = {};
    const missing: string[] = [];
    const ambiguous: AmbiguousSlot[] = [];

    // 1. 目标槽位提取
    if (schema.targetSlots) {
      for (const slot of schema.targetSlots) {
        const value = this.extractTargetSlot(input, slot, context);
        if (value) {
          slots[slot.name] = value;
        } else if (slot.required) {
          missing.push(slot.name);
        }
      }
    }

    // 2. 过滤槽位提取
    if (schema.filterSlots) {
      for (const slot of schema.filterSlots) {
        const value = this.extractFilterSlot(input, slot);
        if (value) {
          slots[slot.name] = value;
        }
      }
    }

    // 3. 位置槽位提取
    if (schema.locationSlots) {
      for (const slot of schema.locationSlots) {
        const value = this.extractLocationSlot(input, slot, context);
        if (value) {
          slots[slot.name] = value;
        }
      }
    }

    return { slots, missing, ambiguous };
  }

  /**
   * 提取目标槽位（书签ID、文件夹等）
   */
  private extractTargetSlot(
    input: string,
    slot: SlotDefinition,
    context: ConversationContext,
  ): unknown {
    // 指代消解："这些" → 选中的书签
    if (/这些|这几个|选中的/.test(input) && context.selectedBookmarks?.length) {
      return context.selectedBookmarks.map((b) => b.id);
    }

    // "那个/那篇" → 上文提到的
    if (/那个|那篇/.test(input) && context.lastMentionedBookmark) {
      return [context.lastMentionedBookmark.id];
    }

    // 数字引用："第3条" → 搜索结果第3条
    const indexMatch = input.match(/第(\d+)条/);
    if (indexMatch && context.lastSearchResults) {
      const index = parseInt(indexMatch[1]) - 1;
      const bookmark = context.lastSearchResults[index];
      if (bookmark) {
        return [bookmark.id];
      }
    }

    return null;
  }

  /**
   * 提取过滤槽位（时间范围、平台、标签等）
   */
  private extractFilterSlot(input: string, slot: SlotDefinition): unknown {
    switch (slot.name) {
      case "timeRange":
        return this.parseTimeRange(input);
      case "platform":
        return this.parsePlatform(input);
      case "tags":
        return this.parseTags(input);
      case "limit":
        return this.parseLimit(input);
      default:
        return null;
    }
  }

  /**
   * 解析时间范围
   * "最近" → 7天, "本周" → 本周, "上个月" → 上月
   */
  private parseTimeRange(input: string): TimeRange | null {
    const patterns: [RegExp, () => TimeRange][] = [
      [/最近|近期/, () => ({ type: "relative", days: 7 })],
      [/今天/, () => ({ type: "relative", days: 1 })],
      [/本周/, () => ({ type: "thisWeek" })],
      [/上周/, () => ({ type: "lastWeek" })],
      [/本月/, () => ({ type: "thisMonth" })],
      [/上个?月/, () => ({ type: "lastMonth" })],
      [/(\d+)天内/, (m) => ({ type: "relative", days: parseInt(m[1]) })],
    ];

    for (const [pattern, factory] of patterns) {
      const match = input.match(pattern);
      if (match) {
        return factory(match);
      }
    }
    return null;
  }

  /**
   * 解析平台
   */
  private parsePlatform(input: string): string[] | null {
    const platforms: [RegExp, string][] = [
      [/微信|公众号/, "wechat"],
      [/B站|bilibili|哔哩/, "bilibili"],
      [/小红书/, "xiaohongshu"],
      [/知乎/, "zhihu"],
      [/掘金/, "juejin"],
      [/GitHub|github/, "github"],
      [/Twitter|推特|X/, "twitter"],
    ];

    const found: string[] = [];
    for (const [pattern, platform] of platforms) {
      if (pattern.test(input)) {
        found.push(platform);
      }
    }
    return found.length > 0 ? found : null;
  }
}
```

#### 4.2.2 混合匹配策略 + Fast/Slow Track

```typescript
// 新增文件: src/lib/ai-skills/router/hybrid-intent-classifier.ts

/**
 * Fast Track 配置
 */
const FAST_TRACK_CONFIG = {
  maxLatency: 200, // ms
  minConfidence: 0.85, // 高置信度直接返回
};

/**
 * Slow Track 配置
 */
const SLOW_TRACK_CONFIG = {
  maxLatency: 1500, // ms
  enableLLM: true,
  fallbackToFast: true, // 超时回退到 Fast 结果
};

export class HybridIntentClassifier {
  private ruleClassifier: IntentClassifier; // 现有规则分类器
  private semanticMatcher: SemanticIntentMatcher; // 语义匹配器
  private slotExtractor: SlotExtractor; // 槽位提取器

  /**
   * 混合分类策略（Fast/Slow Track）
   * 1. Fast Track: 规则匹配 + 槽位提取（≤200ms）
   * 2. Slow Track: 语义匹配 + LLM 验证（≤1500ms）
   */
  async classify(
    input: string,
    context: ClassificationContext,
  ): Promise<IntentWithSlots> {
    const startTime = Date.now();

    // ========== Fast Track ==========
    const ruleMatch = this.ruleClassifier.classify(input);
    const slots = this.slotExtractor.extract(
      input,
      ruleMatch.type,
      ruleMatch.subType,
      context,
    );

    // 高置信度 + 槽位完整 → 直接返回
    if (
      ruleMatch.confidence >= FAST_TRACK_CONFIG.minConfidence &&
      slots.missing.length === 0
    ) {
      return {
        ...ruleMatch,
        slots: slots.slots,
        missingRequiredSlots: [],
        ambiguousSlots: slots.ambiguous,
        method: "rule",
      };
    }

    // ========== Slow Track（异步启动）==========
    const slowTrackPromise = this.runSlowTrack(input, ruleMatch, context);

    // 设置超时
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SLOW_TRACK_CONFIG.maxLatency),
    );

    const slowResult = await Promise.race([slowTrackPromise, timeoutPromise]);

    // 超时回退到 Fast 结果
    if (!slowResult) {
      return {
        ...ruleMatch,
        slots: slots.slots,
        missingRequiredSlots: slots.missing,
        ambiguousSlots: slots.ambiguous,
        method: "rule",
        reasoning: "Slow track timeout, fallback to rule match",
      };
    }

    return slowResult;
  }

  /**
   * Slow Track: 语义匹配 + 结果融合
   */
  private async runSlowTrack(
    input: string,
    ruleMatch: IntentMatch,
    context: ClassificationContext,
  ): Promise<IntentWithSlots | null> {
    try {
      // 语义匹配
      const semanticMatches = await this.semanticMatcher.match(input);
      const topSemantic = semanticMatches[0];

      // 融合结果
      if (topSemantic) {
        // 规则和语义一致 → 提升置信度
        if (
          ruleMatch.type === topSemantic.type &&
          ruleMatch.subType === topSemantic.subType
        ) {
          const boostedConfidence = Math.min(
            0.95,
            ruleMatch.confidence + topSemantic.similarity * 0.2,
          );
          const slots = this.slotExtractor.extract(
            input,
            ruleMatch.type,
            ruleMatch.subType,
            context,
          );

          return {
            type: ruleMatch.type,
            subType: ruleMatch.subType,
            confidence: boostedConfidence,
            complexity: ruleMatch.complexity,
            slots: slots.slots,
            missingRequiredSlots: slots.missing,
            ambiguousSlots: slots.ambiguous,
            method: "hybrid",
          };
        }

        // 语义明显更优 → 使用语义结果
        if (topSemantic.similarity > ruleMatch.confidence + 0.15) {
          const slots = this.slotExtractor.extract(
            input,
            topSemantic.type,
            topSemantic.subType,
            context,
          );

          return {
            type: topSemantic.type,
            subType: topSemantic.subType,
            confidence: topSemantic.similarity,
            complexity: this.inferComplexity(
              topSemantic.type,
              topSemantic.subType,
            ),
            slots: slots.slots,
            missingRequiredSlots: slots.missing,
            ambiguousSlots: slots.ambiguous,
            method: "semantic",
          };
        }
      }

      return null; // 使用 Fast Track 结果
    } catch (error) {
      console.warn("Slow track failed:", error);
      return null;
    }
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

#### 4.2.4 Golden Dataset 门禁

> 详细测试用例请参考 [regression-test-suite-standard.md](./regression-test-suite-standard.md)

```typescript
// 新增文件: src/lib/ai-skills/router/__tests__/golden-dataset.ts

import { describe, it, expect } from "vitest";
import { HybridIntentClassifier } from "../hybrid-intent-classifier";

/**
 * Golden Dataset 门禁配置
 */
const RELEASE_GATE = {
  critical: { passRate: 100, maxRegression: 0 },
  important: { passRate: 95, maxRegression: 2 },
  overall: { passRate: 90 },
};

/**
 * Critical Cases (30个) - 必须 100% 通过
 * 任何一个失败都不能发版
 */
const CRITICAL_CASES: TestCase[] = [
  // 搜索意图
  { input: "搜索 React", expected: { type: "query", subType: "search" } },
  {
    input: "找一下关于 AI 的文章",
    expected: { type: "query", subType: "search" },
  },
  {
    input: "有没有 Python 的收藏",
    expected: { type: "query", subType: "search" },
  },

  // 删除意图（高风险）
  { input: "删除这个书签", expected: { type: "action", subType: "delete" } },
  { input: "把这条删掉", expected: { type: "action", subType: "delete" } },

  // 导出意图
  { input: "导出为 Markdown", expected: { type: "create", subType: "export" } },
  { input: "导出所有收藏", expected: { type: "create", subType: "export" } },

  // 整理意图
  { input: "整理一下收藏", expected: { type: "organize", subType: "cleanup" } },
  { input: "帮我分类", expected: { type: "organize", subType: "classify" } },

  // 闲聊意图
  { input: "你好", expected: { type: "chitchat", subType: "greeting" } },
  { input: "谢谢", expected: { type: "chitchat", subType: "thanks" } },

  // ... 更多 Critical Cases
];

/**
 * Important Cases (50个) - 必须 95% 通过
 */
const IMPORTANT_CASES: TestCase[] = [
  // 口语化表达
  {
    input: "帮我把收藏弄一弄",
    expected: { type: "organize", subType: "cleanup" },
  },
  { input: "这个不要了", expected: { type: "action", subType: "delete" } },

  // 指代消解
  {
    input: "把这些移到工作文件夹",
    expected: { type: "action", subType: "move" },
    context: { selectedBookmarks: [{ id: "1" }, { id: "2" }] },
  },

  // 带槽位
  {
    input: "搜索最近一周的收藏",
    expected: {
      type: "query",
      subType: "search",
      slots: { timeRange: { type: "relative", days: 7 } },
    },
  },

  // ... 更多 Important Cases
];

describe("Golden Dataset - Critical Cases", () => {
  const classifier = new HybridIntentClassifier();

  CRITICAL_CASES.forEach((testCase, index) => {
    it(`[C${index + 1}] ${testCase.input}`, async () => {
      const result = await classifier.classify(
        testCase.input,
        testCase.context || {},
      );

      expect(result.type).toBe(testCase.expected.type);
      expect(result.subType).toBe(testCase.expected.subType);

      // 验证槽位（如果指定）
      if (testCase.expected.slots) {
        for (const [key, value] of Object.entries(testCase.expected.slots)) {
          expect(result.slots[key]).toEqual(value);
        }
      }
    });
  });
});

describe("Golden Dataset - Important Cases", () => {
  const classifier = new HybridIntentClassifier();

  IMPORTANT_CASES.forEach((testCase, index) => {
    it(`[I${index + 1}] ${testCase.input}`, async () => {
      const result = await classifier.classify(
        testCase.input,
        testCase.context || {},
      );

      expect(result.type).toBe(testCase.expected.type);
      expect(result.subType).toBe(testCase.expected.subType);
    });
  });
});

/**
 * 发版门禁检查
 */
export function checkReleaseGate(results: TestResults): ReleaseDecision {
  const criticalPassed = results.critical.passed / results.critical.total;
  const importantPassed = results.important.passed / results.important.total;
  const overallPassed =
    (results.critical.passed + results.important.passed) /
    (results.critical.total + results.important.total);

  if (criticalPassed < 1.0) {
    return {
      canRelease: false,
      reason: `Critical cases 通过率 ${(criticalPassed * 100).toFixed(1)}% < 100%`,
      failedCritical: results.critical.failed,
    };
  }

  if (importantPassed < RELEASE_GATE.important.passRate / 100) {
    return {
      canRelease: false,
      reason: `Important cases 通过率 ${(importantPassed * 100).toFixed(1)}% < 95%`,
      failedImportant: results.important.failed,
    };
  }

  return {
    canRelease: true,
    metrics: { criticalPassed, importantPassed, overallPassed },
  };
}
```

### 4.3 实施计划

| 天数 | 任务                        | 产出                       |
| ---- | --------------------------- | -------------------------- |
| D1-2 | 实现 SlotExtractor          | 槽位提取器                 |
| D3-4 | 实现 HybridIntentClassifier | 混合分类器 + Fast/Slow     |
| D5   | 集成到 UnifiedEngine        | 替换现有分类器             |
| D6-7 | 实现 Golden Dataset 门禁    | 30 Critical + 50 Important |
| D8-9 | 编写测试用例 + CI 集成      | 80+ 单元测试               |
| D10  | 性能优化与调优              | Fast ≤200ms, Slow ≤1500ms  |

### 4.4 预期收益

| 指标            | 当前 | Phase 1 后 | 提升 |
| --------------- | ---- | ---------- | ---- |
| 意图识别准确率  | ~75% | ~85%       | +13% |
| 槽位提取覆盖率  | 0%   | ~80%       | 新增 |
| Fast Track 命中 | N/A  | ~70%       | 新增 |
| Golden 门禁通过 | N/A  | 100%       | 新增 |
| 口语化支持      | 差   | 良好       | -    |

---

## 五、Phase 2: LLM 意图分类 + Speculative Execution（3 周）

### 5.1 目标

- 意图识别准确率提升到 >90%
- 支持上下文相关的意图理解
- **Speculative Execution + Undo 替代主动询问**，减少交互轮次
- **LLM Prompt 同时提取意图和槽位**，一次调用完成

### 5.2 技术方案

#### 5.2.1 LLM 意图 + 槽位联合分类

**设计原则**：一次 LLM 调用同时完成意图分类和槽位提取

```typescript
// 新增文件: src/lib/ai-skills/router/llm-intent-classifier.ts

/**
 * LLM 意图 + 槽位联合 Prompt
 */
const INTENT_SLOT_PROMPT = `你是一个智能助手，负责理解用户意图并提取参数。

## 意图类型
${INTENT_TYPES_DESCRIPTION}

## 用户输入
"{input}"

## 对话上下文
{context}

## 输出格式（严格 JSON）
{
  "type": "意图类型",
  "subType": "子类型",
  "confidence": 0.0-1.0,
  "slots": {
    "target": ["书签ID或描述"],
    "timeRange": { "type": "relative", "days": 7 },
    "platform": ["wechat", "bilibili"],
    "tags": ["标签1", "标签2"],
    "folder": "文件夹名",
    "format": "markdown|csv|json|html",
    "limit": 10
  },
  "missingSlots": ["缺失的必填槽位"],
  "reasoning": "判断理由（简短）"
}

注意：
1. slots 中只包含用户明确提到的参数
2. missingSlots 列出该意图必需但用户未提供的参数
3. 如果用户说"这些/那个"，target 填写 "context:selected" 或 "context:last_mentioned"
`;

export class LLMIntentClassifier {
  private llm: LLMProvider;
  private cache: LRUCache<string, IntentWithSlots>;

  constructor() {
    this.llm = new LLMProvider({ model: "deepseek-chat", temperature: 0 });
    this.cache = new LRUCache({ max: 1000, ttl: 5 * 60 * 1000 });
  }

  /**
   * LLM 意图 + 槽位联合分类
   */
  async classify(
    input: string,
    context: ConversationContext,
  ): Promise<IntentWithSlots> {
    // 1. 检查缓存
    const cacheKey = this.buildCacheKey(input, context);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 2. 构建 Prompt
    const prompt = this.buildPrompt(input, context);

    // 3. LLM 调用（Slow Track 超时控制）
    const response = await this.llm.complete(prompt, {
      maxTokens: 300,
      timeout: 1500, // 1.5秒超时（符合 Slow Track）
    });

    // 4. 解析结果
    const result = this.parseResponse(response, context);

    // 5. 缓存
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * 解析 LLM 响应并消解指代
   */
  private parseResponse(
    response: string,
    context: ConversationContext,
  ): IntentWithSlots {
    const parsed = JSON.parse(response);

    // 消解 target 中的指代
    if (parsed.slots?.target) {
      parsed.slots.target = this.resolveTargetReferences(
        parsed.slots.target,
        context,
      );
    }

    return {
      type: parsed.type,
      subType: parsed.subType,
      confidence: parsed.confidence,
      slots: parsed.slots || {},
      missingRequiredSlots: parsed.missingSlots || [],
      ambiguousSlots: [],
      method: "llm",
      reasoning: parsed.reasoning,
    };
  }

  /**
   * 消解 target 槽位中的指代
   */
  private resolveTargetReferences(
    targets: string[],
    context: ConversationContext,
  ): string[] {
    return targets.flatMap((target) => {
      if (target === "context:selected" && context.selectedBookmarks) {
        return context.selectedBookmarks.map((b) => b.id);
      }
      if (
        target === "context:last_mentioned" &&
        context.lastMentionedBookmark
      ) {
        return [context.lastMentionedBookmark.id];
      }
      return [target];
    });
  }
}
```

#### 5.2.2 Speculative Execution + Undo 机制

**设计原则**：中等置信度时先执行再提供撤销，而非询问用户

```typescript
// 新增文件: src/lib/ai-skills/execution/speculative-executor.ts

/**
 * 置信度执行策略
 */
const EXECUTION_STRATEGY = {
  high: { threshold: 0.85, action: "silent_execute" },
  medium: { threshold: 0.6, action: "speculative_execute" },
  low: { threshold: 0, action: "clarify" },
};

/**
 * 风险等级
 */
const RISK_LEVELS: Record<string, "low" | "medium" | "high"> = {
  "query:search": "low",
  "query:list": "low",
  "query:count": "low",
  "action:tag": "medium",
  "action:move": "medium",
  "action:delete": "high",
  "action:batch_delete": "high",
};

export class SpeculativeExecutor {
  private undoStack: UndoAction[] = [];

  /**
   * 根据置信度和风险等级决定执行策略
   */
  async execute(
    intent: IntentWithSlots,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const riskLevel =
      RISK_LEVELS[`${intent.type}:${intent.subType}`] || "medium";
    const strategy = this.determineStrategy(intent.confidence, riskLevel);

    switch (strategy) {
      case "silent_execute":
        // 高置信度：静默执行，完成后简短汇报
        return this.executeSilently(intent, context);

      case "speculative_execute":
        // 中置信度：先执行，提供撤销选项
        return this.executeWithUndo(intent, context);

      case "clarify":
        // 低置信度：轻量级澄清（选项式）
        return this.requestClarification(intent, context);

      case "confirm_required":
        // 高风险操作：必须确认
        return this.requestConfirmation(intent, context);
    }
  }

  /**
   * 确定执行策略
   */
  private determineStrategy(
    confidence: number,
    riskLevel: "low" | "medium" | "high",
  ): ExecutionStrategy {
    // 高风险操作必须确认
    if (riskLevel === "high") {
      return "confirm_required";
    }

    // 高置信度：静默执行
    if (confidence >= EXECUTION_STRATEGY.high.threshold) {
      return "silent_execute";
    }

    // 中置信度：先执行再提供撤销
    if (confidence >= EXECUTION_STRATEGY.medium.threshold) {
      return "speculative_execute";
    }

    // 低置信度：请求澄清
    return "clarify";
  }

  /**
   * 静默执行（高置信度）
   */
  private async executeSilently(
    intent: IntentWithSlots,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const result = await this.doExecute(intent, context);

    return {
      success: true,
      message: this.generateBriefReport(intent, result),
      showUndo: false,
    };
  }

  /**
   * 推测执行 + 撤销选项（中置信度）
   */
  private async executeWithUndo(
    intent: IntentWithSlots,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    // 1. 保存撤销状态
    const undoAction = await this.captureUndoState(intent, context);
    this.undoStack.push(undoAction);

    // 2. 执行操作
    const result = await this.doExecute(intent, context);

    // 3. 返回结果，附带撤销选项
    return {
      success: true,
      message: this.generateReportWithExplanation(intent, result),
      showUndo: true,
      undoId: undoAction.id,
      undoLabel: `撤销 ${this.getActionLabel(intent)}`,
      undoTimeout: 10000, // 10秒内可撤销
    };
  }

  /**
   * 请求澄清（低置信度）- 选项式而非开放问
   */
  private requestClarification(
    intent: IntentWithSlots,
    context: ExecutionContext,
  ): ExecutionResult {
    const alternatives = intent.alternatives?.slice(0, 3) || [];
    const options = [
      {
        label: this.getIntentLabel(intent),
        value: `${intent.type}:${intent.subType}`,
      },
      ...alternatives.map((alt) => ({
        label: this.getIntentLabel(alt),
        value: `${alt.type}:${alt.subType}`,
      })),
    ];

    return {
      success: false,
      requiresClarification: true,
      clarificationQuestion: "您想要：",
      clarificationOptions: options,
      timeout: 30000, // 30秒超时后使用最高置信度
    };
  }

  /**
   * 撤销操作
   */
  async undo(undoId: string): Promise<UndoResult> {
    const undoAction = this.undoStack.find((a) => a.id === undoId);
    if (!undoAction) {
      return { success: false, message: "撤销操作已过期" };
    }

    // 执行撤销
    await undoAction.execute();

    // 从栈中移除
    this.undoStack = this.undoStack.filter((a) => a.id !== undoId);

    return { success: true, message: "已撤销" };
  }
}
```

#### 5.2.3 上下文增强管道

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

| 周  | 任务                    | 产出                  |
| --- | ----------------------- | --------------------- |
| W1  | LLM 意图+槽位联合分类器 | LLMIntentClassifier   |
| W1  | 联合 Prompt 调优        | 意图+槽位准确率 >88%  |
| W2  | Speculative Executor    | 执行策略 + Undo 机制  |
| W2  | 上下文增强管道          | IntentContextEnhancer |
| W3  | 集成测试与调优          | E2E 测试通过          |
| W3  | Golden Dataset 扩展     | 扩展到 100 Cases      |

### 5.4 预期收益

| 指标               | Phase 1 后 | Phase 2 后 | 提升 |
| ------------------ | ---------- | ---------- | ---- |
| 意图识别准确率     | ~85%       | >90%       | +6%  |
| 槽位提取准确率     | ~80%       | >90%       | +12% |
| 上下文理解         | 基础       | 完整       | -    |
| 交互轮次           | 1.5 轮     | 1.2 轮     | -20% |
| Speculative 成功率 | N/A        | >85%       | 新增 |
| 首次成功率         | ~70%       | >85%       | +21% |

---

## 六、Phase 3: 自适应学习 + 个性化快捷指令（4 周）

> **设计决策**：根据审核建议，放弃多模态支持，聚焦文本理解的深度优化和个性化体验。

### 6.1 目标

- 系统能从用户反馈中学习
- 自动发现新的意图模式
- **个性化快捷指令学习**（替代多模态）
- 用户习惯记忆与智能推荐

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

#### 6.2.3 个性化快捷指令学习

> **核心理念**：学习用户的表达习惯，自动生成个性化映射规则

```typescript
// 新增文件: src/lib/ai-skills/learning/personalized-shortcuts.ts

/**
 * 用户快捷指令定义
 */
interface PersonalizedShortcut {
  id: string;
  userId: string;
  trigger: string; // 触发词/短语
  pattern: RegExp; // 匹配模式
  mappedIntent: {
    type: string;
    subType: string;
  };
  mappedSlots: Record<string, unknown>; // 预设槽位
  usageCount: number;
  confidence: number; // 学习置信度
  createdAt: Date;
  lastUsedAt: Date;
}

export class PersonalizedShortcutLearner {
  private shortcuts: Map<string, PersonalizedShortcut[]> = new Map();

  /**
   * 从用户行为中学习快捷指令
   */
  async learnFromBehavior(
    userId: string,
    feedbacks: UserFeedback[],
  ): Promise<PersonalizedShortcut[]> {
    const learned: PersonalizedShortcut[] = [];

    // 1. 分析成功案例的模式
    const successfulCases = feedbacks.filter(
      (f) => f.actualBehavior === "accepted",
    );

    // 2. 识别重复的表达方式
    const expressionGroups = this.groupByExpression(successfulCases);

    for (const [expression, cases] of expressionGroups) {
      // 至少使用 3 次才考虑学习
      if (cases.length >= 3) {
        const shortcut = this.createShortcut(userId, expression, cases);
        if (shortcut.confidence > 0.8) {
          learned.push(shortcut);
        }
      }
    }

    // 3. 持久化
    await this.saveShortcuts(userId, learned);

    return learned;
  }

  /**
   * 使用个性化快捷指令增强分类
   */
  async enhanceClassification(
    userId: string,
    input: string,
    baseMatch: IntentWithSlots,
  ): Promise<IntentWithSlots> {
    const userShortcuts = this.shortcuts.get(userId) || [];

    // 检查是否匹配个性化快捷指令
    for (const shortcut of userShortcuts) {
      if (shortcut.pattern.test(input)) {
        // 使用用户的个性化映射
        return {
          ...baseMatch,
          type: shortcut.mappedIntent.type,
          subType: shortcut.mappedIntent.subType,
          slots: { ...baseMatch.slots, ...shortcut.mappedSlots },
          confidence: Math.max(baseMatch.confidence, shortcut.confidence),
          method: "personalized",
          reasoning: `使用个性化快捷指令: "${shortcut.trigger}"`,
        };
      }
    }

    return baseMatch;
  }

  /**
   * 用户可手动创建快捷指令
   */
  async createCustomShortcut(
    userId: string,
    trigger: string,
    intent: { type: string; subType: string },
    slots?: Record<string, unknown>,
  ): Promise<PersonalizedShortcut> {
    const shortcut: PersonalizedShortcut = {
      id: generateId(),
      userId,
      trigger,
      pattern: new RegExp(escapeRegex(trigger), "i"),
      mappedIntent: intent,
      mappedSlots: slots || {},
      usageCount: 0,
      confidence: 1.0, // 用户手动创建，置信度最高
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    await this.saveShortcut(shortcut);
    return shortcut;
  }

  /**
   * 推荐快捷指令
   */
  async suggestShortcuts(
    userId: string,
    recentBehavior: UserFeedback[],
  ): Promise<ShortcutSuggestion[]> {
    const suggestions: ShortcutSuggestion[] = [];

    // 分析高频操作
    const frequentIntents = this.analyzeFrequentIntents(recentBehavior);

    for (const [intentKey, count] of frequentIntents) {
      if (count >= 5) {
        suggestions.push({
          intent: intentKey,
          suggestedTrigger: this.generateTriggerSuggestion(intentKey),
          reason: `您经常使用此功能（${count}次），建议设置快捷指令`,
        });
      }
    }

    return suggestions;
  }
}

/**
 * 快捷指令管理器（集成到 UnifiedEngine）
 */
export class ShortcutManager {
  private learner: PersonalizedShortcutLearner;

  /**
   * 在意图分类流程中应用个性化快捷指令
   */
  async applyShortcuts(
    userId: string,
    input: string,
    baseMatch: IntentWithSlots,
  ): Promise<IntentWithSlots> {
    // 1. 先检查用户自定义快捷指令
    const enhanced = await this.learner.enhanceClassification(
      userId,
      input,
      baseMatch,
    );

    // 2. 记录使用情况（用于学习）
    if (enhanced.method === "personalized") {
      await this.learner.recordUsage(userId, enhanced);
    }

    return enhanced;
  }
}
```

### 6.3 实施计划

| 周  | 任务               | 产出                        |
| --- | ------------------ | --------------------------- |
| W1  | 反馈收集系统       | FeedbackCollector           |
| W1  | 反馈存储（数据库） | ai_intent_feedback 表       |
| W2  | 模式发现算法       | IntentPatternDiscoverer     |
| W2  | 个性化快捷指令学习 | PersonalizedShortcutLearner |
| W3  | 快捷指令管理 UI    | 设置页面集成                |
| W3  | 快捷指令推荐系统   | ShortcutSuggestion          |
| W4  | A/B 测试框架       | 新旧模式对比                |
| W4  | 监控与告警         | 意图准确率仪表盘            |

### 6.4 预期收益

| 指标           | Phase 2 后 | Phase 3 后 | 提升 |
| -------------- | ---------- | ---------- | ---- |
| 意图识别准确率 | >90%       | >95%       | +5%  |
| 新意图发现     | 手动       | 自动建议   | -    |
| 个性化快捷指令 | N/A        | 支持       | 新增 |
| 用户操作效率   | 基准       | +30%       | 新增 |
| 首次成功率     | >85%       | >92%       | +8%  |

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

| 风险                 | 影响         | 缓解措施                        |
| -------------------- | ------------ | ------------------------------- |
| LLM 调用延迟过高     | 用户体验差   | Fast/Slow Track + 1.5秒超时回退 |
| LLM 成本失控         | 预算超支     | 缓存 + 降级策略                 |
| 自动发现模式质量差   | 误导用户     | 人工审核 + A/B 测试             |
| Embedding 服务不可用 | 语义匹配失效 | 回退到纯规则匹配                |
| 用户隐私泄露         | 法律风险     | 脱敏 + 本地化处理               |
| Golden Dataset 回归  | 阻断发版     | CI 自动检测 + 即时修复机制      |
| Speculative 误操作   | 用户困惑     | 10秒 Undo 窗口 + 操作日志       |

---

## 十、里程碑与验收标准

### Phase 1 验收标准（第 2 周末）

- [ ] 混合意图分类器 + Slot 提取器上线
- [ ] 意图识别准确率 ≥85%（Golden Dataset）
- [ ] 槽位提取覆盖率 ≥80%
- [ ] Golden Dataset 30 Critical Cases 100% 通过
- [ ] Fast Track 响应延迟 <200ms（p95）

### Phase 2 验收标准（第 5 周末）

- [ ] LLM 意图+槽位联合分类上线
- [ ] Speculative Execution + Undo 机制上线
- [ ] 上下文感知支持指代消解
- [ ] Speculative 成功率 >85%
- [ ] 首次成功率 ≥85%

### Phase 3 验收标准（第 9 周末）

- [ ] 反馈收集系统上线
- [ ] 个性化快捷指令学习上线
- [ ] 每周自动发现 ≥3 个有效模式
- [ ] 意图识别准确率 ≥95%
- [ ] 用户操作效率提升 ≥30%

---

## 十一、资源需求

### 人力

| 阶段    | 前端 | 后端 | AI  | 测试 |
| ------- | ---- | ---- | --- | ---- |
| Phase 1 | 0    | 1    | 0.5 | 0.5  |
| Phase 2 | 0.5  | 1    | 1   | 0.5  |
| Phase 3 | 1    | 1    | 0.5 | 1    |

### 基础设施

| 资源           | Phase 1 | Phase 2        | Phase 3         |
| -------------- | ------- | -------------- | --------------- |
| Embedding 服务 | ✅ 现有 | ✅ 现有        | ✅ 现有         |
| LLM 调用配额   | -       | +50k tokens/天 | +100k tokens/天 |
| 数据库存储     | +1GB    | +5GB           | +10GB           |
| 快捷指令存储   | -       | -              | +500MB/用户     |

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
