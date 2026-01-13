/**
 * 对话持久化存储模块
 *
 * 提供 localStorage 本地存储功能，用于保存和恢复 AI 对话会话
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import type { ChatMessage } from "@/hooks/domain/ai/use-ai-chat";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "anykeep_ai_current_session";
const MAX_MESSAGES = 50;
const SESSION_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// Types
// =============================================================================

/**
 * 存储的会话数据结构
 */
export interface StoredSession {
  /** 会话 ID */
  conversationId: string;
  /** 消息列表 */
  messages: ChatMessage[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

// =============================================================================
// Storage API
// =============================================================================

/**
 * 对话持久化存储服务
 *
 * @example
 * ```typescript
 * // 保存会话
 * conversationStorage.save('conv_123', messages);
 *
 * // 恢复会话
 * const session = conversationStorage.restore();
 * if (session) {
 *   setMessages(session.messages);
 * }
 *
 * // 清除会话
 * conversationStorage.clear();
 * ```
 */
export const conversationStorage = {
  /**
   * 保存当前会话到 localStorage
   *
   * @param conversationId - 会话 ID
   * @param messages - 消息列表
   *
   * @remarks
   * - 只保留最近 MAX_MESSAGES 条消息
   * - 存储失败时会尝试清理旧数据
   */
  save(conversationId: string, messages: ChatMessage[]): void {
    if (typeof window === "undefined") return;

    const session: StoredSession = {
      conversationId,
      messages: messages.slice(-MAX_MESSAGES), // 只保留最近 50 条
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      // localStorage 满了，清理旧数据
      console.error("[ConversationStorage] Storage full, clearing old data", e);
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  /**
   * 从 localStorage 恢复会话
   *
   * @returns 存储的会话数据，如果不存在或已过期则返回 null
   *
   * @remarks
   * - 检查会话是否过期（24小时）
   * - 解析失败时会自动清理损坏的数据
   */
  restore(): StoredSession | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const session: StoredSession = JSON.parse(stored);

      // 检查是否过期
      const updatedAt = new Date(session.updatedAt).getTime();
      if (Date.now() - updatedAt > SESSION_EXPIRE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // 验证数据完整性
      if (!session.conversationId || !Array.isArray(session.messages)) {
        console.error("[ConversationStorage] Invalid session data, clearing");
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return session;
    } catch {
      console.error("[ConversationStorage] Failed to parse session, clearing");
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  /**
   * 清除 localStorage 中的会话数据
   */
  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * 更新会话 ID（新建会话时使用）
   *
   * @param newId - 新的会话 ID
   */
  updateConversationId(newId: string): void {
    const session = this.restore();
    if (session) {
      session.conversationId = newId;
      session.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch {
        // 忽略存储失败
      }
    }
  },

  /**
   * 检查是否有存储的会话
   *
   * @returns 是否存在有效会话
   */
  hasSession(): boolean {
    return this.restore() !== null;
  },

  /**
   * 获取存储 Key（用于调试）
   */
  getStorageKey(): string {
    return STORAGE_KEY;
  },
};

export default conversationStorage;
