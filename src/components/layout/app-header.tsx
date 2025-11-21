/**
 * 应用顶部导航栏
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { User } from '@supabase/supabase-js'
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
    } catch (error) {
      toast.error('退出失败', {
        description: '请稍后重试',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-950 dark:border-gray-800">
      <div className="flex h-14 items-center px-4 lg:px-6">
        {/* Logo */}
        <Link href="/home" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-purple-600 dark:text-purple-400">AnyKeep</span>
        </Link>

        {/* 搜索框 */}
        <div className="flex-1 mx-4 lg:mx-8">
          <Link href="/search">
            <div className="relative max-w-md mx-auto">
              <input
                type="text"
                placeholder="搜索收藏..."
                className="w-full h-9 pl-10 pr-4 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-full focus:ring-2 focus:ring-blue-500"
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

        {/* 主题切换按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="mr-2"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切换主题</span>
        </Button>

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                <span className="text-sm font-medium text-purple-600 dark:text-purple-300">
                  {profile?.nickname?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
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
