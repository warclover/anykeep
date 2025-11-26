/**
 * 搜索 API 路由
 * GET /api/search - 搜索书签（支持关键词、语义、混合搜索）
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from '@/lib/utils/api-response'
import {
  searchBookmarksSemantic,
  searchBookmarksHybrid,
} from '@/lib/utils/semantic-search'
import { searchBookmarksFulltext } from '@/lib/utils/fulltext-search'
import { logger } from '@/lib/logger'

/**
 * 搜索模式
 * - keyword: 仅关键词搜索（全文搜索）
 * - semantic: 仅语义搜索（向量相似度）
 * - hybrid: 混合搜索（关键词 + 语义）
 */
type SearchMode = 'keyword' | 'semantic' | 'hybrid'

/**
 * GET /api/search
 *
 * Query Parameters:
 * - q: 搜索关键词（必填）
 * - mode: 搜索模式 (keyword | semantic | hybrid)，默认 hybrid
 * - limit: 结果数量限制，默认 20，最大 100
 * - threshold: 语义搜索相似度阈值 (0-1)，默认 0.5
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedError()
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const mode = (searchParams.get('mode') || 'hybrid') as SearchMode
    const limitParam = searchParams.get('limit')
    const thresholdParam = searchParams.get('threshold')

    // 验证必填参数
    if (!query || query.trim().length < 2) {
      return badRequestError('搜索关键词至少需要2个字符')
    }

    // 解析可选参数
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100)
    const threshold = Math.min(Math.max(parseFloat(thresholdParam || '0.5') || 0.5, 0), 1)

    logger.info(
      {
        userId: user.id,
        query: query.substring(0, 50),
        mode,
        limit,
        threshold,
        action: 'search_request',
      },
      'Search: Request received'
    )

    // 3. 执行搜索
    let results: unknown[] = []
    let searchType = mode
    let error: Error | null = null

    switch (mode) {
      case 'keyword': {
        // 仅关键词搜索
        const keywordResult = await searchBookmarksFulltext(
          supabase,
          user.id,
          query,
          limit
        )
        results = keywordResult.data || []
        error = keywordResult.error ? new Error(String(keywordResult.error)) : null
        break
      }

      case 'semantic': {
        // 仅语义搜索
        const semanticResult = await searchBookmarksSemantic(
          supabase,
          user.id,
          query,
          { threshold, limit }
        )
        results = semanticResult.data || []
        error = semanticResult.error
        break
      }

      case 'hybrid':
      default: {
        // 混合搜索
        const hybridResult = await searchBookmarksHybrid(
          supabase,
          user.id,
          query,
          { threshold, limit }
        )
        results = hybridResult.data || []
        error = hybridResult.error
        searchType = hybridResult.searchType
        break
      }
    }

    if (error) {
      logger.error(
        {
          error: error.message,
          query: query.substring(0, 50),
          mode,
          action: 'search_error',
        },
        'Search: Error occurred'
      )
      // 搜索失败时返回空结果而不是错误，提升用户体验
      results = []
    }

    logger.info(
      {
        userId: user.id,
        query: query.substring(0, 50),
        mode,
        searchType,
        resultCount: results.length,
        action: 'search_complete',
      },
      'Search: Complete'
    )

    // 4. 返回结果
    return successResponse({
      query,
      mode,
      searchType,
      results,
      count: results.length,
    })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'search',
      },
      'GET /api/search error'
    )
    return internalError('搜索失败，请稍后重试')
  }
}
