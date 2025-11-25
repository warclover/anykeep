/**
 * 主应用布局
 * 包含导航栏和侧边栏
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户资料
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航 */}
      <AppHeader user={user} profile={profile} />

      <div className="flex">
        {/* 侧边栏（桌面端） */}
        <AppSidebar />

        {/* 主内容区 */}
        <main className="flex-1 p-4 md:p-6 lg:ml-64 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* 底部导航栏（移动端） */}
      <MobileBottomNav />
    </div>
  )
}
