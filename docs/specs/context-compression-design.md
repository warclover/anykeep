# AnyKeep 上下文压缩功能设计方案

> **版本**: v1.0
> **日期**: 2025-12-27
> **状态**: ✅ 已审核通过

---

## 一、设计背景

### 1.1 问题陈述

当前 AnyKeep AI Agent 的会话管理存在以下问题：

| 问题       | 现状                             | 影响                       |
| ---------- | -------------------------------- | -------------------------- |
| 消息累积   | `AgentMemory` 限制 50 条，无压缩 | 超限后简单截断，丢失上下文 |
| Token 成本 | 消息历史线性增长                 | 长对话成本高               |
| 响应质量   | 上下文过长时注意力分散           | AI 可能忽略早期重要信息    |

### 1.2 设计目标

针对 AnyKeep **轻量化应用**特点（用户通常 10-20 轮对话），设计：

1. **适度触发** - 不过早压缩，保留对话流畅性
2. **领域聚焦** - 针对书签管理场景优化压缩模板
3. **低侵入性** - 最小化对现有架构的改动
4. **可观测性** - 压缩事件可追踪、可调试

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     UnifiedEngine / KnowledgeAgent               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ConversationCompressor                         │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ 压缩触发器   │ -> │ 压缩执行器   │ -> │ 结果验证器   │      │
│  │ (Trigger)    │    │ (Executor)   │    │ (Validator)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    压缩配置 (Config)                      │   │
│  │  • 触发阈值: 12 轮 / 70% Token                           │   │
│  │  • 压缩模板: 4 段式书签场景                              │   │
│  │  • 保留策略: 最近 3 轮原文                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AgentMemory                                 │
│                 (更新后的消息历史)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件                     | 职责                 | 文件路径                                              |
| ------------------------ | -------------------- | ----------------------------------------------------- |
| `ConversationCompressor` | 压缩协调器（主入口） | `src/lib/ai-agent/context/conversation-compressor.ts` |
| `CompressionTrigger`     | 判断是否需要压缩     | 同上（内部类）                                        |
| `CompressionExecutor`    | 执行 LLM 压缩调用    | 同上（内部类）                                        |
| `CompressionValidator`   | 验证压缩结果质量     | 同上（内部类）                                        |
| `compression-config.ts`  | 配置常量             | `src/lib/ai-agent/config/compression-config.ts`       |

---

## 三、详细设计

### 3.1 压缩触发策略

采用 **双条件触发**（满足任一即触发）：

```typescript
// 触发条件
interface CompressionTriggerConfig {
  // 条件 1: 轮次阈值（用户+助手算 1 轮）
  turnThreshold: number; // 默认 12 轮

  // 条件 2: Token 使用率阈值
  tokenUsageThreshold: number; // 默认 0.70 (70%)

  // 最小轮次保护（避免过早压缩）
  minTurnsBeforeCompression: number; // 默认 6 轮
}

// 默认配置（针对 AnyKeep 轻量场景）
const DEFAULT_CONFIG: CompressionTriggerConfig = {
  turnThreshold: 12, // 12 轮触发
  tokenUsageThreshold: 0.8, // 80% 触发（平衡压缩时机）
  minTurnsBeforeCompression: 6, // 至少 6 轮才考虑压缩
};
```

**设计理由**：

| 参数                           | 值    | 理由                                             |
| ------------------------------ | ----- | ------------------------------------------------ |
| `turnThreshold: 12`            | 12 轮 | AnyKeep 用户平均对话 10-20 轮，12 轮是合理的中点 |
| `tokenUsageThreshold: 0.80`    | 80%   | 平衡压缩时机，避免过早触发又不至于临界           |
| `minTurnsBeforeCompression: 6` | 6 轮  | 保护短对话不被压缩，保留完整上下文               |

### 3.2 压缩模板设计

采用 **4 段式书签场景压缩模板**（比 Claude 的 8 段更精简）：

```typescript
const ANYKEEP_COMPRESSION_PROMPT = `
你是 AnyKeep 书签助手的上下文压缩专家。请将以下对话历史压缩为结构化摘要。

## 压缩要求

1. **保留关键信息**：用户的核心需求、重要决策、执行结果
2. **丢弃冗余信息**：问候语、确认语、重复内容
3. **保持可操作性**：压缩后的内容应能指导后续对话

## 输出格式（严格遵循）

### 1. 用户目标 (User Goals)
- 用户本次会话想要达成的主要目标
- 任何明确表达的偏好或限制

### 2. 已完成操作 (Completed Actions)
- 已执行的搜索查询及结果数量
- 已完成的书签操作（添加标签、移动、删除等）
- 涉及的书签 ID 或数量

### 3. 重要上下文 (Key Context)
- 提及的特定平台、文件夹、标签
- 用户表达的分类偏好
- 发现的数据模式（如"技术文章居多"）

### 4. 待处理事项 (Pending Items)
- 用户提到但尚未完成的请求
- 建议的后续操作
- 任何未解决的问题

## 对话历史

{conversation_history}

## 注意事项

- 输出必须是中文
- 每个段落不超过 5 个要点
- 总长度控制在 500 字以内
- 如果某个段落无内容，写"无"
`;
```

**模板对比**：

| 维度       | Claude Code (8 段) | AnyKeep (4 段)  | 精简理由             |
| ---------- | ------------------ | --------------- | -------------------- |
| 背景上下文 | ✅ 项目技术栈      | ❌ 移除         | 书签场景无技术栈概念 |
| 关键决策   | ✅ 架构决策        | ❌ 移除         | 书签操作无复杂决策   |
| 工具使用   | ✅ 详细工具日志    | ✅ → 已完成操作 | 简化为操作结果       |
| 用户意图   | ✅ 意图演进        | ✅ → 用户目标   | 合并简化             |
| 执行结果   | ✅ 代码/文件       | ✅ → 已完成操作 | 合并到操作段         |
| 错误处理   | ✅ 错误解决        | ❌ 移除         | 书签操作少有复杂错误 |
| 未解决问题 | ✅ Open Issues     | ✅ → 待处理事项 | 保留                 |
| 后续计划   | ✅ Future Plans    | ✅ → 待处理事项 | 合并                 |
| **新增**   | -                  | ✅ 重要上下文   | 书签场景特有         |

### 3.3 消息保留策略

```typescript
interface RetentionPolicy {
  // 压缩后保留最近 N 轮原始消息
  keepRecentTurns: number; // 默认 6 轮

  // 系统消息处理
  systemMessageHandling: "keep" | "regenerate"; // 默认 regenerate

  // 压缩摘要位置
  summaryPosition: "system" | "first_user"; // 默认 system
}

// 压缩后的消息结构
[
  {
    role: "system",
    content: `${baseSystemPrompt}

## 对话历史摘要

${compressionSummary}

---
以上是之前对话的摘要。以下是最近的对话：`,
  },
  // 保留最近 6 轮原始消息
  { role: "user", content: "..." }, // Turn N-5
  { role: "assistant", content: "..." },
  { role: "user", content: "..." }, // Turn N-4
  { role: "assistant", content: "..." },
  { role: "user", content: "..." }, // Turn N-3
  { role: "assistant", content: "..." },
  { role: "user", content: "..." }, // Turn N-2
  { role: "assistant", content: "..." },
  { role: "user", content: "..." }, // Turn N-1
  { role: "assistant", content: "..." },
  { role: "user", content: "..." }, // Turn N (当前)
];
```

**设计理由**：

- **保留 6 轮原文**：保持近期对话的完整性，确保指代词解析和上下文连贯性
- **摘要注入 System Prompt**：不干扰消息历史结构，LLM 更容易理解
- **重新生成 System Prompt**：压缩后动态上下文可能已变化

### 3.4 Token 估算算法

```typescript
// 简化的 Token ��算（中英文混合场景）
function estimateTokens(text: string): number {
  // 中文：约 1.5 字符/token
  // 英文：约 4 字符/token
  // 混合场景取平均：约 2.5 字符/token

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// 消息历史 Token 使用率计算
function calculateTokenUsage(
  messages: Message[],
  maxContextTokens: number, // 模型上下文窗口
): number {
  const totalTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0,
  );
  return totalTokens / maxContextTokens;
}
```

### 3.5 压缩执行流程

```typescript
async function executeCompression(
  messages: Message[],
  config: CompressionConfig,
  context: CompressionContext
): Promise<CompressionResult> {

  // Step 1: 准备压缩输入
  const messagesToCompress = messages.slice(0, -config.keepRecentTurns * 2);
  const recentMessages = messages.slice(-config.keepRecentTurns * 2);
  // keepRecentTurns = 6，所以保留最近 12 条消息（6 轮 × 2）

  // Step 2: 构建压缩 Prompt
  const compressionPrompt = buildCompressionPrompt(
    messagesToCompress,
    ANYKEEP_COMPRESSION_PROMPT
  );

  // Step 3: 调用 LLM 执行压缩（复用 fast 层配置，使用 DeepSeek）
  const summary = await callLLM({
    model: 'fast',  // deepseek-chat（国产模型，成本低）
    messages: [
      { role: 'system', content: compressionPrompt },
      { role: 'user', content: '请压缩以上对话历史。' }
    ],
    maxTokens: 800,  // 限制摘要长度
    temperature: 0.3,  // 低温度保证一致性
  });

  // Step 4: 验证压缩结果
  const validation = validateCompression(summary, messagesToCompress);
  if (!validation.isValid) {
    // 压缩失败，返回原消息（降级处理）
    return {
      success: false,
      messages: messages,
      reason: validation.reason,
    };
  }

  // Step 5: 构建压缩后的消息数组
  const compressedMessages = buildCompressedMessages(
    summary,
    recentMessages,
    context
  );

  // Step 6: 记录压缩指标
  recordCompressionMetrics({
    originalCount: messages.length,
    compressedCount: compressedMessages.length,
    originalTokens: estimateTokens(JSON.stringify(messages)),
    compressedTokens: estimateTokens(JSON.stringify(compressedMessages)),
    compressionRatio: /* ... */,
  });

  return {
    success: true,
    messages: compressedMessages,
    summary: summary,
    metrics: /* ... */,
  };
}
```

---

## 四、接口设计

### 4.1 核心类型定义

```typescript
// src/lib/ai-agent/context/compression-types.ts

/**
 * 压缩配置
 */
export interface CompressionConfig {
  // 触发条件
  trigger: {
    turnThreshold: number;
    tokenUsageThreshold: number;
    minTurnsBeforeCompression: number;
  };

  // 保留策略
  retention: {
    keepRecentTurns: number;
    summaryPosition: "system" | "first_user";
  };

  // 执行选项
  execution: {
    tierId: ModelTierId; // 复用现有模型层级配置
    maxSummaryTokens: number;
    temperature: number;
  };

  // 功能开关
  enabled: boolean;
}

/**
 * 压缩结果
 */
export interface CompressionResult {
  success: boolean;
  messages: Message[];
  summary?: string;
  metrics?: CompressionMetrics;
  reason?: string;
}

/**
 * 压缩指标
 */
export interface CompressionMetrics {
  originalMessageCount: number;
  compressedMessageCount: number;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  executionTimeMs: number;
}

/**
 * 压缩上下文
 */
export interface CompressionContext {
  userId: string;
  conversationId: string;
  baseSystemPrompt: string;
  dynamicContext?: DynamicContext;
}
```

### 4.2 公共 API

```typescript
// src/lib/ai-agent/context/conversation-compressor.ts

export class ConversationCompressor {
  constructor(config?: Partial<CompressionConfig>);

  /**
   * 检查是否需要压缩
   */
  shouldCompress(
    messages: Message[],
    maxContextTokens: number,
  ): { needed: boolean; reason: string };

  /**
   * 执行压缩
   */
  async compress(
    messages: Message[],
    context: CompressionContext,
  ): Promise<CompressionResult>;

  /**
   * 获取压缩统计
   */
  getMetrics(): CompressionMetrics[];
}

// 单例导出
export const conversationCompressor = new ConversationCompressor();

// 便捷函数
export async function compressConversationIfNeeded(
  messages: Message[],
  context: CompressionContext,
  maxContextTokens: number,
): Promise<Message[]>;
```

---

## 五、集成方案

### 5.1 集成点选择

**推荐集成点**：`KnowledgeAgent.executeStream()` 方法内部

```typescript
// src/lib/ai-agent/core/knowledge-agent.ts

async *executeStream(
  input: string,
  context: AgentContext,
  options: AgentExecuteOptions
): AsyncGenerator<AgentStreamChunk> {

  // 获取会话
  let conversation = this.memory.getConversation(context.conversationId);

  // ========== 新增：压缩检查 ==========
  if (isCompressionEnabled()) {
    const compressionCheck = conversationCompressor.shouldCompress(
      conversation.messages,
      getMaxContextTokens(context.modelTier)
    );

    if (compressionCheck.needed) {
      const result = await conversationCompressor.compress(
        conversation.messages,
        {
          userId: context.userId,
          conversationId: conversation.id,
          baseSystemPrompt: this.getBaseSystemPrompt(),
          dynamicContext: context.dynamicContext,
        }
      );

      if (result.success) {
        // 更新会话消息
        conversation.messages = result.messages;
        conversation.metadata.lastCompressedAt = new Date();
        conversation.metadata.compressionCount =
          (conversation.metadata.compressionCount || 0) + 1;

        // 发送压缩通知（可选，用于调试）
        if (options.debug) {
          yield {
            type: 'debug',
            data: {
              event: 'conversation_compressed',
              metrics: result.metrics,
            }
          };
        }
      }
    }
  }
  // ========== 压缩检查结束 ==========

  // 继续原有逻辑...
  const messages = buildMessages(conversation, context, dynamicContext);
  // ...
}
```

### 5.2 Feature Flag 集成

```typescript
// src/lib/ai-agent/config/feature-flags.ts

export const FEATURE_FLAGS = {
  // ... 现有 flags

  /**
   * 启用对话压缩
   * 环境变量: ENABLE_CONVERSATION_COMPRESSION
   * 默认: true
   */
  ENABLE_CONVERSATION_COMPRESSION:
    process.env.ENABLE_CONVERSATION_COMPRESSION !== "false",

  /**
   * 压缩调试模式（输出压缩日志）
   * 环境变量: COMPRESSION_DEBUG
   * 默认: false
   */
  COMPRESSION_DEBUG: process.env.COMPRESSION_DEBUG === "true",
};
```

### 5.3 配置文件

```typescript
// src/lib/ai-agent/config/compression-config.ts

import { CompressionConfig } from "../context/compression-types";

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  trigger: {
    turnThreshold: 12,
    tokenUsageThreshold: 0.8,
    minTurnsBeforeCompression: 6,
  },
  retention: {
    keepRecentTurns: 6,
    summaryPosition: "system",
  },
  execution: {
    tierId: "fast", // 复用 fast 层：deepseek-chat
    maxSummaryTokens: 800,
    temperature: 0.3,
  },
  enabled: true,
};

// 支持环境变量覆盖
export function getCompressionConfig(): CompressionConfig {
  return {
    ...DEFAULT_COMPRESSION_CONFIG,
    trigger: {
      ...DEFAULT_COMPRESSION_CONFIG.trigger,
      turnThreshold: parseInt(process.env.COMPRESSION_TURN_THRESHOLD || "12"),
      tokenUsageThreshold: parseFloat(
        process.env.COMPRESSION_TOKEN_THRESHOLD || "0.80",
      ),
    },
    enabled: process.env.ENABLE_CONVERSATION_COMPRESSION !== "false",
  };
}
```

---

## 六、文件结构

```
src/lib/ai-agent/
├── config/
│   ├── feature-flags.ts          # 添加 ENABLE_CONVERSATION_COMPRESSION
│   ├── compression-config.ts     # 新增：压缩配置
│   └── index.ts
│
├── context/
│   ├── compression-types.ts      # 新增：类型定义
│   ├── conversation-compressor.ts # 新增：压缩器主类
│   ├── compression-prompt.ts     # 新增：压缩 Prompt 模板
│   ├── compression-validator.ts  # 新增：结果验证
│   ├── dynamic-context-builder.ts
│   ├── prompt-injector.ts
│   └── index.ts
│
├── core/
│   ├── knowledge-agent.ts        # 修改：集成压缩检查
│   ├── agent-memory.ts           # 修改：添加压缩相关元数据
│   └── ...
│
└── __tests__/
    └── context/
        ├── conversation-compressor.test.ts  # 新增
        └── compression-validator.test.ts    # 新增
```

---

## 七、测试计划

### 7.1 单元测试

| 测试文件                          | 测试内容                         |
| --------------------------------- | -------------------------------- |
| `conversation-compressor.test.ts` | 触发条件判断、压缩执行、结果处理 |
| `compression-validator.test.ts`   | 摘要格式验证、内容完整性检查     |
| `compression-config.test.ts`      | 配置加载、环境变量覆盖           |

### 7.2 测试用例

```typescript
describe("ConversationCompressor", () => {
  describe("shouldCompress", () => {
    it("应在达到轮次阈值时触发压缩", () => {
      const messages = generateMessages(14); // 14 轮 > 12 阈值
      const result = compressor.shouldCompress(messages, 8000);
      expect(result.needed).toBe(true);
      expect(result.reason).toContain("轮次");
    });

    it("应在达到 Token 使用率时触发压缩", () => {
      const messages = generateLongMessages(8); // 8 轮但内容很长
      const result = compressor.shouldCompress(messages, 4000);
      expect(result.needed).toBe(true);
      expect(result.reason).toContain("Token");
    });

    it("不应在最小轮次内触发压缩", () => {
      const messages = generateMessages(4); // 4 轮 < 6 最小轮次
      const result = compressor.shouldCompress(messages, 8000);
      expect(result.needed).toBe(false);
    });
  });

  describe("compress", () => {
    it("应正确保留最近 6 轮消息", async () => {
      const messages = generateMessages(15);
      const result = await compressor.compress(messages, context);

      // 验证最近 6 轮被保留（12 条消息）
      const recentOriginal = messages.slice(-12);
      const recentCompressed = result.messages.slice(-12);
      expect(recentCompressed).toEqual(recentOriginal);
    });

    it("应在摘要中包含 4 个必需段落", async () => {
      const result = await compressor.compress(messages, context);

      expect(result.summary).toContain("用户目标");
      expect(result.summary).toContain("已完成操作");
      expect(result.summary).toContain("重要上下文");
      expect(result.summary).toContain("待处理事项");
    });

    it("压缩失败时应返回原消息", async () => {
      mockLLMFailure();
      const result = await compressor.compress(messages, context);

      expect(result.success).toBe(false);
      expect(result.messages).toEqual(messages);
    });
  });
});
```

---

## 八、监控与可观测性

### 8.1 日志记录

```typescript
// 压缩事件日志
logger.info("conversation_compression", {
  event: "compression_triggered",
  userId: context.userId,
  conversationId: context.conversationId,
  trigger: {
    reason: "turn_threshold",
    currentTurns: 14,
    threshold: 12,
  },
});

logger.info("conversation_compression", {
  event: "compression_completed",
  userId: context.userId,
  metrics: {
    originalMessages: 28,
    compressedMessages: 8,
    originalTokens: 4200,
    compressedTokens: 1100,
    compressionRatio: 0.74,
    executionTimeMs: 850,
  },
});
```

### 8.2 指标追踪

```typescript
// 可追踪的指标
interface CompressionAnalytics {
  // 触发统计
  compressionTriggeredCount: number;
  triggerByTurnCount: number;
  triggerByTokenCount: number;

  // 执行统计
  compressionSuccessCount: number;
  compressionFailureCount: number;
  averageCompressionRatio: number;
  averageExecutionTimeMs: number;

  // 成本节省
  totalTokensSaved: number;
  estimatedCostSaved: number;
}
```

---

## 九、风险与缓解

| 风险                 | 影响            | 缓解措施                       |
| -------------------- | --------------- | ------------------------------ |
| 压缩丢失关键信息     | AI 响应质量下降 | 保留最近 3 轮原文 + 验证器检查 |
| LLM 压缩调用失败     | 功能不可用      | 降级返回原消息，不阻塞主流程   |
| 压缩耗时影响响应速度 | 用户体验下降    | 使用 fast 模型，限制摘要长度   |
| 压缩过于频繁         | 成本增加        | minTurnsBeforeCompression 保护 |

---

## 十、实施计划

### Phase 1: 核心实现 (3-4 天)

- [ ] 创建类型定义文件 `compression-types.ts`
- [ ] 实现 `ConversationCompressor` 主类
- [ ] 实现压缩 Prompt 模板
- [ ] 实现结果验证器
- [ ] 添加 Feature Flag

### Phase 2: 集成测试 (2 天)

- [ ] 编写单元测试
- [ ] 集成到 `KnowledgeAgent`
- [ ] 端到端测试

### Phase 3: 上线验证 (1 天)

- [ ] 添加监控日志
- [ ] 灰度发布（Feature Flag 控制）
- [ ] 收集指标数据

---

## 十一、最终配置参数

根据审核确认，最终采用以下配置：

### 配置汇总

| 参数                 | 最终值               | 说明                            |
| -------------------- | -------------------- | ------------------------------- |
| **触发阈值 - 轮次**  | 12 轮                | 对话达到 12 轮时触发压缩检查    |
| **触发阈值 - Token** | 80%                  | Token 使用率达到 80% 时触发压缩 |
| **最小轮次保护**     | 6 轮                 | 少于 6 轮不触发压缩             |
| **保留原文轮次**     | 6 轮                 | 压缩后保留最近 6 轮原始消息     |
| **压缩模型**         | fast (deepseek-chat) | 国产模型，低成本、快速响应      |
| **最大摘要长度**     | 800 tokens           | 控制压缩摘要长度                |

### 预估效果

```
场景：用户对话 18 轮

压缩前：
- 消息数量：36 条（18 轮 × 2）
- 估算 Token：~5400

压缩后：
- 摘要：~500 tokens
- 保留原文：12 条（6 轮 × 2）~1800 tokens
- 总计：~2300 tokens
- 节省：~57%
```

---

## 十二、审核记录

**审核日期**: 2025-12-27
**审核人**: Xiafe

### 审核结果

- [x] 触发策略：12 轮 / 80% Token ✅
- [x] 保留轮次：6 轮原文 ✅
- [x] 压缩模型：fast (deepseek-chat) ✅
- [x] 4 段式压缩模板覆盖书签场景需求 ✅
- [x] 集成点选择合适 ✅

---

_文档作者: Winston (Architect Agent)_
_审核状态: ✅ 已审核通过_
_审核日期: 2025-12-27_
