/**
 * PostgreSQL 全文搜索工具函数
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * V4.2.6: 转义 ILIKE 模式中的特殊字符
 * 防止 SQL 注入和意外的通配符匹配
 *
 * ILIKE 特殊字符：
 * - % 匹配任意字符序列
 * - _ 匹配单个字符
 * - \ 转义字符
 *
 * @param pattern - 原始搜索模式
 * @returns 转义后的安全模式
 */
export function escapeIlikePattern(pattern: string): string {
  // 先转义反斜杠，再转义其他特殊字符
  return pattern
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * 准备全文搜索查询字符串
 * 将用户输入转换为 PostgreSQL tsquery 格式
 */
export function prepareSearchQuery(query: string): string {
  // 移除特殊字符，保留空格、中文字符和字母数字
  const cleaned = query.replace(/[^\w\s\u4e00-\u9fa5]/g, " ").trim();

  if (!cleaned) {
    return "";
  }

  // 将多个空格替换为单个空格
  const normalized = cleaned.replace(/\s+/g, " ");

  // 分词：将每个词用 OR 连接（支持部分匹配）
  const terms = normalized.split(" ").filter(Boolean);

  // 为每个词添加前缀匹配（:*）以支持部分匹配
  const tsqueryTerms = terms.map((term) => `${term}:*`).join(" | ");

  return tsqueryTerms;
}

/**
 * 使用全文搜索查询书签
 * 注意：需要先执行 20251124000004_add_fulltext_search.sql 迁移
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @param query - 搜索关键词
 * @param limit - 结果数量限制
 * @returns 搜索结果
 */
export async function searchBookmarksFulltext(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit: number = 50,
) {
  const tsquery = prepareSearchQuery(query);

  if (!tsquery) {
    return { data: [], error: null };
  }

  try {
    // 使用全文搜索（需要 search_vector 列存在）
    // V4.2.17: 明确选择字段，排除 embedding/search_vector 向量避免 RSC 序列化问题
    const { data, error } = await supabase
      .from("bookmarks")
      .select(
        `
        id, title, url, description, cover_url, platform,
        ai_summary, ai_tags, folder_id, author, publish_time,
        content_type, user_tags, notes, created_at, updated_at,
        is_read, is_starred, is_locked, rating, status,
        ai_content_type, source_name, word_count, image_count,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .textSearch("search_vector", tsquery, {
        type: "websearch",
        config: "simple",
      })
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  } catch (error) {
    // 如果全文搜索失败（可能是列不存在），降级到 ILIKE
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Full-text search failed, falling back to ILIKE",
    );
    return searchBookmarksIlike(supabase, userId, query, limit);
  }
}

/**
 * 降级到 ILIKE 搜索（作为备用方案）
 *
 * V4.2.6: 修复 SQL 注入漏洞 - 转义 ILIKE 特殊字符
 */
export async function searchBookmarksIlike(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit: number = 50,
) {
  // V4.2.6: 转义 ILIKE 特殊字符防止 SQL 注入
  const escapedQuery = escapeIlikePattern(query);

  // V4.2.17: 明确选择字段，排除 embedding/search_vector 向量避免 RSC 序列化问题
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      `
      id, title, url, description, cover_url, platform,
      ai_summary, ai_tags, folder_id, author, publish_time,
      content_type, user_tags, notes, created_at, updated_at,
      is_read, is_starred, is_locked, rating, status,
      ai_content_type, source_name, word_count, image_count,
      folders(name)
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(
      `title.ilike.%${escapedQuery}%,ai_summary.ilike.%${escapedQuery}%,author.ilike.%${escapedQuery}%`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data, error };
}
