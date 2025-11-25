/**
 * 收藏卡片组件
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreVertical, Edit, Trash2, ExternalLink, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Bookmark } from '@/types/supabase'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils/date-utils'
import { generatePlaceholderImage } from '@/lib/utils/placeholder-image'
import { getProxiedImageUrl } from '@/lib/utils/image-proxy'
import { PlatformBadge } from '@/components/ui/platform-badge'

type ViewVariant = 'card' | 'list' | 'compact'

interface BookmarkCardProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null
  }
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  // 批量选择模式
  isSelectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: number) => void
  // 视图模式
  variant?: ViewVariant
}

export function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = 'card'
}: BookmarkCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  // 生成封面图（真实封面或占位符，微信图片使用代理）
  const coverImage = getProxiedImageUrl(bookmark.cover_url) || generatePlaceholderImage(bookmark.title, bookmark.platform)

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit?.(bookmark.id)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await onDelete?.(bookmark.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenOriginal = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  const handleToggleSelect = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.(bookmark.id)
  }

  // 操作菜单组件（复用）
  const ActionMenu = ({ className = '' }: { className?: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="secondary"
          size="icon"
          className={cn("h-7 w-7 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800", className)}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleOpenOriginal}>
          <ExternalLink className="mr-2 h-4 w-4" />
          打开原文
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem onClick={handleDelete} className="text-red-600 dark:text-red-400">
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? '删除中...' : '删除'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // 选择复选框组件（复用）
  const SelectionCheckbox = ({ className = '' }: { className?: string }) => (
    <div
      className={cn(
        "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
        isSelected
          ? "bg-blue-500 border-blue-500"
          : "bg-white/90 border-gray-300 dark:bg-gray-800/90 dark:border-gray-600",
        className
      )}
    >
      {isSelected && <Check className="w-4 h-4 text-white" />}
    </div>
  )

  // 紧凑列表视图（compact）
  if (variant === 'compact') {
    return (
      <Link href={isSelectionMode ? '#' : `/bookmark/${bookmark.id}`} onClick={isSelectionMode ? handleToggleSelect : undefined}>
        <div className={cn(
          "flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer group",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400"
        )}>
          {/* 选择复选框 */}
          {isSelectionMode && <SelectionCheckbox />}

          {/* 平台标识 */}
          <PlatformBadge platform={bookmark.platform} size="sm" />

          {/* 标题和元信息 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {bookmark.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <span>{bookmark.author || '未知作者'}</span>
              <span>·</span>
              <span>{formatRelativeTime(bookmark.created_at)}</span>
              {bookmark.folders && (
                <>
                  <span>·</span>
                  <span>{bookmark.folders.name}</span>
                </>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          {!isSelectionMode && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu />
            </div>
          )}
        </div>
      </Link>
    )
  }

  // 列表视图（list）
  if (variant === 'list') {
    return (
      <Link href={isSelectionMode ? '#' : `/bookmark/${bookmark.id}`} onClick={isSelectionMode ? handleToggleSelect : undefined}>
        <Card className={cn(
          "flex flex-row hover:shadow-md transition-shadow cursor-pointer group overflow-hidden",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400"
        )}>
          {/* 选择复选框 */}
          {isSelectionMode && (
            <div className="flex items-center px-3">
              <SelectionCheckbox />
            </div>
          )}

          {/* 缩略图 */}
          <div className="relative w-40 md:w-48 flex-shrink-0">
            <div className="aspect-video">
              <img
                src={coverImage}
                alt={bookmark.title}
                className="w-full h-full object-cover"
              />
            </div>
            {/* 平台标识 */}
            <div className="absolute bottom-2 left-2">
              <PlatformBadge platform={bookmark.platform} size="sm" showName />
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 mb-1">
                {bookmark.title}
              </h3>
              {bookmark.ai_summary && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {bookmark.ai_summary}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              {/* 标签 */}
              <div className="flex items-center gap-1.5">
                {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                  <>
                    <Badge variant="outline" className="bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-300 text-xs">
                      AI
                    </Badge>
                    {bookmark.ai_tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </>
                )}
              </div>

              {/* 元信息 */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{bookmark.author || '未知'}</span>
                <span>·</span>
                <span>{formatRelativeTime(bookmark.created_at)}</span>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          {!isSelectionMode && (
            <div className="flex items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu />
            </div>
          )}
        </Card>
      </Link>
    )
  }

  // 卡片视图（card，默认 - 瀑布流样式）
  return (
    <Link href={isSelectionMode ? '#' : `/bookmark/${bookmark.id}`} onClick={isSelectionMode ? handleToggleSelect : undefined}>
      <Card className={cn(
        "h-full hover:shadow-md transition-shadow cursor-pointer flex flex-col group relative",
        isDeleting && "opacity-50 pointer-events-none",
        isSelected && "ring-2 ring-blue-500 dark:ring-blue-400"
      )}>
        {/* 封面图 - 16:9 比例（总是显示，使用真实图片或占位符） */}
        <div className="relative aspect-video overflow-hidden rounded-t-lg">
          <img
            src={coverImage}
            alt={bookmark.title}
            className="w-full h-full object-cover"
          />
          {/* 平台标识 - PRD v4.1: Source Memory 强化 */}
          <div className="absolute top-2 left-2">
            <PlatformBadge
              platform={bookmark.platform}
              size="md"
              showName
            />
          </div>

          {/* 批量选择模式：复选框 */}
          {isSelectionMode && (
            <div className="absolute top-2 right-2">
              <SelectionCheckbox />
            </div>
          )}

          {/* 正常模式：操作按钮（悬停时显示） */}
          {!isSelectionMode && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu />
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
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
