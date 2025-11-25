/**
 * 首页客户端组件
 * 实现平台筛选、加载更多、编辑删除等交互功能
 */

'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List, Plus, Loader2, ArrowUpDown, CheckSquare, Trash2, FolderInput, Upload, Download, AlignJustify } from 'lucide-react'
import { toast } from 'sonner'
import { useAbortableFetch } from '@/hooks/use-abortable-fetch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BookmarkCard } from '@/components/bookmark/bookmark-card'
import { CreateBookmarkDialog } from '@/components/bookmark/create-bookmark-dialog'
import { BatchImportDialog } from '@/components/bookmark/batch-import-dialog'
import { BatchMoveDialog } from '@/components/bookmark/batch-move-dialog'
import { ExportDialog } from '@/components/bookmark/export-dialog'
import { FolderRecommendationToast } from '@/components/bookmark/folder-recommendation-toast'
import { EmptyState } from '@/components/bookmark/empty-state'
import { useFolderRecommendation } from '@/hooks/use-folder-recommendation'
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
]

// 排序选项
const sortOptions = [
  { value: 'created_desc', label: '最新收藏' },
  { value: 'created_asc', label: '最早收藏' },
  { value: 'title_asc', label: '标题 A-Z' },
  { value: 'title_desc', label: '标题 Z-A' },
]

// 视图模式类型
type ViewMode = 'card' | 'list' | 'compact'

// 本地存储 key
const VIEW_MODE_STORAGE_KEY = 'anykeep-view-mode'

export function HomePageClient({ bookmarks: initialBookmarks, error }: HomePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPlatform = searchParams.get('platform') || ''
  const currentSort = searchParams.get('sort') || 'created_desc'

  // 可取消请求 Hook
  const { fetchWithAbort } = useAbortableFetch()

  // 视图模式（从 localStorage 读取默认值）
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  // 初始化视图模式（从 localStorage 读取）
  useEffect(() => {
    const savedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode | null
    if (savedMode && ['card', 'list', 'compact'].includes(savedMode)) {
      setViewMode(savedMode)
    }
  }, [])

  // 切换视图模式并保存到 localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }
  const [bookmarks, setBookmarks] = useState(initialBookmarks)

  // 同步 props 和 state：当 initialBookmarks 更新时同步到 bookmarks state
  // 这是必需的，因为 router.refresh() 会更新 props，但 useState 不会自动同步
  useEffect(() => {
    setBookmarks(initialBookmarks)
    // 同时更新 hasMore 状态
    setHasMore(initialBookmarks.length === 50)
  }, [initialBookmarks])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialBookmarks.length === 50)
  const [isPending, startTransition] = useTransition()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)

  // 批量选择模式
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  // AI 文件夹推荐
  const {
    recommendation,
    bookmarkId: recommendationBookmarkId,
    fetchRecommendation,
    applyRecommendation,
    dismissRecommendation,
  } = useFolderRecommendation()

  // 新建收藏成功后触发文件夹推荐
  const handleBookmarkCreated = (bookmark: {
    id: number
    title: string
    ai_summary?: string | null
    ai_tags?: string[] | null
  }) => {
    // 如果收藏没有指定文件夹，则获取 AI 推荐
    fetchRecommendation(
      bookmark.id,
      bookmark.title,
      bookmark.ai_summary || '',
      bookmark.ai_tags || []
    )
  }

  // 打开移动对话框（用于自定义选择）
  const handleCustomizeFolder = () => {
    if (recommendationBookmarkId) {
      setSelectedIds(new Set([recommendationBookmarkId]))
      setShowMoveDialog(true)
      dismissRecommendation()
    }
  }

  const handlePlatformChange = (platformValue: string) => {
    const params = new URLSearchParams(searchParams)
    if (platformValue) {
      params.set('platform', platformValue)
    } else {
      params.delete('platform')
    }
    router.push(`/home?${params.toString()}`)
  }

  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('sort', sortValue)
    router.push(`/home?${params.toString()}`)
  }

  const handleRetry = () => {
    router.refresh()
  }

  const handleEdit = (id: number) => {
    // TODO: 打开编辑对话框（Week 1 暂时跳转到详情页）
    router.push(`/bookmark/${id}`)
  }

  const handleDelete = async (id: number) => {
    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id))

      // 调用删除 API（可取消）
      const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || '删除失败')
      }

      toast.success('删除成功')

      // 刷新数据
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      // 失败时恢复 UI
      setBookmarks(initialBookmarks)
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      const lastBookmark = bookmarks[bookmarks.length - 1]
      const params = new URLSearchParams({
        cursor: lastBookmark.id.toString(),
        limit: '50',
      })

      if (currentPlatform) {
        params.append('platform', currentPlatform)
      }

      const res = await fetchWithAbort(`/api/bookmarks?${params}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || '加载失败')
      }

      const data = await res.json()
      const newBookmarks = data.data.bookmarks

      setBookmarks((prev) => [...prev, ...newBookmarks])
      setHasMore(data.data.pagination.hasMore)
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      toast.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setIsLoadingMore(false)
    }
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(bookmarks.map((b) => b.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条收藏吗？删除后无法恢复。`)) {
      return
    }

    setIsBatchDeleting(true)
    try {
      // 使用批量删除 API（单次请求）
      const response = await fetchWithAbort('/api/bookmarks/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error?.message || '批量删除失败')
        return
      }

      const deletedCount = result.data?.deletedCount || 0
      toast.success(`成功删除 ${deletedCount} 条收藏`)

      // 更新 UI（乐观更新）
      setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)))
      setSelectedIds(new Set())
      setIsSelectionMode(false)

      // 刷新数据
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      // 前端错误仅在开发环境使用 console
      if (process.env.NODE_ENV === 'development') {
        console.error('Batch delete error:', error)
      }
      toast.error('批量删除失败')
    } finally {
      setIsBatchDeleting(false)
    }
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

          {/* 排序和视图切换 */}
          <div className="flex items-center gap-3">
            {/* 批量导入按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="size-4 mr-1.5" />
              批量导入
            </Button>

            {/* 导出按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="size-4 mr-1.5" />
              导出
            </Button>

            {/* 批量选择按钮 */}
            <Button
              variant={isSelectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleSelectionMode}
              className={cn(
                isSelectionMode && 'bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700'
              )}
            >
              <CheckSquare className="size-4 mr-1.5" />
              {isSelectionMode ? '取消选择' : '批量选择'}
            </Button>

            {/* 排序选择器 */}
            <Select value={currentSort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[140px]">
                <ArrowUpDown className="size-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 视图切换按钮 */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange('card')}
                title="瀑布流视图"
                className={cn(
                  "h-8 w-8 p-0",
                  viewMode === 'card' && 'bg-white dark:bg-gray-600 shadow-sm'
                )}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange('list')}
                title="列表视图"
                className={cn(
                  "h-8 w-8 p-0",
                  viewMode === 'list' && 'bg-white dark:bg-gray-600 shadow-sm'
                )}
              >
                <List className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange('compact')}
                title="紧凑视图"
                className={cn(
                  "h-8 w-8 p-0",
                  viewMode === 'compact' && 'bg-white dark:bg-gray-600 shadow-sm'
                )}
              >
                <AlignJustify className="size-4" />
              </Button>
            </div>
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

        {/* 批量操作工具栏 */}
        {isSelectionMode && selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                已选择 {selectedIds.size} 条
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                取消全选
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
                className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4 mr-1.5" />
                    删除
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMoveDialog(true)}
              >
                <FolderInput className="size-4 mr-1.5" />
                移动到文件夹
              </Button>
            </div>
          </div>
        )}
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
            {/* 瀑布流视图（card） */}
            {viewMode === 'card' && (
              <div className="masonry-grid">
                {bookmarks.map((bookmark) => (
                  <div key={bookmark.id} className="masonry-item">
                    <BookmarkCard
                      bookmark={bookmark}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(bookmark.id)}
                      onToggleSelect={toggleSelect}
                      variant="card"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 列表视图（list） */}
            {viewMode === 'list' && (
              <div className="space-y-4">
                {bookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(bookmark.id)}
                    onToggleSelect={toggleSelect}
                    variant="list"
                  />
                ))}
              </div>
            )}

            {/* 紧凑视图（compact） */}
            {viewMode === 'compact' && (
              <div className="space-y-2">
                {bookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(bookmark.id)}
                    onToggleSelect={toggleSelect}
                    variant="compact"
                  />
                ))}
              </div>
            )}

            {/* 加载更多按钮 */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    '加载更多'
                  )}
                </Button>
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
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="size-5 mr-2" />
          添加收藏
        </Button>
      </div>

      {/* 批量导入对话框 */}
      <BatchImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      {/* 导出对话框 */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        bookmarks={bookmarks}
        selectedIds={selectedIds}
      />

      {/* 批量移动对话框 */}
      <BatchMoveDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        selectedIds={selectedIds}
        onSuccess={() => {
          setSelectedIds(new Set())
          setIsSelectionMode(false)
        }}
      />

      {/* 创建收藏对话框 */}
      <CreateBookmarkDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleBookmarkCreated}
      />

      {/* AI 文件夹推荐 Toast */}
      <FolderRecommendationToast
        recommendation={recommendation}
        bookmarkId={recommendationBookmarkId || 0}
        onApply={applyRecommendation}
        onDismiss={dismissRecommendation}
        onCustomize={handleCustomizeFolder}
      />
    </div>
  )
}
