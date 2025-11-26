/**
 * 批量导入收藏 API
 * POST /api/bookmarks/batch-import - 批量创建收藏
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectPlatformFromUrl } from '@/lib/constants/platforms'
import {
  successResponse,
  unauthorizedError,
  quotaExceededError,
  databaseError,
  badRequestError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'
import type { BookmarkInsert } from '@/types/supabase'
import { BOOKMARK } from '@/lib/constants/messages'

interface ImportBookmark {
  url: string
  title: string
  description?: string
  folderId?: number
  userTags?: string[]
  notes?: string
}

interface ImportResult {
  success: number
  failed: number
  errors: Array<{ url: string; error: string }>
}

/**
 * POST /api/bookmarks/batch-import
 * 批量导入收藏
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

    // 2. 解析请求体
    const body = await request.json()
    const bookmarks: ImportBookmark[] = body.bookmarks

    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return badRequestError('bookmarks 必须是非空数组')
    }

    if (bookmarks.length > 100) {
      return badRequestError('单次最多导入 100 条书签')
    }

    // 3. 检查存储配额
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('storage_quota, storage_used')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return databaseError(BOOKMARK.LOAD_ERROR, profileError)
    }

    const remainingQuota = profile.storage_quota - profile.storage_used
    if (remainingQuota < bookmarks.length) {
      return quotaExceededError(
        `存储配额不足，剩余 ${remainingQuota} 条，需要 ${bookmarks.length} 条`
      )
    }

    // 4. 批量创建收藏
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    const bookmarkInserts: BookmarkInsert[] = []

    for (const bookmark of bookmarks) {
      try {
        // 验证必填字段
        if (!bookmark.url || !bookmark.title) {
          result.failed++
          result.errors.push({
            url: bookmark.url || '未知',
            error: 'URL 和标题是必填项',
          })
          continue
        }

        // 检查 URL 是否已存在
        const { data: existing } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('user_id', user.id)
          .eq('url', bookmark.url)
          .is('deleted_at', null)
          .single()

        if (existing) {
          result.failed++
          result.errors.push({
            url: bookmark.url,
            error: '该 URL 已存在',
          })
          continue
        }

        // 准备插入数据
        const platform = detectPlatformFromUrl(bookmark.url)

        bookmarkInserts.push({
          user_id: user.id,
          url: bookmark.url,
          title: bookmark.title,
          description: bookmark.description || null,
          platform,
          folder_id: bookmark.folderId || null,
          user_tags: bookmark.userTags || null,
          notes: bookmark.notes || null,
          status: 'COMPLETED', // 批量导入时跳过 AI 处理
          ai_summary: null,
          ai_tags: null,
          cover_url: null,
          author: null,
        })
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            url: bookmark.url,
          },
          'Batch import: Failed to prepare bookmark'
        )
        result.failed++
        result.errors.push({
          url: bookmark.url,
          error: '处理失败',
        })
      }
    }

    // 5. 批量插入数据库
    if (bookmarkInserts.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('bookmarks')
        .insert(bookmarkInserts)
        .select()

      if (insertError) {
        logger.error(
          {
            error: insertError,
            count: bookmarkInserts.length,
          },
          'Batch import: Database insert failed'
        )
        return databaseError(BOOKMARK.CREATE_ERROR, insertError)
      }

      result.success = inserted.length

      logger.info(
        {
          success: result.success,
          failed: result.failed,
          total: bookmarks.length,
        },
        'Batch import: Completed'
      )
    }

    return successResponse({ ...result, message: BOOKMARK.BATCH_IMPORT_SUCCESS })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Batch import: Unexpected error'
    )
    return badRequestError('批量导入失败')
  }
}
