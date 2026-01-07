# DeepSeek 模型选择规划

> 文档版本：1.1.0
> 创建日期：2026-01-07
> 更新日期：2026-01-07
> 状态：Phase 1 已完成

## 概述

AnyKeep 使用 DeepSeek 作为主要 AI Provider，提供两个模型：

- **deepseek-chat**：通用对话模型，速度快、成本低
- **deepseek-reasoner**：推理增强模型，适合复杂分析、多步规划

本文档规划各功能模块应使用的模型，实现**成本与质量的最佳平衡**。

---

## 模型特点对比

| 特性         | deepseek-chat      | deepseek-reasoner  |
| ------------ | ------------------ | ------------------ |
| **响应速度** | 快（~2s）          | 较慢（~5-15s）     |
| **成本**     | 基准 1x            | 约 4x              |
| **推理能力** | 一般               | 强（多步推理）     |
| **适用场景** | 内容生成、简单问答 | 复杂分析、规划决策 |
| **最大输出** | 8K tokens          | 8K tokens          |

---

## 功能模块分类

### 🟢 使用 deepseek-chat（快速/标准层）

适合：内容生成、格式转换、简单分析

| 模块                            | 功能                | 原因                 | 当前状态       |
| ------------------------------- | ------------------- | -------------------- | -------------- |
| **Knowledge Studio - 内容生成** | 根据大纲生成文章    | 内容创作，非复杂推理 | ✅ 已使用 chat |
| **Knowledge Studio - 大纲生成** | 生成文章大纲        | 结构化输出，模式固定 | ✅ 已使用 chat |
| **Knowledge Studio - 内容精简** | 精简到目标字数      | 编辑任务，非推理     | ✅ 已使用 chat |
| **Knowledge Studio - 风格适配** | 转换为不同平台风格  | 格式转换             | ✅ 已使用 chat |
| **AI Skills - 快速摘要**        | 生成书签摘要        | 信息提取             | ✅ 应使用 chat |
| **AI Skills - 智能标签**        | 自动生成标签        | 分类任务             | ✅ 应使用 chat |
| **AI Skills - 数据导出**        | 格式化导出          | 格式转换             | ✅ 应使用 chat |
| **AI Agent - 工具调用**         | 执行搜索/标签等操作 | 工具选择相对简单     | ✅ 应使用 chat |
| **AI Agent - 对话压缩**         | 压缩对话历史        | 摘要任务             | ✅ 已使用 chat |
| **分类服务**                    | 意图分类            | 分类任务，模式固定   | ✅ 应使用 chat |
| **主题合成 - 内容生成**         | 生成合成报告        | 内容创作             | ✅ 应使用 chat |

### 🔴 使用 deepseek-reasoner（深度层）

适合：多步推理、复杂分析、策略规划

| 模块                      | 功能                  | 原因                 | 当前状态           |
| ------------------------- | --------------------- | -------------------- | ------------------ |
| **AI Agent - 慢思考**     | 分析用户真实意图      | 需要深度推理用户意图 | ✅ 已使用 reasoner |
| **AI Skills - 洞察报告**  | 收藏内容趋势分析      | 多维度分析+洞察提取  | ❌ 需修复          |
| **AI Skills - 学习路径**  | 规划学习计划          | 多步规划+优先级排序  | ❌ 需修复          |
| **AI Skills - 知识回顾**  | 生成复习计划+记忆卡片 | 知识结构分析         | ❌ 需修复          |
| **AI Skills - 批量整理**  | 自动分类+去重+归档    | 多步决策+冲突解决    | ❌ 需修复          |
| **AI Skills - 重复清理**  | 智能判断重复内容      | 语义相似度判断       | ❌ 需修复          |
| **主题合成 - 主题推荐**   | 发现可合成的主题      | 跨书签关联分析       | ❌ 需修复          |
| **Brain-Sync - 复习规划** | SM-2 算法+复习策略    | 记忆曲线优化         | ❌ 需修复          |
| **知识提取**              | 提取关键知识点        | 深度理解+结构化      | ❌ 需修复          |

### 🟡 视情况选择（混合模式）

| 模块         | 简单场景用 chat | 复杂场景用 reasoner |
| ------------ | --------------- | ------------------- |
| **周期报告** | 数据汇总统计    | 趋势分析+建议生成   |
| **相关发现** | 基于标签推荐    | 跨主题语义关联      |
| **阅读规划** | 简单时间分配    | 根据难度/优先级规划 |

---

## 实施计划

### Phase 1: 修复深度层任务（优先）

这些功能应该使用 `deepseek-reasoner` 但目前使用的是 `deepseek-chat`：

```typescript
// 需要修改的文件列表
src/lib/ai-skills/skills/insight-report/
src/lib/ai-skills/skills/learning-path/
src/lib/ai-skills/skills/knowledge-review/
src/lib/ai-skills/skills/batch-organize/
src/lib/ai-skills/skills/duplicate-cleanup/
src/lib/ai-skills/skills/thematic-synthesis/
src/lib/ai-skills/skills/active-recall/
src/lib/ai-skills/skills/knowledge-extract/
```

**修复方法**：使用层级选择器获取正确模型

```typescript
// 修复前
const model = aiProviderRouter.getModel("deepseek");

// 修复后
import { MODEL_TIER_CONFIG } from "@/lib/ai-providers/model-tier-config";
const tierConfig = MODEL_TIER_CONFIG["deep"];
const model = aiProviderRouter.getModel(
  tierConfig.provider.name,
  tierConfig.provider.model,
);
```

### Phase 2: 完善层级选择器集成

创建统一的模型获取函数：

```typescript
// src/lib/ai-providers/get-model-by-task.ts

import { MODEL_TIER_CONFIG, type ModelTierId } from "./model-tier-config";
import { aiProviderRouter } from "./provider-router";

/**
 * 任务类型 → 模型层级 映射
 */
const TASK_TIER_MAP: Record<string, ModelTierId> = {
  // 内容生成类 → 标准层
  "content-generation": "standard",
  "outline-generation": "standard",
  "content-condense": "standard",
  "style-adapt": "standard",
  summary: "standard",
  tagging: "standard",

  // 分析推理类 → 深度层
  "insight-analysis": "deep",
  "learning-path": "deep",
  "knowledge-review": "deep",
  "batch-organize": "deep",
  "duplicate-detect": "deep",
  "theme-discovery": "deep",
};

/**
 * 根据任务类型获取最佳模型
 */
export function getModelByTask(taskType: string) {
  const tier = TASK_TIER_MAP[taskType] ?? "standard";
  const tierConfig = MODEL_TIER_CONFIG[tier];
  return aiProviderRouter.getModel(
    tierConfig.provider.name,
    tierConfig.provider.model,
  );
}
```

### Phase 3: 添加监控和成本控制

```typescript
// 在调用时记录使用的模型层级
logger.info(
  {
    task: "insight-report",
    tier: "deep",
    model: "deepseek-reasoner",
    estimatedCostFactor: 4,
  },
  "AI model invocation",
);
```

---

## 成本估算

假设每日 1000 次 AI 调用：

| 分布          | 调用次数 | 层级     | 成本系数 | 相对成本 |
| ------------- | -------- | -------- | -------- | -------- |
| 内容生成/摘要 | 600      | standard | 1.5x     | 900      |
| 简单查询/闲聊 | 250      | fast     | 1x       | 250      |
| 深度分析/规划 | 150      | deep     | 4x       | 600      |
| **总计**      | 1000     |          |          | **1750** |

相比全部使用 standard (1500) 增加约 17%，但深度任务质量显著提升。

---

## 验证清单

- [x] 创建统一的 `getModelByTask` 工具函数
- [x] knowledge-extract Skill 使用 deepseek-reasoner (via knowledge-extract task type)
- [x] thematic-synthesis Skill 使用 deepseek-reasoner (via theme-discovery task type)
- [x] flashcard-generator 使用 deepseek-reasoner (via knowledge-review task type)
- [x] 类型检查通过
- [ ] insight-report Skill - **不使用 LLM**（纯规则分析）
- [ ] learning-path Skill - **不使用 LLM**（纯规则分析）
- [ ] knowledge-review Skill - **不使用 LLM**（纯规则分析）
- [ ] batch-organize Skill - **不使用 LLM**（纯规则分析）
- [ ] duplicate-cleanup Skill - **不使用 LLM**（纯规则分析）
- [ ] 慢思考服务保持使用 deepseek-reasoner ✅ (已确认)
- [ ] 内容生成保持使用 deepseek-chat ✅ (已确认)
- [ ] 添加模型使用日志

---

## DashScope 使用场景保留清单

以下场景使用 DashScope 是因为 DeepSeek 不支持相关功能：

| 功能     | 文件                                            | 原因                      |
| -------- | ----------------------------------------------- | ------------------------- |
| 向量嵌入 | `embedding-generator.ts`, `embedding-config.ts` | DeepSeek 不支持 embedding |
| Rerank   | `dashscope-reranker.ts`                         | DeepSeek 不支持 rerank    |
| TTS      | `aliyun-tts.service.ts`                         | DeepSeek 不支持语音合成   |
| Vision   | `image-analyzer.ts`                             | 使用 qwen-vl 视觉模型     |

---

## 附录：现有层级配置

来自 `src/lib/ai-providers/model-tier-config.ts`：

```typescript
const MODEL_TIER_CONFIG = {
  fast: {
    provider: { name: "deepseek", model: "deepseek-chat" },
    applicableTasks: ["chitchat", "simple_query", "query:count", "query:list"],
  },
  standard: {
    provider: { name: "deepseek", model: "deepseek-chat" },
    applicableTasks: [
      "tool_calling",
      "summary",
      "search",
      "action:*",
      "create:*",
    ],
  },
  deep: {
    provider: { name: "deepseek", model: "deepseek-reasoner" },
    applicableTasks: [
      "insight_analysis",
      "learning_path",
      "batch_organize",
      "analyze:*",
      "learn:*",
    ],
  },
};
```
