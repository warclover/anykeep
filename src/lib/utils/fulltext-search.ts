/**
 * PostgreSQL 全文搜索工具函数
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 准备全文搜索查询字符串
 * 将用户输入转换为 PostgreSQL tsquery 格式
 */
export function prepareSearchQuery(query: string): string {
  // 移除特殊字符，保留空格、中文字符和字母数字
  const cleaned = query.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ').trim()

  if (!cleaned) {
    return ''
  }

  // 将多个空格替换为单个空格
  const normalized = cleaned.replace(/\s+/g, ' ')

  // 分词：将每个词用 OR 连接（支持部分匹配）
  const terms = normalized.split(' ').filter(Boolean)

  // 为每个词添加前缀匹配（:*）以支持部分匹配
  const tsqueryTerms = terms.map(term => `${term}:*`).join(' | ')

  return tsqueryTerms
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
  limit: number = 50
) {
  const tsquery = prepareSearchQuery(query)

  if (!tsquery) {
    return { data: [], error: null }
  }

  try {
    // 使用全文搜索（需要 search_vector 列存在）
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*, folders(name)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .textSearch('search_vector', tsquery, {
        type: 'websearch',
        config: 'simple'
      })
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data, error }
  } catch (error) {
    // 如果全文搜索失败（可能是列不存在），降级到 ILIKE
    console.warn('Full-text search failed, falling back to ILIKE:', error)
    return searchBookmarksIlike(supabase, userId, query, limit)
  }
}

/**
 * 降级到 ILIKE 搜索（作为备用方案）
 */
export async function searchBookmarksIlike(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit: number = 50
) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*, folders(name)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or(`title.ilike.%${query}%,ai_summary.ilike.%${query}%,author.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data, error }
}
