/**
 * 设置页面 - 服务端组件
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageClient } from '@/components/settings/settings-page-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // TODO: 从数据库获取用户设置
  // 目前使用默认值
  const userSettings = {
    // 平台授权
    platforms: {
      wechat: false,
      bilibili: false,
      xiaohongshu: false,
      zhihu: false,
    },
    // AI 功能
    ai: {
      autoTags: true,
      autoSummary: true,
      semanticSearch: false,
    },
    // 隐私安全
    privacy: {
      dataEncryption: true,
      shareAnalytics: false,
    },
    // 通知偏好
    notifications: {
      email: true,
      inApp: true,
      weeklyDigest: false,
    },
  }

  return (
    <SettingsPageClient
      user={user}
      settings={userSettings}
    />
  )
}
