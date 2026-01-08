/**
 * 会话附件追踪器
 *
 * 跟踪会话中使用的附件，支持：
 * - 多轮对话中的附件引用
 * - "刚才那个附件"等指代解析
 * - 附件使用统计
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-08 - 添加内存管理（TTL、数量限制）
 */

// =============================================================================
// 配置常量
// =============================================================================

/**
 * 追踪器配置
 */
const TRACKER_CONFIG = {
  /** 最大会话数量 */
  MAX_CONVERSATIONS: 100,
  /** 每会话最大附件数量 */
  MAX_ATTACHMENTS_PER_CONVERSATION: 50,
  /** 会话过期时间（毫秒）：1 小时 */
  TTL_MS: 60 * 60 * 1000,
  /** 清理检查间隔（毫秒）：5 分钟 */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const;

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 会话附件记录
 */
export interface ConversationAttachment {
  /** 书签 ID (仅书签类型) */
  bookmarkId?: number;
  /** 文件名 (仅文件类型) */
  fileName?: string;
  /** 附件类型 */
  type: "bookmark" | "file";
  /** 标题 */
  title: string;
  /** 所属消息 ID */
  messageId: string;
  /** 使用时间 */
  usedAt: Date;
}

/**
 * 会话附件存储
 */
export interface ConversationAttachmentStore {
  /** 会话 ID */
  conversationId: string;
  /** 附件记录（按消息 ID 分组） */
  attachmentsByMessage: Map<string, ConversationAttachment[]>;
  /** 所有附件（按添加顺序） */
  allAttachments: ConversationAttachment[];
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 附件输入类型（用于记录）
 */
export interface AttachmentInput {
  bookmarkId?: number;
  fileName?: string;
  type: "bookmark" | "file";
  title: string;
}

// =============================================================================
// 指代解析常量
// =============================================================================

/**
 * 序数映射
 */
const ORDINAL_MAP: Record<string, number> = {
  一: 0,
  二: 1,
  三: 2,
  四: 3,
  五: 4,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
};

// =============================================================================
// 追踪器实现
// =============================================================================

/**
 * 会话附件追踪器
 *
 * 单例模式，全局共享
 * 内置内存管理：TTL 过期、数量限制
 */
class ConversationAttachmentTracker {
  private stores = new Map<string, ConversationAttachmentStore>();
  private lastCleanupTime = Date.now();

  /**
   * 清理过期会话
   *
   * @returns 清理的会话数量
   */
  private cleanupExpiredStores(): number {
    const now = Date.now();

    // 节流：避免频繁清理
    if (now - this.lastCleanupTime < TRACKER_CONFIG.CLEANUP_INTERVAL_MS) {
      return 0;
    }

    this.lastCleanupTime = now;
    let cleanedCount = 0;

    for (const [key, store] of this.stores.entries()) {
      const age = now - store.updatedAt.getTime();
      if (age > TRACKER_CONFIG.TTL_MS) {
        this.stores.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 淘汰最旧的会话（LRU 策略）
   */
  private evictOldestIfNeeded(): void {
    if (this.stores.size < TRACKER_CONFIG.MAX_CONVERSATIONS) {
      return;
    }

    // 找到最旧的会话
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, store] of this.stores.entries()) {
      if (store.updatedAt.getTime() < oldestTime) {
        oldestTime = store.updatedAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.stores.delete(oldestKey);
    }
  }

  /**
   * 记录附件使用
   *
   * @param conversationId 会话 ID
   * @param messageId 消息 ID
   * @param attachments 附件列表
   */
  recordAttachments(
    conversationId: string,
    messageId: string,
    attachments: AttachmentInput[],
  ): void {
    if (!conversationId || !messageId || attachments.length === 0) {
      return;
    }

    // 清理过期会话
    this.cleanupExpiredStores();

    // 获取或创建存储
    if (!this.stores.has(conversationId)) {
      // 淘汰最旧的会话（如果达到上限）
      this.evictOldestIfNeeded();

      this.stores.set(conversationId, {
        conversationId,
        attachmentsByMessage: new Map(),
        allAttachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const store = this.stores.get(conversationId)!;
    const now = new Date();

    // 创建附件记录
    const records: ConversationAttachment[] = attachments.map((a) => ({
      ...a,
      messageId,
      usedAt: now,
    }));

    // 限制附件数量（移除最旧的）
    while (
      store.allAttachments.length + records.length >
      TRACKER_CONFIG.MAX_ATTACHMENTS_PER_CONVERSATION
    ) {
      store.allAttachments.shift();
    }

    // 更新存储
    store.attachmentsByMessage.set(messageId, records);
    store.allAttachments.push(...records);
    store.updatedAt = now;
  }

  /**
   * 获取最近的附件
   *
   * @param conversationId 会话 ID
   * @param limit 限制数量
   * @returns 附件列表
   */
  getRecentAttachments(
    conversationId: string,
    limit = 5,
  ): ConversationAttachment[] {
    const store = this.stores.get(conversationId);
    if (!store) return [];

    return store.allAttachments.slice(-limit);
  }

  /**
   * 获取消息的附件
   *
   * @param conversationId 会话 ID
   * @param messageId 消息 ID
   * @returns 附件列表
   */
  getMessageAttachments(
    conversationId: string,
    messageId: string,
  ): ConversationAttachment[] {
    const store = this.stores.get(conversationId);
    if (!store) return [];

    return store.attachmentsByMessage.get(messageId) ?? [];
  }

  /**
   * 获取所有附件
   *
   * @param conversationId 会话 ID
   * @returns 附件列表
   */
  getAllAttachments(conversationId: string): ConversationAttachment[] {
    const store = this.stores.get(conversationId);
    if (!store) return [];

    return [...store.allAttachments];
  }

  /**
   * 解析附件指代
   *
   * 支持：
   * - "刚才那个附件" → 最后一个附件
   * - "第一个书签" → 第一个书签类型附件
   * - "那个 PDF" → 最近的 PDF 文件
   *
   * @param conversationId 会话 ID
   * @param reference 指代文本
   * @returns 解析到的附件或 null
   */
  resolveAttachmentReference(
    conversationId: string,
    reference: string,
  ): ConversationAttachment | null {
    const store = this.stores.get(conversationId);
    if (!store || store.allAttachments.length === 0) return null;

    const lowerRef = reference.toLowerCase();

    // 1. 最后一个附件
    if (
      lowerRef.includes("刚才") ||
      lowerRef.includes("那个附件") ||
      lowerRef.includes("上一个")
    ) {
      return store.allAttachments[store.allAttachments.length - 1];
    }

    // 2. 第 N 个（总体）
    const ordinalMatch = lowerRef.match(/第([一二三四五1-5])个/);
    if (
      ordinalMatch &&
      !lowerRef.includes("书签") &&
      !lowerRef.includes("文件")
    ) {
      const index = ORDINAL_MAP[ordinalMatch[1]] ?? 0;
      return store.allAttachments[index] ?? null;
    }

    // 3. 第 N 个书签
    const bookmarkOrdinalMatch = lowerRef.match(
      /第([一二三四五1-5])个.*(书签|收藏)/,
    );
    if (bookmarkOrdinalMatch) {
      const index = ORDINAL_MAP[bookmarkOrdinalMatch[1]] ?? 0;
      const bookmarks = store.allAttachments.filter(
        (a) => a.type === "bookmark",
      );
      return bookmarks[index] ?? null;
    }

    // 4. 第 N 个文件
    const fileOrdinalMatch = lowerRef.match(
      /第([一二三四五1-5])个.*(文件|pdf)/,
    );
    if (fileOrdinalMatch) {
      const index = ORDINAL_MAP[fileOrdinalMatch[1]] ?? 0;
      const files = store.allAttachments.filter((a) => a.type === "file");
      return files[index] ?? null;
    }

    // 5. 按类型（最后一个）
    if (lowerRef.includes("书签") || lowerRef.includes("收藏")) {
      const bookmarks = store.allAttachments.filter(
        (a) => a.type === "bookmark",
      );
      return bookmarks.length > 0 ? bookmarks[bookmarks.length - 1] : null;
    }

    if (lowerRef.includes("文件") || lowerRef.includes("pdf")) {
      const files = store.allAttachments.filter((a) => a.type === "file");
      return files.length > 0 ? files[files.length - 1] : null;
    }

    // 6. 按标题匹配（模糊）
    const titleMatch = store.allAttachments.find((a) =>
      a.title.toLowerCase().includes(lowerRef),
    );
    if (titleMatch) {
      return titleMatch;
    }

    return null;
  }

  /**
   * 检查会话是否有附件
   *
   * @param conversationId 会话 ID
   * @returns 是否有附件
   */
  hasAttachments(conversationId: string): boolean {
    const store = this.stores.get(conversationId);
    return store ? store.allAttachments.length > 0 : false;
  }

  /**
   * 获取附件统计
   *
   * @param conversationId 会话 ID
   * @returns 统计信息
   */
  getStats(conversationId: string): {
    total: number;
    bookmarkCount: number;
    fileCount: number;
    messageCount: number;
  } {
    const store = this.stores.get(conversationId);
    if (!store) {
      return { total: 0, bookmarkCount: 0, fileCount: 0, messageCount: 0 };
    }

    return {
      total: store.allAttachments.length,
      bookmarkCount: store.allAttachments.filter((a) => a.type === "bookmark")
        .length,
      fileCount: store.allAttachments.filter((a) => a.type === "file").length,
      messageCount: store.attachmentsByMessage.size,
    };
  }

  /**
   * 清理会话
   *
   * @param conversationId 会话 ID
   */
  clearConversation(conversationId: string): void {
    this.stores.delete(conversationId);
  }

  /**
   * 清理所有会话
   */
  clearAll(): void {
    this.stores.clear();
  }

  /**
   * 获取活跃会话数
   */
  getActiveConversationCount(): number {
    return this.stores.size;
  }
}

// =============================================================================
// 导出
// =============================================================================

/**
 * 全局会话附件追踪器实例
 */
export const conversationAttachmentTracker =
  new ConversationAttachmentTracker();

export default conversationAttachmentTracker;
