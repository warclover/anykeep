/**
 * Agent Memory - 会话记忆管理
 *
 * 职责：
 * - 存储和管理会话历史
 * - 上下文窗口管理（自动截断/摘要）
 * - 内存缓存 + 可选数据库持久化
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { logger } from "@/lib/logger";
import type { AgentConversation, AgentMessage, AgentType } from "./types";

/**
 * Memory 配置
 */
export interface AgentMemoryConfig {
  /** 最大消息数量（超过后自动截断） */
  maxMessages: number;
  /** 最大 Token 数估算（用于上下文管理） */
  maxTokensEstimate: number;
  /** 是否启用数据库持久化 */
  enablePersistence: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AgentMemoryConfig = {
  maxMessages: 50,
  maxTokensEstimate: 8000,
  enablePersistence: false, // 暂不启用数据库持久化
};

/**
 * 会话缓存条目
 */
interface CachedConversation extends AgentConversation {
  /** 是否已修改（需要持久化） */
  dirty: boolean;
  /** 最后访问时间 */
  lastAccessedAt: Date;
}

/**
 * Agent Memory 管理器
 */
export class AgentMemory {
  private config: AgentMemoryConfig;
  private cache: Map<string, CachedConversation> = new Map();

  constructor(config: Partial<AgentMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 创建新会话
   */
  createConversation(
    userId: string,
    agentType: AgentType = "knowledge",
    options?: {
      title?: string;
      contextBookmarkIds?: number[];
      metadata?: Record<string, unknown>;
    },
  ): AgentConversation {
    const now = new Date();
    const conversation: AgentConversation = {
      id: crypto.randomUUID(),
      userId,
      agentType,
      title: options?.title,
      contextBookmarkIds: options?.contextBookmarkIds,
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: options?.metadata,
    };

    // 缓存会话
    this.cache.set(conversation.id, {
      ...conversation,
      dirty: true,
      lastAccessedAt: now,
    });

    logger.debug(
      { conversationId: conversation.id, userId, agentType },
      "AgentMemory: Created new conversation",
    );

    return conversation;
  }

  /**
   * 获取会话
   */
  getConversation(conversationId: string): AgentConversation | null {
    const cached = this.cache.get(conversationId);
    if (cached) {
      cached.lastAccessedAt = new Date();
      return this.toConversation(cached);
    }

    // TODO: 如果启用持久化，从数据库加载
    return null;
  }

  /**
   * 添加消息
   */
  addMessage(conversationId: string, message: AgentMessage): void {
    const cached = this.cache.get(conversationId);
    if (!cached) {
      logger.warn(
        { conversationId },
        "AgentMemory: Conversation not found for addMessage",
      );
      return;
    }

    cached.messages.push(message);
    cached.updatedAt = new Date();
    cached.dirty = true;

    // 检查是否需要截断
    if (cached.messages.length > this.config.maxMessages) {
      this.truncateMessages(cached);
    }

    logger.debug(
      {
        conversationId,
        messageId: message.id,
        role: message.role,
        messageCount: cached.messages.length,
      },
      "AgentMemory: Added message",
    );
  }

  /**
   * 获取会话消息
   */
  getMessages(
    conversationId: string,
    options?: {
      limit?: number;
      includeSystem?: boolean;
    },
  ): AgentMessage[] {
    const cached = this.cache.get(conversationId);
    if (!cached) {
      return [];
    }

    let messages = cached.messages;

    // 过滤系统消息
    if (options?.includeSystem === false) {
      messages = messages.filter((m) => m.role !== "system");
    }

    // 限制数量
    if (options?.limit && messages.length > options.limit) {
      messages = messages.slice(-options.limit);
    }

    return messages;
  }

  /**
   * 更新会话标题
   */
  updateTitle(conversationId: string, title: string): void {
    const cached = this.cache.get(conversationId);
    if (cached) {
      cached.title = title;
      cached.updatedAt = new Date();
      cached.dirty = true;
    }
  }

  /**
   * 清除会话
   */
  clearConversation(conversationId: string): void {
    this.cache.delete(conversationId);
    // TODO: 如果启用持久化，也从数据库删除
    logger.debug({ conversationId }, "AgentMemory: Cleared conversation");
  }

  /**
   * 获取用户的所有会话
   */
  getUserConversations(userId: string): AgentConversation[] {
    const conversations: AgentConversation[] = [];

    for (const cached of this.cache.values()) {
      if (cached.userId === userId) {
        conversations.push(this.toConversation(cached));
      }
    }

    // 按更新时间排序
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return conversations;
  }

  /**
   * 估算消息 Token 数
   */
  estimateTokens(messages: AgentMessage[]): number {
    // 简单估算：每个字符约 0.5 token（中文约 0.7）
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += msg.content.length;
      // 工具调用也算入
      if (msg.toolCalls) {
        totalChars += JSON.stringify(msg.toolCalls).length;
      }
    }
    return Math.ceil(totalChars * 0.6);
  }

  /**
   * 截断消息（保留最近的消息）
   */
  private truncateMessages(cached: CachedConversation): void {
    const messages = cached.messages;
    const systemMessages = messages.filter((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    // 保留系统消息 + 最近的 N 条消息
    const keepCount = this.config.maxMessages - systemMessages.length;
    const truncatedOthers = otherMessages.slice(-keepCount);

    cached.messages = [...systemMessages, ...truncatedOthers];

    logger.debug(
      {
        conversationId: cached.id,
        originalCount: messages.length,
        newCount: cached.messages.length,
      },
      "AgentMemory: Truncated messages",
    );
  }

  /**
   * 将缓存条目转换为会话对象
   */
  private toConversation(cached: CachedConversation): AgentConversation {
    return {
      id: cached.id,
      userId: cached.userId,
      title: cached.title,
      agentType: cached.agentType,
      contextBookmarkIds: cached.contextBookmarkIds,
      messages: cached.messages,
      createdAt: cached.createdAt,
      updatedAt: cached.updatedAt,
      metadata: cached.metadata,
    };
  }

  /**
   * 清理过期会话（LRU）
   */
  cleanup(maxAge: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, cached] of this.cache.entries()) {
      if (now - cached.lastAccessedAt.getTime() > maxAge) {
        this.cache.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(
        { cleanedCount: cleaned, remaining: this.cache.size },
        "AgentMemory: Cleaned up expired conversations",
      );
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
    estimatedTokens: number;
  } {
    let totalMessages = 0;
    let estimatedTokens = 0;

    for (const cached of this.cache.values()) {
      totalMessages += cached.messages.length;
      estimatedTokens += this.estimateTokens(cached.messages);
    }

    return {
      totalConversations: this.cache.size,
      totalMessages,
      estimatedTokens,
    };
  }
}

/**
 * 默认 Memory 实例
 */
export const agentMemory = new AgentMemory();
