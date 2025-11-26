/**
 * 应用顶部导航栏
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { MobileMenu } from '@/components/layout/mobile-menu'
import type { Profile } from '@/types/supabase'

interface AppHeaderProps {
  user: User
  profile: Profile | null
}

export function AppHeader({ user, profile }: AppHeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        toast.error('退出失败', {
          description: error.message,
        })
        return
      }

      toast.success('已退出登录')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('退出失败', {
        description: '请稍后重试',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-950 dark:border-gray-800">
      <div className="flex h-14 items-center px-4 lg:px-6 gap-2">
        {/* 移动端汉堡菜单 */}
        <MobileMenu />

        {/* Logo */}
        <Link href="/home" className="flex items-center space-x-2">
          <span className="text-lg md:text-xl font-bold text-purple-600 dark:text-purple-400">AnyKeep</span>
        </Link>

        {/* 搜索框 - 移动端优化 */}
        <div className="flex-1 mx-1 sm:mx-2 md:mx-4 lg:mx-8">
          <Link href="/search">
            <div className="relative max-w-full sm:max-w-md lg:max-w-lg mx-auto">
              <input
                type="text"
                placeholder="搜索..."
                className="w-full h-9 pl-9 pr-4 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-full focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400"
                readOnly
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </Link>
        </div>

        {/* 主题切换按钮 - 中小屏幕隐藏 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="hidden sm:flex shrink-0"
          aria-label="切换主题"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 gap-2 rounded-full px-2 hover:bg-gray-100 dark:hover:bg-gray-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900 flex-shrink-0">
                <span className="text-sm font-medium text-purple-600 dark:text-purple-300">
                  {profile?.nickname?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              {/* 用户名 - 在中等及以上屏幕显示 */}
              <span className="hidden md:inline-block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                {profile?.nickname || user.email?.split('@')[0] || '用户'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {profile?.nickname || '用户'}
                </p>
                <p className="text-xs leading-none text-gray-500">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <span className="text-sm">
                已用 {profile?.storage_used || 0} / {profile?.storage_quota || 500} 条
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={loading}
              className="text-red-600 focus:text-red-600"
            >
              {loading ? '退出中...' : '退出登录'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
