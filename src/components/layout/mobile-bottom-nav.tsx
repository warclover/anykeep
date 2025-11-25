/**
 * 移动端底部导航栏
 * 在小屏幕设备上替代侧边栏导航
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

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-lg transition-colors',
                isActive
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <Icon className={cn(
                'size-5 transition-transform',
                isActive && 'scale-110'
              )} />
              <span className={cn(
                'text-xs font-medium',
                isActive && 'font-semibold'
              )}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
