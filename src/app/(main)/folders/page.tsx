/**
 * 收藏夹管理页面
 * 展示所有文件夹和最近添加的收藏
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FoldersPageClient } from '@/components/folders/folders-page-client'
import { QUERY_LIMITS } from '@/lib/constants/app'

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
    .order('created_at', { ascending: false })

  // 获取最近添加的收藏
  const { data: recentBookmarks, error: bookmarksError } = await supabase
    .from('bookmarks')
    .select(`
      *,
      folders:folder_id (name)
    `)
    .eq('user_id', user.id)
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
      folders={folders || []}
      recentBookmarks={recentBookmarks || []}
      error={error}
    />
  )
}
