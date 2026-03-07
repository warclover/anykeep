/**
 * 会话摘要生成服务
 *
 * 使用 LLM 从会话历史中生成结构化摘要
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { aiEnv } from "@/lib/env";
import type { AgentConversation, AgentMessage } from "../core/types";
import { getEpisodicMemoryService } from "./episodic-memory";
import { FeatureFlags } from "../config/feature-flags";

// =============================================================================
// 常量
// =============================================================================

/**
 * 摘要生成 System Prompt
 */
const SUMMARY_SYSTEM_PROMPT = `你是一个对话分析专家。根据给定的对话历史，生成结构化摘要。

要求：
1. summary: 用1-2句话概括对话的主要内容和结果
2. intents: 提取用户的主要意图（如"搜索技术文章"、"整理收藏"等）
3. pendingIntents: 识别用户提到但尚未完成的事项
4. actions: 记录实际执行的操作类型
5. sentiment: 判断整体情绪（positive/neutral/negative）

注意：
- intents 应该是具体的、可操作的描述
- pendingIntents 只记录明确提到但未执行的事项
- 如果对话很简短或只是闲聊，可以返回空的 intents/pendingIntents`;

/**
 * 摘要输出 Schema
 */
const actionSchema = z.object({
  type: z
    .string()
    .describe("操作类型，如 search, organize, tag, create, delete, export"),
  target: z.string().describe("操作目标，如 书签、文件夹名称等"),
  outcome: z.enum(["success", "failed", "cancelled"]).describe("操作结果"),
});

const summarySchema = z.object({
  summary: z.string().describe("1-2句话的对话摘要"),
  intents: z.array(z.string()).describe("用户的主要意图列表"),
  pendingIntents: z.array(z.string()).describe("未完成的意图/事项"),
  actions: z.array(actionSchema).describe("执行的操作列表"),
  sentiment: z
    .enum(["positive", "neutral", "negative"])
    .describe("整体情绪倾向"),
});

type SummaryOutput = z.infer<typeof summarySchema>;

// =============================================================================
// 摘要生成服务
// =============================================================================

const log = logger.child({ module: "SummaryGenerator" });

/**
 * 摘要生成配置
 */
export interface SummaryGeneratorConfig {
  /** 使用的模型 */
  model?: string;
  /** 最大消息数量（超过则截断） */
  maxMessages?: number;
  /** 最大 Token 数（用于截断） */
  maxTokens?: number;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<SummaryGeneratorConfig> = {
  model: "qwen-turbo", // 阿里云百炼模型
  maxMessages: 20,
  maxTokens: 2000,
  enabled: true,
};

/**
 * 会话摘要生成器
 *
 * 将对话历史转换为结构化摘要并存储
 */
export class SummaryGenerator {
  private config: Required<SummaryGeneratorConfig>;

  constructor(config?: SummaryGeneratorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成并存储会话摘要
   *
   * 这是主入口方法，会：
   * 1. 检查是否需要生成摘要
   * 2. 调用 LLM 生成摘要
   * 3. 存储到数据库
   *
   * @param conversation 会话对象
   * @returns 是否成功
   */
  async generateAndSave(conversation: AgentConversation): Promise<boolean> {
    // 检查功能是否启用
    if (!this.config.enabled || !FeatureFlags.ENABLE_EPISODIC_MEMORY) {
      log.debug(
        { conversationId: conversation.id },
        "Summary generation disabled",
      );
      return false;
    }

    // 检查是否有足够的消息
    const userMessages = conversation.messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      log.debug(
        { conversationId: conversation.id },
        "No user messages, skipping summary",
      );
      return false;
    }

    try {
      // 生成摘要
      const summaryOutput = await this.generateSummary(conversation);
      if (!summaryOutput) {
        return false;
      }

      // 存储到数据库
      const memoryService = getEpisodicMemoryService();
      await memoryService.saveSummary(conversation.userId, conversation.id, {
        summary: summaryOutput.summary,
        intents: summaryOutput.intents,
        pendingIntents: summaryOutput.pendingIntents,
        actions: summaryOutput.actions,
        sentiment: summaryOutput.sentiment,
        messageCount: conversation.messages.length,
      });

      log.info(
        {
          conversationId: conversation.id,
          userId: conversation.userId.slice(0, 8) + "...",
          messageCount: conversation.messages.length,
          intentsCount: summaryOutput.intents.length,
          pendingIntentsCount: summaryOutput.pendingIntents.length,
        },
        "Summary generated and saved",
      );

      return true;
    } catch (error) {
      log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          conversationId: conversation.id,
        },
        "Failed to generate summary",
      );
      return false;
    }
  }

  /**
   * 生成摘要（不存储）
   *
   * @param conversation 会话对象
   * @returns 摘要输出或 null
   */
  async generateSummary(
    conversation: AgentConversation,
  ): Promise<SummaryOutput | null> {
    // 构建对话文本
    const conversationText = this.formatConversation(conversation);

    if (!conversationText.trim()) {
      return null;
    }

    try {
      // 使用阿里云百炼 (DashScope) 替代 OpenAI
      // DashScope 使用 OpenAI 兼容 API，需要自定义 baseURL
      const dashscopeProvider = createOpenAI({
        apiKey: aiEnv.dashscopeApiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      });
      const result = await generateObject({
        model: dashscopeProvider.chat(this.config.model),
        schema: summarySchema,
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: `请分析以下对话并生成摘要：\n\n${conversationText}`,
        temperature: 0.3, // 较低温度确保稳定性
      });

      return result.object;
    } catch (error) {
      log.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "LLM summary generation failed",
      );
      return null;
    }
  }

  /**
   * 格式化对话为文本
   */
  private formatConversation(conversation: AgentConversation): string {
    // 过滤并限制消息数量
    let messages = conversation.messages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );

    // 保留最近的消息
    if (messages.length > this.config.maxMessages) {
      messages = messages.slice(-this.config.maxMessages);
    }

    // 格式化
    const lines = messages.map((m) => {
      const role = m.role === "user" ? "用户" : "助手";
      // 截断过长的消息
      const content =
        m.content.length > 500 ? m.content.slice(0, 500) + "..." : m.content;
      return `${role}: ${content}`;
    });

    return lines.join("\n\n");
  }

  /**
   * 从对话中快速提取意图（不调用 LLM）
   *
   * 使用简单的关键词匹配作为 LLM 的备选方案
   */
  extractIntentsQuick(messages: AgentMessage[]): string[] {
    const intents: string[] = [];
    const intentPatterns: Array<{ pattern: RegExp; intent: string }> = [
      { pattern: /搜索|找|查/i, intent: "搜索内容" },
      { pattern: /整理|分类|归档/i, intent: "整理收藏" },
      { pattern: /标签|打标/i, intent: "标签管理" },
      { pattern: /导出|备份|下载/i, intent: "数据导出" },
      { pattern: /删除|移除|清理/i, intent: "删除操作" },
      { pattern: /统计|分析|报告/i, intent: "数据分析" },
    ];

    const userTexts = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ");

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(userTexts) && !intents.includes(intent)) {
        intents.push(intent);
      }
    }

    return intents;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SummaryGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// 单例导出
// =============================================================================

let _instance: SummaryGenerator | null = null;

/**
 * 获取摘要生成器实例
 */
export function getSummaryGenerator(
  config?: SummaryGeneratorConfig,
): SummaryGenerator {
  if (!_instance) {
    _instance = new SummaryGenerator(config);
  }
  return _instance;
}

/**
 * 重置摘要生成器实例（用于测试）
 */
export function resetSummaryGenerator(): void {
  _instance = null;
}

// =============================================================================
// 便捷函数
// =============================================================================

/**
 * 为会话生成并保存摘要
 *
 * 这是最常用的入口函数
 */
export async function generateConversationSummary(
  conversation: AgentConversation,
): Promise<boolean> {
  const generator = getSummaryGenerator();
  return generator.generateAndSave(conversation);
}
