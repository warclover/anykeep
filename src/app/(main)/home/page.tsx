/**
 * 首页 - 收藏列表
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HomePageClient } from '@/components/home/home-page-client'
import type { Platform } from '@/types/supabase'

// 有效的平台值（添加知乎）
const VALID_PLATFORMS: Platform[] = ['WECHAT_OFFICIAL_ACCOUNT', 'BILIBILI', 'XIAOHONGSHU', 'ZHIHU', 'UNKNOWN']

interface HomePageProps {
  searchParams: Promise<{
    platform?: string
    folder?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // 构建查询
  let query = supabase
    .from('bookmarks')
    .select('*, folders(name)')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // 平台筛选（验证平台值有效性）
  if (params.platform && VALID_PLATFORMS.includes(params.platform as Platform)) {
    query = query.eq('platform', params.platform as Platform)
  }

  // 文件夹筛选
  if (params.folder) {
    query = query.eq('folder_id', parseInt(params.folder))
  }

  const { data: bookmarks, error } = await query

  if (error) {
    return (
      <HomePageClient
        bookmarks={[]}
        error="加载收藏列表时出错，请稍后重试"
      />
    )
  }

  return <HomePageClient bookmarks={bookmarks || []} />
}
