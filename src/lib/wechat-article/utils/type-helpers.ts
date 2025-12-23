/**
 * 微信文章模块 - 类型转换助手
 *
 * @module wechat-article/utils/type-helpers
 * @description 提供类型安全的数据转换函数，避免 `as unknown as` 断言
 *
 * 设计原则：
 * - 使用运行时类型验证而非类型断言
 * - 提供明确的类型收窄 (type narrowing)
 * - 保持与 Supabase 查询结果的兼容性
 */

import type { WechatArticleSnapshot } from "@/types/supabase";

/**
 * Supabase 查询返回的原始数据类型
 * 使用 Record 允许任意字段，在转换时验证
 */
type SupabaseQueryResult = Record<string, unknown>;

/**
 * 类型保护：验证数据是否为有效的 WechatArticleSnapshot
 *
 * @param data - Supabase 查询返回的数据
 * @returns 是否为有效的快照数据
 */
export function isWechatArticleSnapshot(
  data: unknown,
): data is WechatArticleSnapshot {
  if (data === null || typeof data !== "object") {
    return false;
  }

  const obj = data as SupabaseQueryResult;

  // 验证必需字段
  return (
    typeof obj.id === "number" &&
    typeof obj.bookmark_id === "number" &&
    // 其他字段是可选的或 nullable
    (obj.readable_content === null || typeof obj.readable_content === "string")
  );
}

/**
 * 安全转换 Supabase 查询结果为 WechatArticleSnapshot
 *
 * 此函数执行运行时验证，确保数据结构正确
 * 相比 `as unknown as` 断言，这种方式更安全
 *
 * @param data - Supabase 查询返回的数据
 * @returns 类型化的快照数据
 * @throws Error 如果数据结构无效
 */
export function toWechatArticleSnapshot(
  data: SupabaseQueryResult,
): WechatArticleSnapshot {
  // 验证必需字段
  if (typeof data.id !== "number") {
    throw new Error("Invalid snapshot data: missing or invalid 'id'");
  }

  // 安全转换 - 利用 TypeScript 的类型推断
  // 显式构造对象而非断言，编译器会检查类型兼容性
  const snapshot: WechatArticleSnapshot = {
    id: data.id,
    bookmark_id:
      typeof data.bookmark_id === "number" ? data.bookmark_id : data.id,
    readable_content:
      typeof data.readable_content === "string" ? data.readable_content : null,
    readable_text_content:
      typeof data.readable_text_content === "string"
        ? data.readable_text_content
        : null,
    readable_title:
      typeof data.readable_title === "string" ? data.readable_title : null,
    readable_word_count:
      typeof data.readable_word_count === "number"
        ? data.readable_word_count
        : null,
    original_url:
      typeof data.original_url === "string" ? data.original_url : null,
    // 可选字段
    original_html:
      typeof data.original_html === "string" ? data.original_html : null,
    processed_html:
      typeof data.processed_html === "string" ? data.processed_html : null,
    content_version:
      typeof data.content_version === "number" ? data.content_version : 1,
    content_markdown:
      typeof data.content_markdown === "string" ? data.content_markdown : null,
    article_images: Array.isArray(data.article_images)
      ? data.article_images
      : undefined,
    images_status:
      typeof data.images_status === "string"
        ? (data.images_status as WechatArticleSnapshot["images_status"])
        : undefined,
    images_stats:
      typeof data.images_stats === "object" && data.images_stats !== null
        ? (data.images_stats as WechatArticleSnapshot["images_stats"])
        : undefined,
    style_preserve_level:
      typeof data.style_preserve_level === "string"
        ? (data.style_preserve_level as WechatArticleSnapshot["style_preserve_level"])
        : undefined,
    // 关联数据
    bookmarks:
      typeof data.bookmarks === "object" && data.bookmarks !== null
        ? {
            url:
              typeof (data.bookmarks as SupabaseQueryResult).url === "string"
                ? ((data.bookmarks as SupabaseQueryResult).url as string)
                : "",
            platform:
              typeof (data.bookmarks as SupabaseQueryResult).platform ===
              "string"
                ? ((data.bookmarks as SupabaseQueryResult).platform as string)
                : "",
          }
        : undefined,
  };

  return snapshot;
}

/**
 * 安全转换 Supabase 查询结果，返回 null 如果转换失败
 *
 * @param data - Supabase 查询返回的数据
 * @returns 类型化的快照数据或 null
 */
export function tryToWechatArticleSnapshot(
  data: unknown,
): WechatArticleSnapshot | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  try {
    return toWechatArticleSnapshot(data as SupabaseQueryResult);
  } catch {
    return null;
  }
}
