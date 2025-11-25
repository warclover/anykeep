/**
 * 批量移动收藏到文件夹 API 路由
 * POST /api/bookmarks/batch-move - 批量移动收藏到指定文件夹
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { batchMoveBookmarksSchema } from '@/lib/validation'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  notFoundError,
  internalError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'

/**
 * POST /api/bookmarks/batch-move
 * 批量移动收藏到指定文件夹（单次事务）
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
      return unauthorizedError('请先登录')
    }

    // 2. 解析并验证请求体
    const body = await request.json()
    const validation = batchMoveBookmarksSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { ids, folderId } = validation.data

    // 3. 如果指定了文件夹，验证文件夹是否存在且属于当前用户
    if (folderId !== null) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()

      if (folderError || !folder) {
        return notFoundError('文件夹不存在或无权访问')
      }
    }

    // 4. 批量更新收藏的 folder_id
    const { data: movedBookmarks, error: moveError } = await supabase
      .from('bookmarks')
      .update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select('id')

    if (moveError) {
      return databaseError('批量移动收藏失败', moveError)
    }

    const movedCount = movedBookmarks?.length || 0

    // 5. 返回移动结果
    return successResponse({
      movedCount,
      movedIds: movedBookmarks?.map((b) => b.id) || [],
      targetFolderId: folderId,
    })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'POST /api/bookmarks/batch-move error'
    )
    return internalError('批量移动收藏时发生错误')
  }
}
