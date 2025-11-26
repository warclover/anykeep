/**
 * 收藏夹管理页面
 * 展示所有文件夹和最近添加的收藏
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FoldersPageClient } from '@/components/folders/folders-page-client'
import { QUERY_LIMITS } from '@/lib/constants/app'
import type { Folder } from '@/types/supabase'

// 扩展 Folder 类型，包含计算字段
type FolderWithCount = Folder & { bookmark_count: number }

export default async function FoldersPage() {
  const supabase = await createClient()

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // 获取用户的所有文件夹
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // 计算每个文件夹的书签数量
  let foldersWithCount: FolderWithCount[] = []

  if (folders && folders.length > 0) {
    // 获取所有文件夹的书签数量（一次查询）
    const folderIds = folders.map((f) => f.id)
    const { data: bookmarkCounts } = await supabase
      .from('bookmarks')
      .select('folder_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('folder_id', folderIds)

    // 统计每个文件夹的书签数
    const countMap = new Map<number, number>()
    if (bookmarkCounts) {
      for (const bookmark of bookmarkCounts) {
        if (bookmark.folder_id) {
          countMap.set(
            bookmark.folder_id,
            (countMap.get(bookmark.folder_id) || 0) + 1
          )
        }
      }
    }

    // 合并数据
    foldersWithCount = folders.map((folder) => ({
      ...folder,
      bookmark_count: countMap.get(folder.id) || 0,
    }))
  }

  // 获取最近添加的收藏
  const { data: recentBookmarks, error: bookmarksError } = await supabase
    .from('bookmarks')
    .select('*, folders:folder_id (name)')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(QUERY_LIMITS.RECENT_BOOKMARKS_COUNT)

  // 处理错误
  let error: string | undefined
  if (foldersError) {
    error = '加载文件夹时出错，请稍后重试'
  } else if (bookmarksError) {
    error = '加载最近收藏时出错，请稍后重试'
  }

  return (
    <FoldersPageClient
      folders={foldersWithCount}
      recentBookmarks={recentBookmarks || []}
      error={error}
    />
  )
}
