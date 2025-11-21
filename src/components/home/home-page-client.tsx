/**
 * 首页客户端组件
 * 实现平台筛选、视图切换等交互功能
 */

'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookmarkCard } from '@/components/bookmark/bookmark-card'
import { EmptyState } from '@/components/bookmark/empty-state'
import { ErrorMessage } from '@/components/ui/error-message'
import { cn } from '@/lib/utils'
import type { Bookmark } from '@/types/supabase'

interface HomePageClientProps {
  bookmarks: (Bookmark & {
    folders?: { name: string } | null
  })[]
  error?: string
}

// 平台配置
const platforms = [
  { id: 'all', name: '全部', value: '' },
  { id: 'wechat', name: '微信', value: 'WECHAT_OFFICIAL_ACCOUNT' },
  { id: 'xiaohongshu', name: '小红书', value: 'XIAOHONGSHU' },
  { id: 'bilibili', name: 'B站', value: 'BILIBILI' },
  { id: 'zhihu', name: '知乎', value: 'ZHIHU' },
]

export function HomePageClient({ bookmarks, error }: HomePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPlatform = searchParams.get('platform') || ''
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handlePlatformChange = (platformValue: string) => {
    if (platformValue) {
      router.push(`/home?platform=${platformValue}`)
    } else {
      router.push('/home')
    }
  }

  const handleRetry = () => {
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部区域 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        {/* 标题和视图切换 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
              我的收藏
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              共 {bookmarks.length} 条收藏
            </p>
          </div>

          {/* 视图切换按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={cn(
                viewMode === 'grid' && 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              )}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn(
                viewMode === 'list' && 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              )}
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>

        {/* 平台筛选标签 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {platforms.map((platform) => {
            const isActive = currentPlatform === platform.value
            return (
              <button
                key={platform.id}
                onClick={() => handlePlatformChange(platform.value)}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                )}
              >
                {platform.name}
              </button>
            )
          })}
        </div>
      </header>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        {error ? (
          <ErrorMessage
            message={error}
            retry={handleRetry}
          />
        ) : bookmarks && bookmarks.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              /* 网格视图 */
              <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {bookmarks.map((bookmark) => (
                  <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                ))}
              </div>
            ) : (
              /* 列表视图 */
              <div className="space-y-4">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                  >
                    {/* 缩略图 */}
                    {bookmark.cover_url && (
                      <div className="w-32 h-24 flex-shrink-0">
                        <img
                          src={bookmark.cover_url}
                          alt={bookmark.title}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                    )}
                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 dark:text-white font-medium line-clamp-2 mb-2">
                        {bookmark.title}
                      </h3>
                      {bookmark.ai_summary && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-2">
                          {bookmark.ai_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{bookmark.author || '未知作者'}</span>
                        <span>•</span>
                        <span>{new Date(bookmark.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 底部添加收藏按钮 */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <Button
          className="w-full bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          size="lg"
        >
          <Plus className="size-5 mr-2" />
          添加收藏
        </Button>
      </div>
    </div>
  )
}
