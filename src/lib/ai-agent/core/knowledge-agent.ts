/**
 * KnowledgeAgent - 知识管理智能助手
 *
 * 职责：
 * - 作为门面类，协调各个子模块
 * - 提供统一的 API 入口
 * - 管理会话和配置
 *
 * 架构说明：
 * - KnowledgeAgentContextBuilder: 消息构建
 * - KnowledgeAgentExecutor: 非流式执行
 * - KnowledgeAgentStreamExecutor: 流式执行
 * - KnowledgeAgentCompressor: 上下文压缩
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2025-12-28 - 重构为组合模式，拆分为多个子模块
 */

import type {
  AgentContext,
  AgentExecuteOptions,
  AgentExecuteResult,
  AgentStreamChunk,
  AgentConfig,
} from "./types";
import { KNOWLEDGE_AGENT_SYSTEM_PROMPT } from "./prompts";
import { AgentMemory } from "./agent-memory";
import { KnowledgeAgentContextBuilder } from "./knowledge-agent-context";
import {
  KnowledgeAgentExecutor,
  DEFAULT_EXECUTE_OPTIONS,
} from "./knowledge-agent-executor";
import { KnowledgeAgentStreamExecutor } from "./knowledge-agent-stream";
import {
  KnowledgeAgentCompressor,
  type AgentCompressionResult,
} from "./knowledge-agent-compression";
import type { ConversationCompressor } from "../context";

/**
 * KnowledgeAgent 配置
 */
const KNOWLEDGE_AGENT_CONFIG: AgentConfig = {
  type: "knowledge",
  name: "知识助手",
  description: "帮助用户管理和组织知识收藏的智能助手",
  systemPrompt: KNOWLEDGE_AGENT_SYSTEM_PROMPT,
  enabledSkills: ["search", "classify", "summary"],
  defaultOptions: DEFAULT_EXECUTE_OPTIONS,
};

/**
 * KnowledgeAgent 类
 *
 * 使用组合模式，将执行逻辑委托给专门的子模块
 */
export class KnowledgeAgent {
  private config: AgentConfig;
  private memory: AgentMemory;
  private contextBuilder: KnowledgeAgentContextBuilder;
  private executor: KnowledgeAgentExecutor;
  private streamExecutor: KnowledgeAgentStreamExecutor;
  private compressor: KnowledgeAgentCompressor;

  constructor(
    config: Partial<AgentConfig> = {},
    memory: AgentMemory = new AgentMemory(),
  ) {
    this.config = { ...KNOWLEDGE_AGENT_CONFIG, ...config };
    this.memory = memory;

    // 初始化子模块
    this.contextBuilder = new KnowledgeAgentContextBuilder(this.config);
    this.compressor = new KnowledgeAgentCompressor(this.config);

    const deps = {
      config: this.config,
      memory: this.memory,
      contextBuilder: this.contextBuilder,
    };
    this.executor = new KnowledgeAgentExecutor(deps);
    this.streamExecutor = new KnowledgeAgentStreamExecutor(deps);
  }

  /**
   * 执行 Agent（非流式）
   */
  async execute(
    input: string,
    context: AgentContext,
    options: Partial<AgentExecuteOptions> = {},
  ): Promise<AgentExecuteResult> {
    return this.executor.execute(input, context, options);
  }

  /**
   * 执行 Agent（流式）
   */
  async *executeStream(
    input: string,
    context: AgentContext,
    options: Partial<AgentExecuteOptions> = {},
  ): AsyncGenerator<AgentStreamChunk> {
    yield* this.streamExecutor.executeStream(input, context, options);
  }

  /**
   * 检查并压缩消息历史（如果需要）
   */
  async compressMessagesIfNeeded(
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    context: {
      userId: string;
      conversationId?: string;
      baseSystemPrompt?: string;
    },
    maxContextTokens: number = 8000,
  ): Promise<AgentCompressionResult> {
    return this.compressor.compressIfNeeded(
      messageHistory,
      context,
      maxContextTokens,
    );
  }

  // ===========================================================================
  // 会话管理方法
  // ===========================================================================

  /**
   * 获取会话
   */
  getConversation(conversationId: string) {
    return this.memory.getConversation(conversationId);
  }

  /**
   * 清除会话
   */
  clearConversation(conversationId: string) {
    this.memory.clearConversation(conversationId);
  }

  /**
   * 获取用户会话列表
   */
  getUserConversations(userId: string) {
    return this.memory.getUserConversations(userId);
  }

  // ===========================================================================
  // 配置和工具访问
  // ===========================================================================

  /**
   * 获取 Agent 配置
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * 获取压缩器实例（用于高级用途）
   */
  getCompressor(): ConversationCompressor {
    return this.compressor.getCompressor();
  }
}

/**
 * 默认 KnowledgeAgent 实例
 */
export const knowledgeAgent = new KnowledgeAgent();

// 导出子模块类型（供外部使用）
export type { AgentCompressionResult } from "./knowledge-agent-compression";
