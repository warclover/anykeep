/**
 * 单个文件夹 API 路由
 * GET /api/folders/[id] - 获取文件夹详情
 * PUT /api/folders/[id] - 更新文件夹
 * DELETE /api/folders/[id] - 删除文件夹
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateFolderSchema } from '@/lib/validation'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
  badRequestError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'
import type { FolderUpdate, Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FOLDER, AUTH } from '@/lib/constants/messages'

/**
 * GET /api/folders/[id]
 * 获取单个文件夹详情及其统计信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const folderId = parseInt(id)

    if (isNaN(folderId)) {
      return notFoundError(FOLDER.NOT_FOUND)
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

    // 2. 查询文件夹详情
    const { data: folder, error: queryError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        return notFoundError(FOLDER.NOT_FOUND)
      }
      return databaseError(FOLDER.LOAD_ERROR, queryError)
    }

    // 3. 统计收藏数量
    const { count: bookmarkCount, error: countError } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', folderId)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (countError) {
      logger.error(
        {
          error: countError,
          folderId,
          operation: 'count_bookmarks',
        },
        'Count bookmarks error'
      )
    }

    // 4. 返回文件夹详情（包含收藏数）
    return successResponse({
      ...folder,
      bookmark_count: bookmarkCount || 0,
    })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'get_folder',
      },
      'GET /api/folders/[id] error'
    )
    return internalError(FOLDER.LOAD_ERROR)
  }
}

/**
 * PUT /api/folders/[id]
 * 更新文件夹信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const folderId = parseInt(id)

    if (isNaN(folderId)) {
      return notFoundError(FOLDER.NOT_FOUND)
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
    const validation = updateFolderSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { name, parentId, color: _color, icon: _icon } = validation.data

    // 3. 检查文件夹是否存在且属于当前用户
    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('id, user_id, parent_id, is_system, system_type')
      .eq('id', folderId)
      .is('deleted_at', null)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return notFoundError(FOLDER.NOT_FOUND)
      }
      return databaseError(FOLDER.LOAD_ERROR, checkError)
    }

    if (existingFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN)
    }

    // 3.5 V4.2新增：系统文件夹不可重命名
    if (existingFolder.is_system && name !== undefined) {
      return badRequestError('系统文件夹不可重命名')
    }

    // 4. 检查是否存在循环引用（如果更改了 parent_id）
    if (parentId !== undefined && parentId !== null) {
      const hasCircularReference = await checkCircularReference(
        supabase,
        folderId,
        parentId,
        user.id
      )

      if (hasCircularReference) {
        return badRequestError(FOLDER.CIRCULAR_REFERENCE_ERROR)
      }
    }

    // 5. 构建更新数据
    type FolderUpdateFields = Partial<Pick<FolderUpdate, 'name' | 'parent_id'>>
    const updateData: FolderUpdateFields = {}
    if (name !== undefined) updateData.name = name
    if (parentId !== undefined) updateData.parent_id = parentId
    // Note: color and icon are not in the database schema yet, removing for now

    // 6. 更新文件夹
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update(updateData)
      .eq('id', folderId)
      .select()
      .single()

    if (updateError) {
      return databaseError(FOLDER.UPDATE_ERROR, updateError)
    }

    return successResponse(updatedFolder)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'update_folder',
      },
      'PUT /api/folders/[id] error'
    )
    return internalError(FOLDER.UPDATE_ERROR)
  }
}

/**
 * DELETE /api/folders/[id]
 * 删除文件夹（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const folderId = parseInt(id)

    if (isNaN(folderId)) {
      return notFoundError(FOLDER.NOT_FOUND)
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

    // 2. 检查文件夹是否存在且属于当前用户
    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('id, user_id, is_system, system_type')
      .eq('id', folderId)
      .is('deleted_at', null)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return notFoundError(FOLDER.NOT_FOUND)
      }
      return databaseError(FOLDER.LOAD_ERROR, checkError)
    }

    if (existingFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN)
    }

    // 2.5 V4.2新增：系统文件夹不可删除
    if (existingFolder.is_system) {
      return badRequestError('系统文件夹不可删除')
    }

    // 3. 检查文件夹下是否有收藏
    const { count: bookmarkCount, error: countError } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', folderId)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (countError) {
      return databaseError(FOLDER.LOAD_ERROR, countError)
    }

    if (bookmarkCount && bookmarkCount > 0) {
      return badRequestError(FOLDER.DELETE_ERROR_HAS_BOOKMARKS(bookmarkCount))
    }

    // 4. 软删除文件夹
    const { error: deleteError } = await supabase
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', folderId)

    if (deleteError) {
      return databaseError(FOLDER.DELETE_ERROR, deleteError)
    }

    // 5. 返回成功响应
    return successResponse({ id: folderId, deleted: true })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'delete_folder',
      },
      'DELETE /api/folders/[id] error'
    )
    return internalError(FOLDER.DELETE_ERROR)
  }
}

/**
 * 检查是否存在循环引用
 * 递归检查 targetParentId 是否是 folderId 的后代
 */
async function checkCircularReference(
  supabase: SupabaseClient<Database>,
  folderId: number,
  targetParentId: number,
  userId: string
): Promise<boolean> {
  // 如果目标父文件夹就是当前文件夹，肯定是循环引用
  if (folderId === targetParentId) {
    return true
  }

  // 获取当前文件夹的所有子文件夹
  const { data: children, error } = await supabase
    .from('folders')
    .select('id')
    .eq('parent_id', folderId)
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error || !children) {
    return false
  }

  // 检查目标父文件夹是否是子文件夹之一
  for (const child of children) {
    if (child.id === targetParentId) {
      return true
    }

    // 递归检查子文件夹的子文件夹
    const hasCircular = await checkCircularReference(
      supabase,
      child.id,
      targetParentId,
      userId
    )

    if (hasCircular) {
      return true
    }
  }

  return false
}
