/**
 * 主动简报模块工具函数
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import { TIME_CONSTANTS } from "./constants";

// =============================================================================
// 时间工具函数
// =============================================================================

/**
 * 计算离线天数
 * @param lastVisit - 上次访问时间
 * @returns 离线天数（向下取整）
 */
export function calculateDaysSinceLastVisit(lastVisit: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - lastVisit.getTime();
  return Math.floor(diffMs / TIME_CONSTANTS.ONE_DAY_MS);
}

/**
 * 计算离线时长（毫秒）
 * @param lastVisit - 上次访问时间
 * @returns 离线时长（毫秒）
 */
export function calculateOfflineDuration(lastVisit: Date): number {
  return Date.now() - lastVisit.getTime();
}

/**
 * 格式化离线时长为可读字符串
 * @param durationMs - 时长（毫秒）
 * @returns 可读字符串，如 "3 天" 或 "5 小时"
 */
export function formatOfflineDuration(durationMs: number): string {
  const days = Math.floor(durationMs / TIME_CONSTANTS.ONE_DAY_MS);
  if (days >= 1) {
    return `${days} 天`;
  }

  const hours = Math.floor(durationMs / TIME_CONSTANTS.ONE_HOUR_MS);
  if (hours >= 1) {
    return `${hours} 小时`;
  }

  const minutes = Math.floor(durationMs / (60 * 1000));
  return `${minutes} 分钟`;
}

// =============================================================================
// ID 生成工具
// =============================================================================

/**
 * 生成洞察 ID
 * @param _type - 洞察类型（保留参数以保持 API 兼容性，类型信息存储在 insight.type 字段）
 * @returns 标准 UUID v4 格式
 */
export function generateInsightId(_type: string): string {
  return crypto.randomUUID();
}

/**
 * 生成操作 ID
 * @param _type - 操作类型（保留参数以保持 API 兼容性）
 * @returns 标准 UUID v4 格式
 */
export function generateActionId(_type: string): string {
  return crypto.randomUUID();
}

// =============================================================================
// 数据转换工具
// =============================================================================

/**
 * 将标签数组转换为主题分布
 * @param bookmarks - 书签列表
 * @returns 主题分布数组
 */
export function calculateTopicDistribution(
  bookmarks: Array<{ tags: string[] | null }>,
): Array<{ tag: string; count: number }> {
  const tagCount = new Map<string, number>();

  for (const bookmark of bookmarks) {
    const tags = bookmark.tags ?? [];
    for (const tag of tags) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagCount.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 获取新涌现的主题（最近出现且增长明显）
 * @param topicDistribution - 主题分布
 * @param threshold - 最小数量阈值
 * @returns 新涌现的主题列表
 */
export function getEmergingTopics(
  topicDistribution: Array<{ tag: string; count: number }>,
  threshold: number = 3,
): string[] {
  return topicDistribution
    .filter((t) => t.count >= threshold)
    .slice(0, 5)
    .map((t) => t.tag);
}

// =============================================================================
// 验证工具
// =============================================================================

/**
 * 验证用户 ID 格式
 * @param userId - 用户 ID
 * @returns 是否有效
 */
export function isValidUserId(userId: string): boolean {
  // UUID v4 格式验证
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

// =============================================================================
// 摘要生成工具
// =============================================================================

/**
 * 生成简单摘要（无 LLM）
 * @param newCount - 新增数量
 * @param days - 离线天数
 * @param topTopics - 热门主题
 * @returns 摘要文本
 */
export function generateSimpleSummary(
  newCount: number,
  days: number,
  topTopics: string[],
): string {
  if (newCount === 0) {
    return `在你离开的 ${days} 天里，没有新增收藏。`;
  }

  const topicsText =
    topTopics.length > 0
      ? `，主要涉及 ${topTopics.slice(0, 3).join("、")}`
      : "";

  return `在你离开的 ${days} 天里，新增了 ${newCount} 条收藏${topicsText}。`;
}
