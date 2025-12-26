/**
 * PersistentSessionMemory - 支持持久化的会话记忆
 *
 * 职责：
 * - 继承 SessionMemory 的所有功能
 * - 自动将状态变更同步到数据库
 * - 支持从数据库恢复会话状态
 * - 服务重启后自动恢复上下文
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import { SessionMemory } from "./session-memory";
import type { MemoryPersistence } from "./persistence";
import { memoryPersistence } from "./persistence";
import type {
  ConversationState,
  ConversationMessage,
  MentionedEntity,
  SearchResultSummary,
  LastOutputSummary,
  SessionMemoryConfig,
} from "./types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 持久化会话记忆配置
 */
export interface PersistentSessionMemoryConfig extends SessionMemoryConfig {
  /** 是否启用持久化（默认 true） */
  enablePersistence?: boolean;
  /** 持久化服务实例（可选） */
  persistenceService?: MemoryPersistence;
}

// =============================================================================
// PersistentSessionMemory 类
// =============================================================================

/**
 * 支持持久化的会话记忆
 *
 * 在 SessionMemory 基础上添加：
 * - 自动持久化状态变更
 * - 从数据库恢复会话
 * - 跨服务重启上下文保持
 */
export class PersistentSessionMemory extends SessionMemory {
  private readonly persistence: MemoryPersistence;
  private readonly enablePersistence: boolean;
  private loadedSessions: Set<string> = new Set();

  constructor(config: PersistentSessionMemoryConfig = {}) {
    super(config);

    this.enablePersistence = config.enablePersistence !== false;
    this.persistence = config.persistenceService || memoryPersistence;
  }

  // ==========================================================================
  // 重写核心方法以支持持久化
  // ==========================================================================

  /**
   * 获取或创建会话状态（支持从数据库恢复）
   */
  async getOrCreateStateAsync(
    conversationId: string,
    userId: string,
  ): Promise<ConversationState> {
    // 先尝试从内存获取
    let state = super.getState(conversationId);

    if (state) {
      return state;
    }

    // 尝试从数据库恢复
    if (this.enablePersistence && !this.loadedSessions.has(conversationId)) {
      const result = await this.persistence.loadState({
        userId,
        conversationId,
      });

      if (result.success && result.data) {
        // 恢复到内存
        state = result.data;

        // 使用 protected sessions Map 恢复状态（绕过 createState 避免重复创建）
        this.sessions.set(conversationId, state);

        this.loadedSessions.add(conversationId);

        logger.info(
          {
            conversationId,
            messageCount: state.messages.length,
          },
          "PersistentSessionMemory: Restored session from database",
        );

        return state;
      }

      this.loadedSessions.add(conversationId);
    }

    // 创建新会话
    return super.getOrCreateState(conversationId, userId);
  }

  /**
   * 更新会话状态并持久化
   */
  updateStateAndPersist(
    conversationId: string,
    updates: Partial<ConversationState>,
    lastIntent?: string,
  ): ConversationState | undefined {
    const state = super.updateState(conversationId, updates);

    if (state && this.enablePersistence) {
      // 异步持久化（不阻塞）
      this.persistState(state, lastIntent).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist state",
        );
      });
    }

    return state;
  }

  /**
   * 添加消息并持久化
   */
  addMessageAndPersist(
    conversationId: string,
    message: ConversationMessage,
  ): ConversationState | undefined {
    const state = super.addMessage(conversationId, message);

    if (state && this.enablePersistence) {
      this.persistState(state, message.intentType).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist after adding message",
        );
      });
    }

    return state;
  }

  /**
   * 记录 AI 输出并持久化
   */
  recordOutputAndPersist(
    conversationId: string,
    output: LastOutputSummary,
  ): ConversationState | undefined {
    const state = super.recordOutput(conversationId, output);

    if (state && this.enablePersistence) {
      this.persistState(state).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist after recording output",
        );
      });
    }

    return state;
  }

  /**
   * 记录搜索结果并持久化
   */
  recordSearchResultsAndPersist(
    conversationId: string,
    results: SearchResultSummary,
  ): ConversationState | undefined {
    const state = super.recordSearchResults(conversationId, results);

    if (state && this.enablePersistence) {
      this.persistState(state).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist after recording search results",
        );
      });
    }

    return state;
  }

  /**
   * 记录提及的书签并持久化
   */
  recordMentionedBookmarksAndPersist(
    conversationId: string,
    bookmarks: MentionedEntity[],
  ): ConversationState | undefined {
    const state = super.recordMentionedBookmarks(conversationId, bookmarks);

    if (state && this.enablePersistence) {
      this.persistState(state).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist after recording bookmarks",
        );
      });
    }

    return state;
  }

  /**
   * 记录提及的文件夹并持久化
   */
  recordMentionedFoldersAndPersist(
    conversationId: string,
    folders: MentionedEntity[],
  ): ConversationState | undefined {
    const state = super.recordMentionedFolders(conversationId, folders);

    if (state && this.enablePersistence) {
      this.persistState(state).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist after recording folders",
        );
      });
    }

    return state;
  }

  /**
   * 记录提及的标签并持久化
   */
  recordMentionedTagsAndPersist(
    conversationId: string,
    tags: MentionedEntity[],
  ): ConversationState | undefined {
    const state = super.recordMentionedTags(conversationId, tags);

    if (state && this.enablePersistence) {
      this.persistState(state).catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "PersistentSessionMemory: Failed to persist after recording tags",
        );
      });
    }

    return state;
  }

  /**
   * 删除会话状态并从数据库移除
   */
  async deleteStateAndPersist(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const existed = super.deleteState(conversationId);

    if (this.enablePersistence) {
      await this.persistence.deleteState({ userId, conversationId });
      this.loadedSessions.delete(conversationId);
    }

    return existed;
  }

  /**
   * 重写清理方法，同步清理 loadedSessions 以防止内存泄漏
   */
  override cleanup(): number {
    const cleanedCount = super.cleanup();

    // 同步 loadedSessions：移除已不在 sessions Map 中的条目
    const activeSessionIds = new Set(this.getAllSessionIds());
    for (const conversationId of this.loadedSessions) {
      if (!activeSessionIds.has(conversationId)) {
        this.loadedSessions.delete(conversationId);
      }
    }

    return cleanedCount;
  }

  // ==========================================================================
  // 持久化辅助方法
  // ==========================================================================

  /**
   * 持久化会话状态
   */
  private async persistState(
    state: ConversationState,
    lastIntent?: string,
  ): Promise<void> {
    await this.persistence.saveState({
      userId: state.userId,
      conversationId: state.conversationId,
      state,
      lastIntent,
    });
  }

  /**
   * 强制同步所有内存中的会话到数据库
   */
  async flushAll(): Promise<{ successCount: number; failCount: number }> {
    if (!this.enablePersistence) {
      return { successCount: 0, failCount: 0 };
    }

    let successCount = 0;
    let failCount = 0;

    const sessionIds = this.getAllSessionIds();

    for (const conversationId of sessionIds) {
      const state = this.getState(conversationId);

      if (state) {
        const result = await this.persistence.saveStateImmediate({
          userId: state.userId,
          conversationId: state.conversationId,
          state,
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    logger.info(
      { successCount, failCount },
      "PersistentSessionMemory: Flushed all sessions",
    );

    return { successCount, failCount };
  }

  /**
   * 获取用户的活跃会话列表
   */
  async getActiveSessionsForUser(userId: string) {
    if (!this.enablePersistence) {
      return [];
    }

    const result = await this.persistence.getActiveSessions(userId);
    return result.success ? result.data || [] : [];
  }

  /**
   * 清理过期会话（内存 + 数据库）
   */
  async cleanupWithPersistence(): Promise<{
    memoryCleared: number;
    dbCleared: number;
  }> {
    // 清理内存
    const memoryCleared = this.cleanup();

    // 清理数据库
    let dbCleared = 0;
    if (this.enablePersistence) {
      const result = await this.persistence.cleanupExpired();
      if (result.success && result.data) {
        dbCleared = result.data.deletedCount;
      }
    }

    return { memoryCleared, dbCleared };
  }

  /**
   * 销毁实例
   */
  override destroy(): void {
    super.destroy();
    this.persistence.destroy();
    this.loadedSessions.clear();
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建持久化会话记忆实例
 */
export function createPersistentSessionMemory(
  config?: PersistentSessionMemoryConfig,
): PersistentSessionMemory {
  return new PersistentSessionMemory(config);
}

/**
 * 默认持久化会话记忆实例
 */
export const persistentSessionMemory = new PersistentSessionMemory();
