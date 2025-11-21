/**
 * 应用侧边栏 - Figma 设计版本
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Folder, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  {
    name: '首页',
    href: '/home',
    icon: Home,
  },
  {
    name: '搜索',
    href: '/search',
    icon: Search,
  },
  {
    name: '收藏夹',
    href: '/folders',
    icon: Folder,
  },
  {
    name: '数据',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: '设置',
    href: '/settings',
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-14 z-40 hidden lg:block w-64 h-[calc(100vh-3.5rem)] border-r bg-white dark:bg-gray-950 dark:border-gray-800">
      <div className="flex flex-col h-full p-4">
        {/* 品牌区域 */}
        <div className="px-3 mb-6">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            AnyKeep
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            智能收藏管理
          </p>
        </div>

        {/* 主导航 */}
        <nav className="flex-1 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50'
                )}
              >
                <Icon className="size-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* 底部信息 */}
        <div className="pt-4 border-t dark:border-gray-800">
          <p className="px-3 text-xs text-gray-400">
            AnyKeep v1.0.0
          </p>
        </div>
      </div>
    </aside>
  )
}
