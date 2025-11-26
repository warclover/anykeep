/**
 * 文件夹管理 API 路由
 * GET /api/folders - 获取文件夹列表
 * POST /api/folders - 创建新文件夹
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFolderSchema } from '@/lib/validation'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'
import type { Folder } from '@/types/supabase'
import { FOLDER } from '@/lib/constants/messages'

/**
 * GET /api/folders
 * 获取当前用户的所有文件夹（树形结构）
 */
export async function GET(_request: NextRequest) {
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

    // 2. 查询用户的所有文件夹
    // V4.2更新：按 sort_order 升序排列（系统文件夹 sort_order=-1 会排在最前面）
    const { data: folders, error: queryError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (queryError) {
      return databaseError(FOLDER.LOAD_ERROR, queryError)
    }

    // 3. 构建树形结构
    const folderTree = buildFolderTree(folders || [])

    return successResponse(folderTree)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'get_folders',
      },
      'GET /api/folders error'
    )
    return internalError(FOLDER.LOAD_ERROR)
  }
}

/**
 * POST /api/folders
 * 创建新文件夹
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
    const validation = createFolderSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { name, parentId } = validation.data

    // 3. 创建文件夹
    // 注意：数据库 folders 表目前只有基础字段（name, parent_id 等）
    // color 和 icon 字段需要通过数据库迁移添加后才能使用
    const { data: folder, error: createError } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name,
        parent_id: parentId || null,
      })
      .select()
      .single()

    if (createError) {
      return databaseError(FOLDER.CREATE_ERROR, createError)
    }

    return successResponse(folder)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'create_folder',
      },
      'POST /api/folders error'
    )
    return internalError(FOLDER.CREATE_ERROR)
  }
}

/**
 * 文件夹树节点类型（包含子文件夹）
 */
interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
}

/**
 * 构建文件夹树形结构
 */
function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const folderMap = new Map<number, FolderTreeNode>()
  const rootFolders: FolderTreeNode[] = []

  // 第一遍遍历：创建映射并初始化 children
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // 第二遍遍历：构建树形关系
  folders.forEach((folder) => {
    const folderNode = folderMap.get(folder.id)!

    if (folder.parent_id === null) {
      // 根文件夹
      rootFolders.push(folderNode)
    } else {
      // 子文件夹，添加到父文件夹的 children
      const parent = folderMap.get(folder.parent_id)
      if (parent) {
        parent.children.push(folderNode)
      } else {
        // 如果父文件夹不存在（可能被删除），视为根文件夹
        rootFolders.push(folderNode)
      }
    }
  })

  return rootFolders
}
