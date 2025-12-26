/**
 * SessionMemory - 会话状态管理
 *
 * 职责：
 * - 管理会话级别的上下文状态
 * - 记录消息历史、搜索结果、提及实体
 * - 提供会话状态的 CRUD 操作
 * - 自动清理过期会话
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type {
  ConversationState,
  ConversationMessage,
  MentionedEntity,
  SearchResultSummary,
  LastOutputSummary,
  SessionMemoryConfig,
  StateUpdateOptions,
} from "./types";
import { DEFAULT_SESSION_MEMORY_CONFIG } from "./types";

/**
 * 会话记忆管理器
 *
 * 使用内存 Map 存储会话状态，支持过期清理
 */
export class SessionMemory {
  /** 会话状态 Map（子类可访问以支持持久化恢复） */
  protected sessions: Map<string, ConversationState> = new Map();
  private config: Required<SessionMemoryConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: SessionMemoryConfig = {}) {
    this.config = {
      ...DEFAULT_SESSION_MEMORY_CONFIG,
      ...config,
    };

    // 启动自动清理
    this.startCleanupTimer();
  }

  // ============================================
  // 会话状态 CRUD
  // ============================================

  /**
   * 获取会话状态
   *
   * @param conversationId - 会话 ID
   * @returns 会话状态，不存在则返回 undefined
   */
  getState(conversationId: string): ConversationState | undefined {
    const state = this.sessions.get(conversationId);

    if (state) {
      // 检查是否过期
      if (this.isExpired(state)) {
        this.sessions.delete(conversationId);
        return undefined;
      }
    }

    return state;
  }

  /**
   * 创建或获取会话状态
   *
   * @param conversationId - 会话 ID
   * @param userId - 用户 ID
   * @returns 会话状态
   */
  getOrCreateState(conversationId: string, userId: string): ConversationState {
    let state = this.getState(conversationId);

    if (!state) {
      state = this.createState(conversationId, userId);
    }

    return state;
  }

  /**
   * 创建新会话状态
   *
   * @param conversationId - 会话 ID
   * @param userId - 用户 ID
   * @returns 新创建的会话状态
   */
  createState(conversationId: string, userId: string): ConversationState {
    const now = Date.now();

    const state: ConversationState = {
      conversationId,
      userId,
      messages: [],
      mentionedBookmarks: [],
      mentionedFolders: [],
      mentionedTags: [],
      createdAt: now,
      lastActivityAt: now,
    };

    this.sessions.set(conversationId, state);

    logger.debug(
      { conversationId, userId: userId.slice(0, 8) + "..." },
      "SessionMemory: Created new session",
    );

    return state;
  }

  /**
   * 更新会话状态
   *
   * @param conversationId - 会话 ID
   * @param updates - 更新内容
   * @param options - 更新选项
   * @returns 更新后的状态，不存在则返回 undefined
   */
  updateState(
    conversationId: string,
    updates: Partial<ConversationState>,
    options: StateUpdateOptions = {},
  ): ConversationState | undefined {
    const state = this.getState(conversationId);

    if (!state) {
      return undefined;
    }

    // 应用更新
    const updatedState: ConversationState = {
      ...state,
      ...updates,
      // 保持 ID 不变
      conversationId: state.conversationId,
      userId: state.userId,
      createdAt: state.createdAt,
    };

    // 更新最后活动时间
    if (options.updateLastActivity !== false) {
      updatedState.lastActivityAt = Date.now();
    }

    this.sessions.set(conversationId, updatedState);

    return updatedState;
  }

  /**
   * 删除会话状态
   *
   * @param conversationId - 会话 ID
   * @returns 是否删除成功
   */
  deleteState(conversationId: string): boolean {
    const existed = this.sessions.has(conversationId);
    this.sessions.delete(conversationId);

    if (existed) {
      logger.debug({ conversationId }, "SessionMemory: Deleted session");
    }

    return existed;
  }

  // ============================================
  // 消息记录
  // ============================================

  /**
   * 添加消息到历史
   *
   * @param conversationId - 会话 ID
   * @param message - 消息
   * @returns 更新后的状态
   */
  addMessage(
    conversationId: string,
    message: ConversationMessage,
  ): ConversationState | undefined {
    const state = this.getState(conversationId);

    if (!state) {
      return undefined;
    }

    // 添加消息
    const messages = [...state.messages, message];

    // 限制历史数量
    const trimmedMessages = messages.slice(-this.config.maxMessageHistory);

    return this.updateState(conversationId, { messages: trimmedMessages });
  }

  /**
   * 获取最近的消息
   *
   * @param conversationId - 会话 ID
   * @param count - 数量（默认全部）
   * @returns 消息列表
   */
  getRecentMessages(
    conversationId: string,
    count?: number,
  ): ConversationMessage[] {
    const state = this.getState(conversationId);

    if (!state) {
      return [];
    }

    if (count === undefined) {
      return state.messages;
    }

    return state.messages.slice(-count);
  }

  // ============================================
  // 输出记录
  // ============================================

  /**
   * 记录 AI 输出
   *
   * @param conversationId - 会话 ID
   * @param output - 输出摘要
   * @returns 更新后的状态
   */
  recordOutput(
    conversationId: string,
    output: LastOutputSummary,
  ): ConversationState | undefined {
    return this.updateState(conversationId, { lastOutput: output });
  }

  /**
   * 获取最近的输出
   *
   * @param conversationId - 会话 ID
   * @returns 最近的输出，不存在则返回 undefined
   */
  getLastOutput(conversationId: string): LastOutputSummary | undefined {
    return this.getState(conversationId)?.lastOutput;
  }

  // ============================================
  // 搜索结果记录
  // ============================================

  /**
   * 记录搜索结果
   *
   * @param conversationId - 会话 ID
   * @param results - 搜索结果摘要
   * @returns 更新后的状态
   */
  recordSearchResults(
    conversationId: string,
    results: SearchResultSummary,
  ): ConversationState | undefined {
    return this.updateState(conversationId, { lastSearchResults: results });
  }

  /**
   * 获取最近的搜索结果
   *
   * @param conversationId - 会话 ID
   * @returns 搜索结果，不存在则返回 undefined
   */
  getLastSearchResults(
    conversationId: string,
  ): SearchResultSummary | undefined {
    return this.getState(conversationId)?.lastSearchResults;
  }

  // ============================================
  // 实体提及记录
  // ============================================

  /**
   * 记录提及的书签
   *
   * @param conversationId - 会话 ID
   * @param bookmarks - 书签实体列表
   * @returns 更新后的状态
   */
  recordMentionedBookmarks(
    conversationId: string,
    bookmarks: MentionedEntity[],
  ): ConversationState | undefined {
    const state = this.getState(conversationId);

    if (!state) {
      return undefined;
    }

    // 合并并去重
    const existingIds = new Set(state.mentionedBookmarks.map((b) => b.id));
    const newBookmarks = bookmarks.filter((b) => !existingIds.has(b.id));
    const merged = [...state.mentionedBookmarks, ...newBookmarks];

    // 限制数量
    const trimmed = merged.slice(-this.config.maxMentionedEntities);

    return this.updateState(conversationId, { mentionedBookmarks: trimmed });
  }

  /**
   * 记录提及的文件夹
   *
   * @param conversationId - 会话 ID
   * @param folders - 文件夹实体列表
   * @returns 更新后的状态
   */
  recordMentionedFolders(
    conversationId: string,
    folders: MentionedEntity[],
  ): ConversationState | undefined {
    const state = this.getState(conversationId);

    if (!state) {
      return undefined;
    }

    const existingIds = new Set(state.mentionedFolders.map((f) => f.id));
    const newFolders = folders.filter((f) => !existingIds.has(f.id));
    const merged = [...state.mentionedFolders, ...newFolders];
    const trimmed = merged.slice(-this.config.maxMentionedEntities);

    return this.updateState(conversationId, { mentionedFolders: trimmed });
  }

  /**
   * 记录提及的标签
   *
   * @param conversationId - 会话 ID
   * @param tags - 标签实体列表
   * @returns 更新后的状态
   */
  recordMentionedTags(
    conversationId: string,
    tags: MentionedEntity[],
  ): ConversationState | undefined {
    const state = this.getState(conversationId);

    if (!state) {
      return undefined;
    }

    const existingIds = new Set(state.mentionedTags.map((t) => t.id));
    const newTags = tags.filter((t) => !existingIds.has(t.id));
    const merged = [...state.mentionedTags, ...newTags];
    const trimmed = merged.slice(-this.config.maxMentionedEntities);

    return this.updateState(conversationId, { mentionedTags: trimmed });
  }

  /**
   * 获取最近提及的书签
   *
   * @param conversationId - 会话 ID
   * @param count - 数量（默认全部）
   * @returns 书签实体列表
   */
  getMentionedBookmarks(
    conversationId: string,
    count?: number,
  ): MentionedEntity[] {
    const state = this.getState(conversationId);

    if (!state) {
      return [];
    }

    if (count === undefined) {
      return state.mentionedBookmarks;
    }

    return state.mentionedBookmarks.slice(-count);
  }

  /**
   * 获取最近提及的文件夹
   *
   * @param conversationId - 会话 ID
   * @param count - 数量（默认全部）
   * @returns 文件夹实体列表
   */
  getMentionedFolders(
    conversationId: string,
    count?: number,
  ): MentionedEntity[] {
    const state = this.getState(conversationId);

    if (!state) {
      return [];
    }

    if (count === undefined) {
      return state.mentionedFolders;
    }

    return state.mentionedFolders.slice(-count);
  }

  // ============================================
  // 过期清理
  // ============================================

  /**
   * 检查会话是否过期
   *
   * @param state - 会话状态
   * @returns 是否过期
   */
  private isExpired(state: ConversationState): boolean {
    const now = Date.now();
    return now - state.lastActivityAt > this.config.sessionExpiryMs;
  }

  /**
   * 清理过期会话
   *
   * @returns 清理的会话数量
   */
  cleanup(): number {
    let cleanedCount = 0;

    for (const [conversationId, state] of this.sessions) {
      if (this.isExpired(state)) {
        this.sessions.delete(conversationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        { cleanedCount, remainingCount: this.sessions.size },
        "SessionMemory: Cleaned up expired sessions",
      );
    }

    return cleanedCount;
  }

  /**
   * 启动自动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // 防止定时器阻止进程退出
    if (typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 停止自动清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ============================================
  // 统计与调试
  // ============================================

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    // 先清理过期会话
    this.cleanup();
    return this.sessions.size;
  }

  /**
   * 获取所有会话 ID（调试用）
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 清空所有会话（测试用）
   */
  clearAll(): void {
    this.sessions.clear();
    logger.debug("SessionMemory: Cleared all sessions");
  }

  /**
   * 获取配置
   */
  getConfig(): Required<SessionMemoryConfig> {
    return { ...this.config };
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clearAll();
  }
}

/**
 * 创建 SessionMemory 实例
 */
export function createSessionMemory(
  config?: SessionMemoryConfig,
): SessionMemory {
  return new SessionMemory(config);
}

/**
 * 默认 SessionMemory 实例
 */
export const sessionMemory = new SessionMemory();
