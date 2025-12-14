/**
 * Unified Tags Utility
 * 统一标签系统工具函数
 *
 * 提供 ai_tags 和 user_tags 的统一访问接口
 * 无需修改数据库结构，应用层统一处理
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

/**
 * 标签来源类型
 */
export type TagSource = "ai" | "user" | "both";

/**
 * 统一标签项
 */
export interface UnifiedTag {
  /** 标签值 */
  value: string;
  /** 标签来源 */
  source: TagSource;
}

/**
 * 书签标签输入
 */
export interface BookmarkTags {
  ai_tags?: string[] | null;
  user_tags?: string[] | null;
}

/**
 * 获取合并后的标签列表
 * 用户标签优先，AI 标签补充
 *
 * @param bookmark - 包含 ai_tags 和 user_tags 的对象
 * @returns 合并后的标签数组（去重）
 *
 * @example
 * ```typescript
 * const tags = getMergedTags({ ai_tags: ['React'], user_tags: ['前端'] });
 * // => ['前端', 'React']  // user_tags 优先
 * ```
 */
export function getMergedTags(bookmark: BookmarkTags): string[] {
  const userTags = bookmark.user_tags || [];
  const aiTags = bookmark.ai_tags || [];

  // 用户标签优先，AI 标签去重后追加
  const userTagSet = new Set(userTags);
  const merged = [...userTags];

  for (const tag of aiTags) {
    if (!userTagSet.has(tag)) {
      merged.push(tag);
    }
  }

  return merged;
}

/**
 * 获取带来源信息的统一标签列表
 *
 * @param bookmark - 包含 ai_tags 和 user_tags 的对象
 * @returns 统一标签数组，包含来源信息
 *
 * @example
 * ```typescript
 * const tags = getUnifiedTags({ ai_tags: ['React', 'JS'], user_tags: ['React', '前端'] });
 * // => [
 * //   { value: 'React', source: 'both' },
 * //   { value: '前端', source: 'user' },
 * //   { value: 'JS', source: 'ai' }
 * // ]
 * ```
 */
export function getUnifiedTags(bookmark: BookmarkTags): UnifiedTag[] {
  const userTags = new Set(bookmark.user_tags || []);
  const aiTags = new Set(bookmark.ai_tags || []);

  const result: UnifiedTag[] = [];
  const processed = new Set<string>();

  // 首先处理用户标签
  for (const tag of userTags) {
    const source: TagSource = aiTags.has(tag) ? "both" : "user";
    result.push({ value: tag, source });
    processed.add(tag);
  }

  // 然后处理仅 AI 的标签
  for (const tag of aiTags) {
    if (!processed.has(tag)) {
      result.push({ value: tag, source: "ai" });
    }
  }

  return result;
}

/**
 * 获取首选标签列表（用于显示）
 * 如果有用户标签则使用用户标签，否则使用 AI 标签
 *
 * @param bookmark - 包含 ai_tags 和 user_tags 的对象
 * @returns 首选标签数组
 */
export function getPreferredTags(bookmark: BookmarkTags): string[] {
  if (bookmark.user_tags && bookmark.user_tags.length > 0) {
    return bookmark.user_tags;
  }
  return bookmark.ai_tags || [];
}

/**
 * 检查书签是否有标签
 *
 * @param bookmark - 包含 ai_tags 和 user_tags 的对象
 * @returns 是否有任何标签
 */
export function hasTags(bookmark: BookmarkTags): boolean {
  return Boolean(
    (bookmark.ai_tags && bookmark.ai_tags.length > 0) ||
      (bookmark.user_tags && bookmark.user_tags.length > 0),
  );
}

/**
 * 检查书签是否有用户自定义标签
 *
 * @param bookmark - 包含 user_tags 的对象
 * @returns 是否有用户标签
 */
export function hasUserTags(bookmark: BookmarkTags): boolean {
  return bookmark.user_tags != null && bookmark.user_tags.length > 0;
}

/**
 * 获取标签总数（去重）
 *
 * @param bookmark - 包含 ai_tags 和 user_tags 的对象
 * @returns 不重复标签总数
 */
export function getTagCount(bookmark: BookmarkTags): number {
  return getMergedTags(bookmark).length;
}

/**
 * 限制标签数量（用于 UI 显示）
 *
 * @param tags - 标签数组
 * @param limit - 最大数量
 * @returns 截断后的标签和剩余数量
 */
export function limitTags(
  tags: string[],
  limit: number,
): { visible: string[]; remaining: number } {
  if (tags.length <= limit) {
    return { visible: tags, remaining: 0 };
  }
  return {
    visible: tags.slice(0, limit),
    remaining: tags.length - limit,
  };
}

/**
 * 格式化标签为显示字符串
 *
 * @param tags - 标签数组
 * @param options - 格式化选项
 * @returns 格式化后的字符串
 */
export function formatTagsForDisplay(
  tags: string[],
  options: {
    limit?: number;
    prefix?: string;
    separator?: string;
  } = {},
): string {
  const { limit = 3, prefix = "#", separator = " " } = options;
  const { visible, remaining } = limitTags(tags, limit);

  const formatted = visible.map((tag) => `${prefix}${tag}`).join(separator);

  if (remaining > 0) {
    return `${formatted}${separator}+${remaining}`;
  }

  return formatted;
}
