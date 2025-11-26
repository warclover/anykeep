/**
 * 搜索页面客户端组件
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Sparkles, Clock, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { BookmarkCard } from '@/components/bookmark/bookmark-card'
import { ErrorMessage } from '@/components/ui/error-message'
import type { Bookmark } from '@/types/supabase'
// cn import removed - unused

interface SearchPageClientProps {
  initialQuery: string
  initialAIMode: boolean
  searchResults: (Bookmark & { folders?: { name: string } | null })[]
  hotTags: string[]
  error?: string
}

const SEARCH_HISTORY_KEY = 'anykeep_search_history'
const MAX_HISTORY = 10

export function SearchPageClient({
  initialQuery,
  initialAIMode,
  searchResults,
  hotTags,
  error,
}: SearchPageClientProps) {
  const router = useRouter()
    const [query, setQuery] = useState(initialQuery)
  const [aiMode, setAIMode] = useState(initialAIMode)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY)
        return history ? JSON.parse(history) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [showHistory, setShowHistory] = useState(false)

  const handleRetry = () => {
    router.refresh()
  }

    // 保存搜索历史
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return

    const newHistory = [
      searchQuery,
      ...searchHistory.filter((item) => item !== searchQuery),
    ].slice(0, MAX_HISTORY)

    setSearchHistory(newHistory)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
  }

  // 清空搜索历史
  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  }

  // 执行搜索
  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return

    saveToHistory(searchQuery)
    setShowHistory(false)

    // 更新 URL
    const params = new URLSearchParams()
    params.set('q', searchQuery)
    if (aiMode) {
      params.set('ai', 'true')
    }
    router.push(`/search?${params.toString()}`)
  }

  // 处理输入框回车
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query)
    }
  }

  // 点击热门标签或历史记录
  const handleTagClick = (tag: string) => {
    setQuery(tag)
    handleSearch(tag)
  }

  // 切换 AI 模式
  const handleAIModeToggle = (checked: boolean) => {
    setAIMode(checked)
    // 如果当前有搜索，立即重新搜索
    if (query.trim()) {
      const params = new URLSearchParams()
      params.set('q', query)
      if (checked) {
        params.set('ai', 'true')
      }
      router.push(`/search?${params.toString()}`)
    }
  }

  const hasResults = searchResults.length > 0
  const hasQuery = initialQuery.trim().length > 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
          搜索
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          在你的收藏中搜索内容，支持 AI 语义搜索
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6 md:py-8">
        {/* 搜索框区域 */}
        <div className="max-w-3xl mx-auto">
          {/* 大搜索框 */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowHistory(true)}
              placeholder="搜索标题、作者、摘要..."
              className="pl-12 pr-4 h-14 text-base"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          {/* AI 语义搜索开关 */}
          <div className="flex items-center justify-between mb-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                <Sparkles className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <Label htmlFor="ai-mode" className="text-sm font-medium cursor-pointer">
                  AI 语义搜索
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  使用 AI 理解搜索意图，获得更准确的结果
                </p>
              </div>
            </div>
            <Switch
              id="ai-mode"
              checked={aiMode}
              onCheckedChange={handleAIModeToggle}
            />
          </div>

          {/* 搜索历史（仅在聚焦且有历史时显示） */}
          {showHistory && searchHistory.length > 0 && !hasQuery && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="size-4" />
                  搜索历史
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  清空
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((item, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleTagClick(item)}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 热门搜索（仅在无搜索结果时显示） */}
          {!hasQuery && hotTags.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                🔥 热门标签
              </h3>
              <div className="flex flex-wrap gap-2">
                {hotTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 搜索结果 */}
        {hasQuery && (
          <div className="max-w-7xl mx-auto mt-8">
            {error ? (
              <ErrorMessage
                title="搜索失败"
                message={error}
                retry={handleRetry}
              />
            ) : (
              <>
                {/* 结果统计 */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    找到 <span className="font-medium text-gray-900 dark:text-white">{searchResults.length}</span> 个结果
                    {aiMode && (
                      <Badge variant="outline" className="ml-2 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300">
                        <Sparkles className="size-3 mr-1" />
                        AI 搜索
                      </Badge>
                    )}
                  </p>
                </div>

                {/* 结果列表 */}
                {hasResults ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((bookmark) => (
                      <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <Search className="size-8 text-gray-400" />
                    </div>
                    <h3 className="text-gray-900 dark:text-white text-lg font-medium mb-2">
                      未找到相关内容
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      尝试使用其他关键词，或开启 AI 语义搜索
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 空状态（无搜索） */}
        {!hasQuery && (
          <div className="max-w-3xl mx-auto mt-12">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Search className="size-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">
                开始搜索你的收藏
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-md">
                输入关键词搜索标题、作者或摘要，或点击下方热门标签快速开始
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
