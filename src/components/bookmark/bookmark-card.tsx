/**
 * 收藏卡片组件
 */

'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Bookmark } from '@/types/supabase'
import { cn } from '@/lib/utils'
import { getPlatformConfig } from '@/lib/platform-utils'
import { formatRelativeTime } from '@/lib/date-utils'

interface BookmarkCardProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null
  }
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const platformConfig = getPlatformConfig(bookmark.platform)

  return (
    <Link href={`/bookmark/${bookmark.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer flex flex-col">
        {/* 封面图 - 16:9 比例 */}
        {bookmark.cover_url && (
          <div className="relative aspect-video overflow-hidden rounded-t-lg">
            <img
              src={bookmark.cover_url}
              alt={bookmark.title}
              className="w-full h-full object-cover"
            />
            {/* 平台标识 */}
            <div className={cn(
              'absolute top-2 left-2 px-2 py-1 text-xs font-medium text-white rounded',
              platformConfig.bgColor
            )}>
              {platformConfig.name}
            </div>
          </div>
        )}

        <CardHeader className={cn(!bookmark.cover_url && 'pb-2')}>
          {!bookmark.cover_url && (
            <div className={cn(
              'inline-flex w-fit px-2 py-1 text-xs font-medium text-white rounded mb-2',
              platformConfig.bgColor
            )}>
              {platformConfig.name}
            </div>
          )}
          <CardTitle className="line-clamp-2 text-base min-h-[3rem] leading-6">
            {bookmark.title}
          </CardTitle>
          {bookmark.ai_summary && (
            <CardDescription className="line-clamp-2">
              {bookmark.ai_summary}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* AI 标签 */}
          {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {/* AI 徽章 */}
              <Badge
                variant="outline"
                className="bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-300 text-xs"
              >
                AI
              </Badge>
              {/* AI 标签 */}
              {bookmark.ai_tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {bookmark.ai_tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{bookmark.ai_tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* 元信息 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{bookmark.author || '未知作者'}</span>
            <span>{formatRelativeTime(bookmark.created_at)}</span>
          </div>

          {/* 处理状态 */}
          {bookmark.status === 'PROCESSING' && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
              <span className="animate-pulse">●</span>
              处理中...
            </div>
          )}
          {bookmark.status === 'FAILED' && (
            <div className="mt-2 text-xs text-red-500">
              处理失败
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
