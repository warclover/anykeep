/**
 * 收藏夹页面客户端组件
 * 展示文件夹卡片网格和最近添加的收藏
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, MoreVertical, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorMessage } from '@/components/ui/error-message'
import { CreateFolderDialog } from '@/components/folders/create-folder-dialog'
import type { Folder as FolderType, Bookmark } from '@/types/supabase'

// 扩展 Folder 类型，包含计算字段
type FolderWithCount = FolderType & {
  bookmark_count?: number
}

interface FoldersPageClientProps {
  folders: FolderWithCount[]
  recentBookmarks: (Bookmark & {
    folders?: { name: string } | null
  })[]
  error?: string
}

// Emoji 图标映射
const FOLDER_EMOJIS: Record<string, string> = {
  '产品学习': '📚',
  '技术学习': '💻',
  '生活方式': '☕',
  '旅行计划': '✈️',
  '职场技能': '💼',
  '行业资讯': '📰',
  // 默认图标
  'default': '📁',
}

function getFolderEmoji(folderName: string): string {
  return FOLDER_EMOJIS[folderName] || FOLDER_EMOJIS['default']
}

export function FoldersPageClient({
  folders,
  recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const router = useRouter()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleRetry = () => {
    router.refresh()
  }

  const handleCreateClick = () => {
    setShowCreateDialog(true)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
            收藏夹
          </h2>
          <Button size="sm" onClick={handleCreateClick}>
            <Plus className="size-4 mr-2" />
            <span className="hidden md:inline">新建文件夹</span>
            <span className="md:hidden">新建</span>
          </Button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          按文件夹整理你的收藏内容
        </p>
      </header>

      {/* Folders Grid */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        {error ? (
          <ErrorMessage
            message={error}
            retry={handleRetry}
          />
        ) : (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {folders.map((folder) => (
            <Card
              key={folder.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl md:text-3xl">
                      {getFolderEmoji(folder.name)}
                    </div>
                    <div>
                      <h3 className="text-gray-900 dark:text-white text-sm md:text-base font-medium">
                        {folder.name}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
                        {folder.bookmark_count || 0} 条收藏
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="size-4" />
                  </Button>
                </div>

                {/* 预览图 - 占位，将来可以展示前3个收藏的封面 */}
                {folder.bookmark_count && folder.bookmark_count > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-full h-16 md:h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center"
                      >
                        <span className="text-gray-400 dark:text-gray-500 text-xs">
                          {i}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-16 md:h-20 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <p className="text-gray-400 dark:text-gray-500 text-xs">
                      暂无收藏
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* 空状态 */}
          {folders.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-gray-900 dark:text-white text-lg mb-2">
                还没有文件夹
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                创建文件夹来整理你的收藏内容
              </p>
              <Button onClick={handleCreateClick}>
                <Plus className="size-4 mr-2" />
                创建第一个文件夹
              </Button>
            </div>
          )}
        </div>

        {/* Recent Collections */}
        {recentBookmarks.length > 0 && (
          <div>
            <h3 className="text-gray-900 dark:text-white mb-3 md:mb-4 font-medium">
              最近添加
            </h3>
            <div className="space-y-3">
              {recentBookmarks.map((bookmark) => (
                <Link key={bookmark.id} href={`/bookmark/${bookmark.id}`}>
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center gap-3 md:gap-4">
                        {bookmark.cover_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={bookmark.cover_url}
                            alt={bookmark.title}
                            className="w-12 h-12 md:w-16 md:h-16 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 dark:text-gray-500 text-xs">
                              无图
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-gray-900 dark:text-white line-clamp-1 text-sm md:text-base">
                            {bookmark.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Folder className="size-3 text-gray-400 dark:text-gray-500" />
                            <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
                              {bookmark.folders?.name || '未分类'}
                            </span>
                          </div>
                        </div>
                        <div className="hidden md:flex gap-1 flex-wrap">
                          {bookmark.ai_tags?.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* 创建文件夹对话框 */}
      <CreateFolderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        folders={folders}
      />
    </div>
  )
}
