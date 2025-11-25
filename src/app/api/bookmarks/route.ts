/**
 * 收藏 API 路由
 * POST /api/bookmarks - 创建收藏
 * GET /api/bookmarks - 获取收藏列表
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectPlatformFromUrl } from '@/lib/constants/platforms'
import {
  createBookmarkSchema,
  getBookmarksQuerySchema,
} from '@/lib/validation'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  quotaExceededError,
  databaseError,
  internalError,
} from '@/lib/utils/api-response'
import { crawlContent } from '@/lib/utils/crawler'
import { generateAIContent } from '@/lib/utils/ai-generator'
import { logger } from '@/lib/logger'
import type { BookmarkInsert } from '@/types/supabase'
import { BOOKMARK, STORAGE } from '@/lib/constants/messages'

/**
 * POST /api/bookmarks
 * 创建新收藏
 */
export async function POST(request: NextRequest) {
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

    // 2. 解析并验证请求体
    const body = await request.json()
    const validation = createBookmarkSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { url, title, description, folderId, userTags, notes, coverUrl: userCoverUrl } =
      validation.data

    // 3. 检查存储配额
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('storage_quota, storage_used')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return databaseError(BOOKMARK.LOAD_ERROR, profileError)
    }

    if (profile.storage_used >= profile.storage_quota) {
      return quotaExceededError(STORAGE.QUOTA_EXCEEDED)
    }

    // 4. 识别平台类型
    const platform = detectPlatformFromUrl(url)

    // 5. 如果缺少标题或描述，尝试自动爬取
    let finalTitle = title
    let finalDescription: string | null | undefined = description
    let author: string | undefined
    let coverUrl: string | undefined

    if (!title || !description) {
      try {
        logger.info(
          {
            url,
            action: 'crawl_start',
          },
          'Crawler: Auto-crawling content'
        )
        const crawlResult = await crawlContent(url)

        // 使用爬取的数据填充缺失字段
        finalTitle = title || crawlResult.title
        finalDescription = description || crawlResult.description || null
        author = crawlResult.author
        coverUrl = crawlResult.coverUrl

        logger.info(
          {
            title: finalTitle,
            platform: crawlResult.platform,
            hasAuthor: !!author,
            hasCover: !!coverUrl,
            action: 'crawl_success',
          },
          'Crawler: Success'
        )
      } catch (error) {
        // 爬取失败不影响创建收藏，使用用户输入或默认值
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            url,
            action: 'crawl_failed',
          },
          'Crawler: Failed'
        )
        finalTitle = title || 'URL 收藏'
        finalDescription = description || null
      }
    }

    // 6. 生成 AI 摘要和标签
    let aiSummary: string | null = null
    let aiTags: string[] | null = null

    try {
      logger.info(
        {
          title: finalTitle,
          action: 'ai_generate_start',
        },
        'AI: Generating summary and tags'
      )
      const aiResult = await generateAIContent({
        title: finalTitle,
        description: finalDescription || undefined,
      })

      aiSummary = aiResult.summary
      aiTags = aiResult.tags

      logger.info(
        {
          summary: aiSummary.substring(0, 50) + '...',
          tagCount: aiTags.length,
          action: 'ai_generate_success',
        },
        'AI: Success'
      )
    } catch (error) {
      // AI 生成失败不影响创建收藏
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          title: finalTitle,
          action: 'ai_generate_failed',
        },
        'AI: Failed'
      )
      aiSummary = null
      aiTags = null
    }

    // 7. 构建收藏记录
    // 封面优先级：用户上传 > 爬取获取
    const finalCoverUrl = userCoverUrl || coverUrl || null

    const bookmarkData: BookmarkInsert = {
      user_id: user.id,
      url,
      title: finalTitle,
      description: finalDescription,
      author: author || null,
      cover_url: finalCoverUrl,
      platform,
      folder_id: folderId || null,
      user_tags: userTags || null,
      notes: notes || null,
      ai_summary: aiSummary,
      ai_tags: aiTags,
      status: 'COMPLETED', // 标记为完成（Week 2 已包含爬虫和 AI）
    }

    // 8. 插入收藏记录
    const { data: bookmark, error: insertError } = await supabase
      .from('bookmarks')
      .insert(bookmarkData)
      .select('*, folders(name)')
      .single()

    if (insertError) {
      return databaseError(BOOKMARK.CREATE_ERROR, insertError)
    }

    // 9. 增加用户存储计数
    const { error: incrementError } = await supabase.rpc('increment_storage_used', {
      target_user_id: user.id,
    })

    if (incrementError) {
      // 存储计数更新失败，但收藏已创建，记录错误但不影响返回
      logger.error(
        {
          error: incrementError,
          userId: user.id,
          operation: 'increment_storage',
        },
        'Failed to increment storage count'
      )
    }

    // 10. 返回创建的收藏对象
    return successResponse(bookmark, 201)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'create_bookmark',
      },
      'POST /api/bookmarks error'
    )
    return internalError(BOOKMARK.CREATE_ERROR)
  }
}

/**
 * GET /api/bookmarks
 * 获取收藏列表（支持分页和筛选）
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
    const queryParams = {
      platform: searchParams.get('platform'),
      folderId: searchParams.get('folderId'),
      keyword: searchParams.get('keyword'),
      cursor: searchParams.get('cursor'),
      limit: searchParams.get('limit'),
    }

    const validation = getBookmarksQuerySchema.safeParse(queryParams)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { platform, folderId, keyword, cursor, limit } = validation.data

    // 3. 构建查询
    let query = supabase
      .from('bookmarks')
      .select('*, folders(name)', { count: 'exact' })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // 平台筛选
    if (platform) {
      query = query.eq('platform', platform)
    }

    // 文件夹筛选
    if (folderId) {
      query = query.eq('folder_id', folderId)
    }

    // 关键词搜索（标题 + 描述）
    if (keyword) {
      query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    }

    // 游标分页（"加载更多"模式）
    if (cursor) {
      query = query.lt('id', cursor)
    }

    // 限制数量
    query = query.limit(limit)

    // 4. 执行查询
    const { data: bookmarks, error: queryError, count } = await query

    if (queryError) {
      return databaseError(BOOKMARK.LOAD_ERROR, queryError)
    }

    // 5. 返回结果（包含分页元数据）
    const hasMore = bookmarks && bookmarks.length === limit
    const nextCursor = hasMore && bookmarks.length > 0 ? bookmarks[bookmarks.length - 1].id : null

    return successResponse({
      bookmarks: bookmarks || [],
      pagination: {
        total: count || 0,
        limit,
        nextCursor,
        hasMore,
      },
    })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'get_bookmarks',
      },
      'GET /api/bookmarks error'
    )
    return internalError(BOOKMARK.LOAD_ERROR)
  }
}
