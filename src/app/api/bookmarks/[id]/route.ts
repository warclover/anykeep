/**
 * 单个收藏 API 路由
 * GET /api/bookmarks/[id] - 获取收藏详情
 * PUT /api/bookmarks/[id] - 更新收藏
 * DELETE /api/bookmarks/[id] - 删除收藏
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateBookmarkSchema } from '@/lib/validation'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'
import type { BookmarkUpdate } from '@/types/supabase'
import { BOOKMARK, AUTH } from '@/lib/constants/messages'

/**
 * GET /api/bookmarks/[id]
 * 获取单个收藏详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bookmarkId = parseInt(id)

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND)
    }

    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedError()
    }

    // 2. 查询收藏详情
    const { data: bookmark, error: queryError } = await supabase
      .from('bookmarks')
      .select('*, folders(name)')
      .eq('id', bookmarkId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        return notFoundError(BOOKMARK.NOT_FOUND)
      }
      return databaseError(BOOKMARK.LOAD_ERROR, queryError)
    }

    // 3. 返回收藏详情
    return successResponse(bookmark)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'get_bookmark',
      },
      'GET /api/bookmarks/[id] error'
    )
    return internalError(BOOKMARK.LOAD_ERROR)
  }
}

/**
 * PUT /api/bookmarks/[id]
 * 更新收藏信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bookmarkId = parseInt(id)

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND)
    }

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
    const validation = updateBookmarkSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { title, description, folderId, userTags, notes } = validation.data

    // 3. 检查收藏是否存在且属于当前用户
    const { data: existingBookmark, error: checkError } = await supabase
      .from('bookmarks')
      .select('id, user_id')
      .eq('id', bookmarkId)
      .is('deleted_at', null)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return notFoundError(BOOKMARK.NOT_FOUND)
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError)
    }

    if (existingBookmark.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN)
    }

    // 4. 构建更新数据
    const updateData: BookmarkUpdate = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (folderId !== undefined) updateData.folder_id = folderId
    if (userTags !== undefined) updateData.user_tags = userTags
    if (notes !== undefined) updateData.notes = notes || null

    // 5. 更新收藏
    const { data: updatedBookmark, error: updateError } = await supabase
      .from('bookmarks')
      .update(updateData)
      .eq('id', bookmarkId)
      .select('*, folders(name)')
      .single()

    if (updateError) {
      return databaseError(BOOKMARK.UPDATE_ERROR, updateError)
    }

    // 6. 返回更新后的收藏
    return successResponse(updatedBookmark)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'update_bookmark',
      },
      'PUT /api/bookmarks/[id] error'
    )
    return internalError(BOOKMARK.UPDATE_ERROR)
  }
}

/**
 * DELETE /api/bookmarks/[id]
 * 删除收藏（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bookmarkId = parseInt(id)
    logger.debug(
      {
        bookmarkId,
        action: 'delete_start',
      },
      'DELETE: Bookmark ID'
    )

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND)
    }

    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    logger.debug(
      {
        userId: user?.id,
        authError: authError?.message,
        action: 'auth_check',
      },
      'DELETE: User authentication'
    )

    if (authError || !user) {
      return unauthorizedError()
    }

    // 2. 检查收藏是否存在且属于当前用户
    const { data: existingBookmark, error: checkError } = await supabase
      .from('bookmarks')
      .select('id, user_id')
      .eq('id', bookmarkId)
      .is('deleted_at', null)
      .single()

    logger.debug(
      {
        existingBookmark,
        checkError: checkError?.message,
        action: 'bookmark_check',
      },
      'DELETE: Existing bookmark'
    )

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return notFoundError(BOOKMARK.NOT_FOUND)
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError)
    }

    if (existingBookmark.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN)
    }

    // 3. 软删除收藏
    const { error: deleteError } = await supabase
      .from('bookmarks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', bookmarkId)

    logger.debug(
      {
        deleteError: deleteError?.message,
        action: 'soft_delete',
      },
      'DELETE: Delete operation'
    )

    if (deleteError) {
      return databaseError(BOOKMARK.DELETE_ERROR(1), deleteError)
    }

    // 4. 减少用户存储计数
    const { error: decrementError } = await supabase.rpc('decrement_storage_used', {
      target_user_id: user.id,
    })

    logger.debug(
      {
        decrementError: decrementError?.message,
        action: 'decrement_storage',
      },
      'DELETE: Decrement storage'
    )

    if (decrementError) {
      // 存储计数更新失败，但收藏已删除，记录错误但不影响返回
      logger.error(
        {
          error: decrementError,
          userId: user.id,
          operation: 'decrement_storage',
        },
        'Failed to decrement storage count'
      )
    }

    // 5. 返回成功响应
    logger.info(
      {
        bookmarkId,
        action: 'delete_success',
      },
      'DELETE: Success'
    )
    return successResponse({ id: bookmarkId, deleted: true })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'delete_bookmark',
      },
      'DELETE /api/bookmarks/[id] error'
    )
    return internalError(BOOKMARK.DELETE_ERROR(1))
  }
}
