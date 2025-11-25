/**
 * 移动端汉堡菜单
 * 提供侧边抽屉导航
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Menu, Home, Search, Folder, BarChart3, Settings, X, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navigation = [
  {
    name: '首页',
    href: '/home',
    icon: Home,
    description: '查看所有收藏',
  },
  {
    name: '搜索',
    href: '/search',
    icon: Search,
    description: 'AI 智能搜索',
  },
  {
    name: '收藏夹',
    href: '/folders',
    icon: Folder,
    description: '管理文件夹',
  },
  {
    name: '数据统计',
    href: '/analytics',
    icon: BarChart3,
    description: '查看数据分析',
  },
  {
    name: '设置',
    href: '/settings',
    icon: Settings,
    description: '应用设置',
  },
]

export function MobileMenu() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold text-purple-600 dark:text-purple-400">
              AnyKeep
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* 导航菜单 */}
        <nav className="mt-8 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-start gap-3 px-3 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                )}
              >
                <Icon className={cn(
                  'size-5 mt-0.5 flex-shrink-0',
                  isActive && 'text-purple-600 dark:text-purple-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'font-medium',
                    isActive && 'font-semibold'
                  )}>
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* 底部信息和主题切换 */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            {/* 主题切换 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full justify-start gap-2"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute left-10 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="ml-6">{theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}</span>
            </Button>

            {/* 版本信息 */}
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                AnyKeep v1.0.0
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                智能收藏管理工具
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
