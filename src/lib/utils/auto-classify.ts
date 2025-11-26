/**
 * 自动分类工具函数
 * V4.2 智能分类系统核心逻辑
 */

import { createClient } from '@/lib/supabase/server'
import type { Folder } from '@/types/supabase'
import { logger } from '@/lib/logger'

/**
 * 置信度阈值配置
 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_CLASSIFY: 80,    // ≥80% 自动归类
  SHOW_RECOMMENDATION: 60,  // 60-79% 显示推荐
  // <60% 放入待整理
} as const

/**
 * 获取或创建用户的待整理文件夹
 * 使用数据库函数确保并发安全
 */
export async function getOrCreateInboxFolder(userId: string): Promise<number> {
  const supabase = await createClient()

  // 调用数据库函数
  const { data, error } = await supabase.rpc('get_or_create_inbox_folder', {
    p_user_id: userId,
  })

  if (error) {
    logger.error(
      { error: error.message, userId, action: 'get_or_create_inbox_folder' },
      'Auto Classify: Failed to get/create inbox folder'
    )

    // 回退方案：直接查询或创建
    return fallbackGetOrCreateInboxFolder(userId)
  }

  logger.info(
    { userId, folderId: data, action: 'inbox_folder_obtained' },
    'Auto Classify: Inbox folder obtained'
  )

  return data
}

/**
 * 回退方案：直接查询或创建待整理文件夹
 */
async function fallbackGetOrCreateInboxFolder(userId: string): Promise<number> {
  const supabase = await createClient()

  // 1. 尝试查找现有文件夹
  const { data: existing } = await supabase
    .from('folders')
    .select('id')
    .eq('user_id', userId)
    .eq('is_system', true)
    .eq('system_type', 'INBOX')
    .is('deleted_at', null)
    .single()

  if (existing) {
    return existing.id
  }

  // 2. 创建新文件夹
  const { data: newFolder, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name: '待整理',
      is_system: true,
      system_type: 'INBOX',
      sort_order: -1,
    })
    .select('id')
    .single()

  if (error) {
    logger.error(
      { error: error.message, userId, action: 'create_inbox_folder_fallback' },
      'Auto Classify: Failed to create inbox folder (fallback)'
    )
    throw new Error('无法创建待整理文件夹')
  }

  return newFolder.id
}

/**
 * 根据置信度决定归类行为
 */
export type ClassifyAction =
  | { type: 'auto'; folderId: number; folderName: string }
  | { type: 'recommend'; folderId: number | null; folderName: string; suggestNew: boolean }
  | { type: 'inbox'; folderId: number }

export interface FolderRecommendation {
  folderId: number | null
  folderName: string
  confidence: number
  reason: string
  suggestNew: boolean
}

/**
 * 根据置信度确定分类行为
 */
export async function determineClassifyAction(
  userId: string,
  recommendation: FolderRecommendation | null
): Promise<ClassifyAction> {
  // 无推荐或推荐失败：放入待整理
  if (!recommendation) {
    const inboxId = await getOrCreateInboxFolder(userId)
    return { type: 'inbox', folderId: inboxId }
  }

  const { confidence, folderId, folderName, suggestNew } = recommendation

  // 高置信度：自动归类
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY) {
    if (folderId) {
      return { type: 'auto', folderId, folderName }
    }
    // 建议新建文件夹但置信度高，也自动处理
    if (suggestNew && folderName) {
      // 自动创建文件夹
      const newFolderId = await createFolder(userId, folderName)
      return { type: 'auto', folderId: newFolderId, folderName }
    }
  }

  // 中等置信度：显示推荐
  if (confidence >= CONFIDENCE_THRESHOLDS.SHOW_RECOMMENDATION) {
    return { type: 'recommend', folderId, folderName, suggestNew }
  }

  // 低置信度：放入待整理
  const inboxId = await getOrCreateInboxFolder(userId)
  return { type: 'inbox', folderId: inboxId }
}

/**
 * 创建文件夹
 */
async function createFolder(userId: string, name: string): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name,
      sort_order: 0,
    })
    .select('id')
    .single()

  if (error) {
    logger.error(
      { error: error.message, userId, name, action: 'create_folder' },
      'Auto Classify: Failed to create folder'
    )
    throw new Error('创建文件夹失败')
  }

  return data.id
}

/**
 * 执行自动归类
 */
export async function autoClassifyBookmark(
  bookmarkId: number,
  folderId: number,
  userId: string,
  confidence: number
): Promise<void> {
  const supabase = await createClient()

  // 更新书签的文件夹
  const { error } = await supabase
    .from('bookmarks')
    .update({ folder_id: folderId })
    .eq('id', bookmarkId)
    .eq('user_id', userId)

  if (error) {
    logger.error(
      { error: error.message, bookmarkId, folderId, action: 'auto_classify' },
      'Auto Classify: Failed to update bookmark folder'
    )
    throw new Error('自动归类失败')
  }

  logger.info(
    { bookmarkId, folderId, confidence, action: 'auto_classify_success' },
    'Auto Classify: Bookmark auto-classified'
  )
}

/**
 * 检查是否为系统文件夹
 */
export async function isSystemFolder(folderId: number, userId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('folders')
    .select('is_system')
    .eq('id', folderId)
    .eq('user_id', userId)
    .single()

  return data?.is_system ?? false
}

/**
 * 获取用户的待整理文件夹信息（如果存在）
 */
export async function getInboxFolder(userId: string): Promise<Folder | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .eq('is_system', true)
    .eq('system_type', 'INBOX')
    .is('deleted_at', null)
    .single()

  return data
}
