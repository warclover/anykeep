/**
 * 语义搜索工具函数
 * 基于向量相似度搜索书签
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from './embedding-generator'
import { logger } from '@/lib/logger'

/**
 * 语义搜索结果类型
 */
export interface SemanticSearchResult {
  id: number
  title: string
  url: string
  description: string | null
  cover_url: string | null
  platform: string
  ai_summary: string | null
  ai_tags: string[] | null
  folder_id: number | null
  author: string | null
  publish_time: string | null
  content_type: string | null
  user_tags: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
  similarity: number
}

/**
 * 语义搜索配置
 */
export interface SemanticSearchOptions {
  /** 相似度阈值 (0-1)，默认 0.5 */
  threshold?: number
  /** 返回结果数量，默认 20 */
  limit?: number
}

/**
 * 使用向量相似度搜索书签
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @param query - 搜索查询文本
 * @param options - 搜索选项
 * @returns 按相似度排序的搜索结果
 */
export async function searchBookmarksSemantic(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  options: SemanticSearchOptions = {}
): Promise<{ data: SemanticSearchResult[] | null; error: Error | null }> {
  const { threshold = 0.5, limit = 20 } = options

  if (!query || query.trim().length < 2) {
    return { data: [], error: null }
  }

  try {
    // 1. 为查询文本生成向量
    logger.info(
      { query: query.substring(0, 50), action: 'semantic_search_start' },
      'Semantic Search: Generating query embedding'
    )

    const queryEmbedding = await generateEmbedding(query)

    // 2. 调用数据库语义搜索函数
    const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
      query_embedding: queryEmbedding,
      p_user_id: userId,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      logger.error(
        { error: error.message, action: 'semantic_search_db_error' },
        'Semantic Search: Database error'
      )
      return { data: null, error: new Error(error.message) }
    }

    logger.info(
      {
        query: query.substring(0, 50),
        resultCount: data?.length || 0,
        action: 'semantic_search_success',
      },
      'Semantic Search: Success'
    )

    return { data: data as SemanticSearchResult[], error: null }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        query: query.substring(0, 50),
        action: 'semantic_search_failed',
      },
      'Semantic Search: Failed'
    )
    return {
      data: null,
      error: error instanceof Error ? error : new Error('语义搜索失败'),
    }
  }
}

/**
 * 混合搜索：结合关键词搜索和语义搜索
 *
 * 策略：
 * 1. 并行执行关键词搜索和语义搜索
 * 2. 合并结果，去重
 * 3. 语义搜索结果优先（有相似度分数），关键词结果补充
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @param query - 搜索查询文本
 * @param options - 搜索选项
 * @returns 混合搜索结果
 */
export async function searchBookmarksHybrid(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  options: SemanticSearchOptions & { keywordLimit?: number } = {}
): Promise<{
  data: Array<SemanticSearchResult & { folders?: { name: string } | null }>
  error: Error | null
  searchType: 'hybrid' | 'keyword' | 'semantic'
}> {
  const { threshold = 0.5, limit = 20, keywordLimit = 30 } = options

  if (!query || query.trim().length < 2) {
    return { data: [], error: null, searchType: 'hybrid' }
  }

  try {
    // 并行执行两种搜索
    const [semanticResult, keywordResult] = await Promise.allSettled([
      searchBookmarksSemantic(supabase, userId, query, { threshold, limit }),
      // 关键词搜索（ILIKE）
      supabase
        .from('bookmarks')
        .select('*, folders(name)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(
          `title.ilike.%${query}%,ai_summary.ilike.%${query}%,author.ilike.%${query}%`
        )
        .order('created_at', { ascending: false })
        .limit(keywordLimit),
    ])

    // 处理语义搜索结果
    const semanticResults: SemanticSearchResult[] =
      semanticResult.status === 'fulfilled' && semanticResult.value.data
        ? semanticResult.value.data
        : []

    // 处理关键词搜索结果
    const keywordResults =
      keywordResult.status === 'fulfilled' && keywordResult.value.data
        ? keywordResult.value.data
        : []

    // 合并结果，去重
    const seenIds = new Set<number>()
    const mergedResults: Array<
      SemanticSearchResult & { folders?: { name: string } | null }
    > = []

    // 语义搜索结果优先（按相似度排序）
    for (const result of semanticResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id)
        mergedResults.push(result)
      }
    }

    // 补充关键词搜索结果（没有相似度分数的设为 0）
    for (const result of keywordResults) {
      if (!seenIds.has(result.id) && mergedResults.length < limit) {
        seenIds.add(result.id)
        mergedResults.push({
          ...result,
          similarity: 0, // 关键词匹配没有相似度分数
        })
      }
    }

    // 确定搜索类型
    let searchType: 'hybrid' | 'keyword' | 'semantic' = 'hybrid'
    if (semanticResults.length === 0 && keywordResults.length > 0) {
      searchType = 'keyword'
    } else if (semanticResults.length > 0 && keywordResults.length === 0) {
      searchType = 'semantic'
    }

    logger.info(
      {
        query: query.substring(0, 50),
        semanticCount: semanticResults.length,
        keywordCount: keywordResults.length,
        mergedCount: mergedResults.length,
        searchType,
        action: 'hybrid_search_complete',
      },
      'Hybrid Search: Complete'
    )

    return { data: mergedResults.slice(0, limit), error: null, searchType }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        action: 'hybrid_search_failed',
      },
      'Hybrid Search: Failed'
    )
    return {
      data: [],
      error: error instanceof Error ? error : new Error('混合搜索失败'),
      searchType: 'hybrid',
    }
  }
}
