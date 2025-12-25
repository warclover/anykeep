/**
 * MemoryManager - 记忆管理门面
 *
 * 职责：
 * - 提供统一的记忆管理接口
 * - 协调 SessionMemory 和 ReferenceResolver
 * - 简化 UnifiedEngine 的集成
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type { SessionMemory } from "./session-memory";
import { createSessionMemory } from "./session-memory";
import type { ReferenceResolver } from "./reference-resolver";
import { createReferenceResolver } from "./reference-resolver";
import type {
  ConversationState,
  ConversationMessage,
  MentionedEntity,
  SearchResultSummary,
  LastOutputSummary,
  ReferenceResolutionResult,
  SessionMemoryConfig,
  ReferenceResolverConfig,
} from "./types";

// ============================================
// 配置类型
// ============================================

/**
 * MemoryManager 配置
 */
export interface MemoryManagerConfig {
  /** SessionMemory 配置 */
  sessionMemory?: SessionMemoryConfig;
  /** ReferenceResolver 配置 */
  referenceResolver?: ReferenceResolverConfig;
  /** 是否启用指代解析 */
  enableReferenceResolution?: boolean;
  /** 是否启用自动记录 */
  enableAutoRecording?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<MemoryManagerConfig> = {
  sessionMemory: {},
  referenceResolver: {},
  enableReferenceResolution: true,
  enableAutoRecording: true,
};

// ============================================
// MemoryManager 类
// ============================================

/**
 * 记忆管理器
 *
 * 统一管理会话状态和指代解析
 */
export class MemoryManager {
  private sessionMemory: SessionMemory;
  private referenceResolver: ReferenceResolver;
  private config: Required<MemoryManagerConfig>;

  constructor(config: MemoryManagerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.sessionMemory = createSessionMemory(this.config.sessionMemory);
    this.referenceResolver = createReferenceResolver(
      this.config.referenceResolver,
    );
  }

  // ============================================
  // 会话管理
  // ============================================

  /**
   * 获取或创建会话
   */
  getOrCreateSession(
    conversationId: string,
    userId: string,
  ): ConversationState {
    return this.sessionMemory.getOrCreateState(conversationId, userId);
  }

  /**
   * 获取会话
   */
  getSession(conversationId: string): ConversationState | undefined {
    return this.sessionMemory.getState(conversationId);
  }

  /**
   * 删除会话
   */
  deleteSession(conversationId: string): boolean {
    return this.sessionMemory.deleteState(conversationId);
  }

  // ============================================
  // 指代解析
  // ============================================

  /**
   * 解析输入中的指代词
   *
   * @param input - 用户输入
   * @param conversationId - 会话 ID
   * @returns 解析结果，如果会话不存在则返回 null
   */
  resolveReferences(
    input: string,
    conversationId: string,
  ): ReferenceResolutionResult | null {
    if (!this.config.enableReferenceResolution) {
      return null;
    }

    const state = this.sessionMemory.getState(conversationId);

    if (!state) {
      logger.debug(
        { conversationId },
        "MemoryManager: Session not found for reference resolution",
      );
      return null;
    }

    return this.referenceResolver.resolve(input, state);
  }

  /**
   * 检查输入是否包含指代词
   */
  hasReferences(input: string): boolean {
    return this.referenceResolver.hasReferences(input);
  }

  /**
   * 预处理输入（解析指代词并返回处理后的输入）
   *
   * @param input - 原始输入
   * @param conversationId - 会话 ID
   * @returns 处理后的输入和解析信息
   */
  preprocessInput(
    input: string,
    conversationId: string,
  ): {
    processedInput: string;
    resolution: ReferenceResolutionResult | null;
    hasChanges: boolean;
  } {
    const resolution = this.resolveReferences(input, conversationId);

    if (!resolution) {
      return {
        processedInput: input,
        resolution: null,
        hasChanges: false,
      };
    }

    return {
      processedInput: resolution.resolvedInput,
      resolution,
      hasChanges: resolution.references.length > 0,
    };
  }

  // ============================================
  // 消息记录
  // ============================================

  /**
   * 记录用户消息
   */
  recordUserMessage(
    conversationId: string,
    userId: string,
    content: string,
    intentType?: string,
    subType?: string,
  ): void {
    if (!this.config.enableAutoRecording) return;

    // 确保会话存在
    this.sessionMemory.getOrCreateState(conversationId, userId);

    const message: ConversationMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content,
      timestamp: Date.now(),
      intentType,
      subType,
    };

    this.sessionMemory.addMessage(conversationId, message);
  }

  /**
   * 记录助手消息
   */
  recordAssistantMessage(
    conversationId: string,
    content: string,
    intentType?: string,
    subType?: string,
  ): void {
    if (!this.config.enableAutoRecording) return;

    const message: ConversationMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content,
      timestamp: Date.now(),
      intentType,
      subType,
    };

    this.sessionMemory.addMessage(conversationId, message);
  }

  // ============================================
  // 输出记录
  // ============================================

  /**
   * 记录 AI 输出
   */
  recordOutput(conversationId: string, output: LastOutputSummary): void {
    if (!this.config.enableAutoRecording) return;

    this.sessionMemory.recordOutput(conversationId, output);
  }

  /**
   * 记录搜索结果
   */
  recordSearchResults(
    conversationId: string,
    query: string,
    resultIds: number[],
  ): void {
    if (!this.config.enableAutoRecording) return;

    const results: SearchResultSummary = {
      query,
      resultCount: resultIds.length,
      resultIds,
      searchedAt: Date.now(),
    };

    this.sessionMemory.recordSearchResults(conversationId, results);
  }

  // ============================================
  // 实体提及记录
  // ============================================

  /**
   * 记录提及的书签
   */
  recordMentionedBookmarks(
    conversationId: string,
    bookmarks: Array<{ id: number; name: string }>,
  ): void {
    if (!this.config.enableAutoRecording) return;

    const entities: MentionedEntity[] = bookmarks.map((b) => ({
      type: "bookmark" as const,
      id: b.id,
      name: b.name,
      mentionedAt: Date.now(),
    }));

    this.sessionMemory.recordMentionedBookmarks(conversationId, entities);
  }

  /**
   * 记录提及的文件夹
   */
  recordMentionedFolders(
    conversationId: string,
    folders: Array<{ id: number; name: string }>,
  ): void {
    if (!this.config.enableAutoRecording) return;

    const entities: MentionedEntity[] = folders.map((f) => ({
      type: "folder" as const,
      id: f.id,
      name: f.name,
      mentionedAt: Date.now(),
    }));

    this.sessionMemory.recordMentionedFolders(conversationId, entities);
  }

  // ============================================
  // 上下文获取
  // ============================================

  /**
   * 获取最近的消息历史
   */
  getRecentMessages(
    conversationId: string,
    count?: number,
  ): ConversationMessage[] {
    return this.sessionMemory.getRecentMessages(conversationId, count);
  }

  /**
   * 获取最近的输出
   */
  getLastOutput(conversationId: string): LastOutputSummary | undefined {
    return this.sessionMemory.getLastOutput(conversationId);
  }

  /**
   * 获取最近的搜索结果
   */
  getLastSearchResults(
    conversationId: string,
  ): SearchResultSummary | undefined {
    return this.sessionMemory.getLastSearchResults(conversationId);
  }

  /**
   * 获取提及的书签
   */
  getMentionedBookmarks(
    conversationId: string,
    count?: number,
  ): MentionedEntity[] {
    return this.sessionMemory.getMentionedBookmarks(conversationId, count);
  }

  /**
   * 获取提及的文件夹
   */
  getMentionedFolders(
    conversationId: string,
    count?: number,
  ): MentionedEntity[] {
    return this.sessionMemory.getMentionedFolders(conversationId, count);
  }

  // ============================================
  // 上下文摘要（用于 Prompt）
  // ============================================

  /**
   * 生成上下文摘要（用于注入到 Prompt）
   */
  generateContextSummary(conversationId: string): string | null {
    const state = this.sessionMemory.getState(conversationId);

    if (!state) {
      return null;
    }

    const parts: string[] = [];

    // 最近的搜索结果
    if (state.lastSearchResults && state.lastSearchResults.resultCount > 0) {
      parts.push(
        `[上下文] 用户刚才搜索了"${state.lastSearchResults.query}"，找到 ${state.lastSearchResults.resultCount} 条结果`,
      );
    }

    // 最近的输出
    if (state.lastOutput) {
      parts.push(`[上下文] AI 刚才的输出：${state.lastOutput.summary}`);
    }

    // 提及的书签
    if (state.mentionedBookmarks.length > 0) {
      const names = state.mentionedBookmarks
        .slice(-3)
        .map((b) => b.name)
        .join("、");
      parts.push(`[上下文] 最近提到的书签：${names}`);
    }

    // 提及的文件夹
    if (state.mentionedFolders.length > 0) {
      const names = state.mentionedFolders
        .slice(-3)
        .map((f) => f.name)
        .join("、");
      parts.push(`[上下文] 最近提到的文件夹：${names}`);
    }

    if (parts.length === 0) {
      return null;
    }

    return parts.join("\n");
  }

  // ============================================
  // 管理方法
  // ============================================

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessionMemory.getActiveSessionCount();
  }

  /**
   * 清理过期会话
   */
  cleanup(): number {
    return this.sessionMemory.cleanup();
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.sessionMemory.destroy();
  }

  /**
   * 获取配置
   */
  getConfig(): Required<MemoryManagerConfig> {
    return { ...this.config };
  }
}

/**
 * 创建 MemoryManager 实例
 */
export function createMemoryManager(
  config?: MemoryManagerConfig,
): MemoryManager {
  return new MemoryManager(config);
}

/**
 * 默认 MemoryManager 实例
 */
export const memoryManager = new MemoryManager();
