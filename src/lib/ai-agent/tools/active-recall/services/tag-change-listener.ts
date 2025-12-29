/**
 * 标签变更监听器服务
 *
 * 监听书签标签变更，触发 Flashcard 生成
 * 集成到现有的书签更新 API
 *
 * @module tools/active-recall/services/tag-change-listener
 * @version 1.0.0
 * @since 2025-12-29
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 常量定义
// ============================================

/**
 * 触发复习的标签列表
 * 用户为书签添加这些标签时，系统会自动生成 Flashcards
 */
export const REVIEW_TRIGGER_TAGS = [
  // 中文
  "值得复读",
  "值得复习",
  "需要记住",
  "重要知识",
  "学习笔记",
  "深度阅读",
  "核心概念",

  // 英文
  "worth-review",
  "to-memorize",
  "important",
  "must-remember",
  "key-knowledge",
] as const;

/**
 * 标签匹配模式（用于模糊匹配）
 */
const TRIGGER_TAG_PATTERNS = [
  /值得.*复/,
  /需要.*记/,
  /重要.*知识/,
  /学习.*笔记/,
  /^important$/i,
  /^must.*remember$/i,
  /^key.*knowledge$/i,
];

// ============================================
// 类型定义
// ============================================

/**
 * 标签变更事件参数
 */
export interface TagChangeEvent {
  bookmarkId: number;
  userId: string;
  oldTags: string[];
  newTags: string[];
}

/**
 * Flashcard 生成队列项
 * 未来用于消息队列的数据结构（预留）
 * @future 用于 Redis/RabbitMQ 队列
 */

interface _FlashcardQueueItem {
  bookmarkId: number;
  userId: string;
  priority: number;
  createdAt: Date;
}

// ============================================
// 标签匹配工具函数
// ============================================

/**
 * 检查标签是否为触发标签
 */
export function isTriggerTag(tag: string): boolean {
  const normalized = tag.toLowerCase().trim();

  // 精确匹配
  if (REVIEW_TRIGGER_TAGS.some((t) => t.toLowerCase() === normalized)) {
    return true;
  }

  // 模式匹配
  return TRIGGER_TAG_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * 检查标签列表中是否包含触发标签
 */
export function hasTriggerTag(tags: string[]): boolean {
  return tags.some(isTriggerTag);
}

/**
 * 获取列表中的触发标签
 */
export function getTriggerTags(tags: string[]): string[] {
  return tags.filter(isTriggerTag);
}

// ============================================
// 核心监听器函数
// ============================================

/**
 * 书签标签变更处理器
 *
 * 当书签标签发生变更时调用，检测是否需要触发 Flashcard 生成
 *
 * @param event - 标签变更事件
 * @returns 是否触发了 Flashcard 生成
 */
export async function onBookmarkTagsChanged(
  event: TagChangeEvent,
): Promise<{ triggered: boolean; action?: "generate" | "pause" }> {
  const { bookmarkId, userId, oldTags, newTags } = event;

  // 检查标签变化
  const wasTriggered = hasTriggerTag(oldTags);
  const isTriggered = hasTriggerTag(newTags);

  // 情况1：新增触发标签
  if (!wasTriggered && isTriggered) {
    const triggerTag = getTriggerTags(newTags)[0];
    logger.info(
      { bookmarkId, userId, triggerTag },
      "Trigger tag added, queueing flashcard generation",
    );

    await addToFlashcardGenerationQueue(bookmarkId, userId);
    return { triggered: true, action: "generate" };
  }

  // 情况2：移除触发标签
  if (wasTriggered && !isTriggered) {
    const removedTag = getTriggerTags(oldTags)[0];
    logger.info(
      { bookmarkId, userId, removedTag },
      "Trigger tag removed, pausing flashcard reviews",
    );

    await pauseFlashcardReviews(bookmarkId, userId);
    return { triggered: true, action: "pause" };
  }

  // 情况3：无触发变化
  return { triggered: false };
}

// ============================================
// Flashcard 队列管理
// ============================================

/**
 * 添加到 Flashcard 生成队列
 *
 * 将书签添加到后台生成队列，由定时任务处理
 */
export async function addToFlashcardGenerationQueue(
  bookmarkId: number,
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  try {
    // 检查用户是否开启了主动复习功能
    const { data: prefs, error: prefsError } = await supabase
      .from("review_preferences")
      .select("enabled")
      .eq("user_id", userId)
      .single();

    if (prefsError && prefsError.code !== "PGRST116") {
      // PGRST116 = 未找到记录
      logger.error(
        { error: prefsError.message, userId },
        "Failed to check review preferences",
      );
      return;
    }

    // 如果用户未开启功能，不生成
    if (!prefs?.enabled) {
      logger.debug(
        { bookmarkId, userId },
        "Active recall not enabled, skipping flashcard generation",
      );
      return;
    }

    // 检查是否已有该书签的 flashcards
    const { data: existingCards, error: checkError } = await supabase
      .from("flashcards")
      .select("id")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .limit(1);

    if (checkError) {
      logger.error(
        { error: checkError.message, bookmarkId },
        "Failed to check existing flashcards",
      );
      return;
    }

    if (existingCards && existingCards.length > 0) {
      logger.debug(
        { bookmarkId, userId },
        "Flashcards already exist for this bookmark",
      );
      return;
    }

    // 添加到生成队列
    // 当前简化实现：将书签 ID 记录到日志，由定时任务扫描处理
    // 未来可以使用消息队列或数据库队列表
    logger.info(
      { bookmarkId, userId, action: "queue_flashcard_generation" },
      "Bookmark queued for flashcard generation",
    );

    // 可选：如果有队列表，可以在这里插入
    // await supabase.from("flashcard_generation_queue").insert({
    //   bookmark_id: bookmarkId,
    //   user_id: userId,
    //   status: "pending",
    // });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err), bookmarkId },
      "Error adding to flashcard generation queue",
    );
  }
}

/**
 * 暂停书签的复习
 *
 * 当用户移除触发标签时，暂停该书签的复习调度
 * 保留已生成的 Flashcards，但不再安排复习
 */
export async function pauseFlashcardReviews(
  bookmarkId: number,
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  try {
    // 将该书签的所有 flashcards 状态设为 paused
    const { error } = await supabase
      .from("flashcards")
      .update({
        status: "paused",
        next_review_at: null,
      })
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error: error.message, bookmarkId },
        "Failed to pause flashcard reviews",
      );
      return;
    }

    logger.info({ bookmarkId, userId }, "Flashcard reviews paused");
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err), bookmarkId },
      "Error pausing flashcard reviews",
    );
  }
}

/**
 * 恢复书签的复习
 *
 * 当用户重新添加触发标签时，恢复该书签的复习调度
 */
export async function resumeFlashcardReviews(
  bookmarkId: number,
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  try {
    // 将 paused 状态的 flashcards 恢复为 pending
    const { error } = await supabase
      .from("flashcards")
      .update({
        status: "pending",
        next_review_at: new Date().toISOString(),
      })
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .eq("status", "paused");

    if (error) {
      logger.error(
        { error: error.message, bookmarkId },
        "Failed to resume flashcard reviews",
      );
      return;
    }

    logger.info({ bookmarkId, userId }, "Flashcard reviews resumed");
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err), bookmarkId },
      "Error resuming flashcard reviews",
    );
  }
}

// ============================================
// 集成辅助函数
// ============================================

/**
 * 创建标签变更监听器中间件
 *
 * 用于在书签更新 API 中集成标签变更检测
 */
export function createTagChangeMiddleware() {
  return async (
    bookmarkId: number,
    userId: string,
    beforeUpdate: { tags?: string[] },
    afterUpdate: { tags?: string[] },
  ) => {
    const oldTags = beforeUpdate.tags || [];
    const newTags = afterUpdate.tags || [];

    // 只有标签实际发生变化时才处理
    const tagsChanged =
      JSON.stringify(oldTags.sort()) !== JSON.stringify(newTags.sort());

    if (tagsChanged) {
      return onBookmarkTagsChanged({
        bookmarkId,
        userId,
        oldTags,
        newTags,
      });
    }

    return { triggered: false };
  };
}
