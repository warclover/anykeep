/**
 * Brain-Sync 触发标签配置
 * 定义哪些标签会触发 Flashcard 生成
 *
 * @module shared/review/review-trigger-tags
 */

/**
 * 触发复习功能的标签列表
 * 用户为书签添加这些标签时，会自动生成 Flashcards
 */
export const REVIEW_TRIGGER_TAGS = [
  // 中文标签
  "值得复读",
  "值得复习",
  "需要记住",
  "重要知识",
  "学习笔记",
  "深度阅读",
  "核心概念",
  "必读",
  "精读",
  "重点",

  // 英文标签
  "worth-review",
  "to-memorize",
  "important",
  "must-remember",
  "key-concept",
  "deep-read",
  "must-read",
  "review",
] as const;

export type ReviewTriggerTag = (typeof REVIEW_TRIGGER_TAGS)[number];

/**
 * 检查标签列表中是否包含触发标签
 * @param tags 标签数组
 * @returns 是否包含触发标签
 */
export function hasReviewTriggerTag(tags: string[]): boolean {
  if (!tags || tags.length === 0) return false;

  const normalizedTriggers = REVIEW_TRIGGER_TAGS.map((t) => t.toLowerCase());

  return tags.some((tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    return normalizedTriggers.some(
      (trigger) => normalizedTag === trigger || normalizedTag.includes(trigger),
    );
  });
}

/**
 * 从标签列表中提取触发标签
 * @param tags 标签数组
 * @returns 匹配的触发标签列表
 */
export function extractTriggerTags(tags: string[]): string[] {
  if (!tags || tags.length === 0) return [];

  const normalizedTriggers = REVIEW_TRIGGER_TAGS.map((t) => t.toLowerCase());

  return tags.filter((tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    return normalizedTriggers.some(
      (trigger) => normalizedTag === trigger || normalizedTag.includes(trigger),
    );
  });
}

/**
 * 检查标签变更是否新增了触发标签
 * @param oldTags 旧标签列表
 * @param newTags 新标签列表
 * @returns 是否新增了触发标签
 */
export function hasNewTriggerTag(
  oldTags: string[],
  newTags: string[],
): boolean {
  const hadTrigger = hasReviewTriggerTag(oldTags);
  const hasTrigger = hasReviewTriggerTag(newTags);
  return !hadTrigger && hasTrigger;
}

/**
 * 检查标签变更是否移除了所有触发标签
 * @param oldTags 旧标签列表
 * @param newTags 新标签列表
 * @returns 是否移除了所有触发标签
 */
export function hasRemovedAllTriggerTags(
  oldTags: string[],
  newTags: string[],
): boolean {
  const hadTrigger = hasReviewTriggerTag(oldTags);
  const hasTrigger = hasReviewTriggerTag(newTags);
  return hadTrigger && !hasTrigger;
}
