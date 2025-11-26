/**
 * AI 文件夹推荐 Toast 组件
 * 保存内容后显示非阻塞的文件夹推荐卡片
 *
 * 设计参考：PRD v4.1 - "我觉得可以放这里" 轻松感设计
 */

'use client'

import { useState, useEffect } from 'react'
import { Folder, FolderPlus, Sparkles, X, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface FolderRecommendation {
  folderId: number | null
  folderName: string
  confidence: number
  reason: string
  suggestNew: boolean
}

interface FolderRecommendationToastProps {
  recommendation: FolderRecommendation | null
  bookmarkId: number
  onApply: (folderId: number | null, createNew: boolean, newFolderName?: string) => Promise<void>
  onDismiss: () => void
  onCustomize: () => void
}

export function FolderRecommendationToast({
  recommendation,
  bookmarkId: _bookmarkId,
  onApply,
  onDismiss,
  onCustomize,
}: FolderRecommendationToastProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // 显示/隐藏动画控制
  useEffect(() => {
    if (recommendation) {
      setShouldRender(true)
      // 延迟显示，让保存成功的 toast 先显示
      const showTimer = setTimeout(() => {
        setIsVisible(true)
      }, 500)
      return () => clearTimeout(showTimer)
    } else {
      setIsVisible(false)
      // 等待退出动画完成后移除
      const hideTimer = setTimeout(() => {
        setShouldRender(false)
      }, 300)
      return () => clearTimeout(hideTimer)
    }
  }, [recommendation])

  // 自动隐藏（15秒后）
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss()
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onDismiss])

  const handleApply = async () => {
    if (!recommendation || isApplying) return

    setIsApplying(true)
    try {
      await onApply(
        recommendation.folderId,
        recommendation.suggestNew,
        recommendation.suggestNew ? recommendation.folderName : undefined
      )
      onDismiss()
    } finally {
      setIsApplying(false)
    }
  }

  if (!shouldRender || !recommendation) return null

  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md",
        "transition-all duration-300 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8 pointer-events-none"
      )}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* 渐变顶部装饰条 */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <div className="p-4">
          {/* 标题区 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                  我觉得可以放这里
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AI 智能推荐
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* 推荐内容 */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-3">
              {recommendation.suggestNew ? (
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Folder className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {recommendation.suggestNew ? `新建「${recommendation.folderName}」` : recommendation.folderName}
                  </span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap",
                    recommendation.confidence >= 70
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : recommendation.confidence >= 40
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  )}>
                    {recommendation.confidence}% 匹配
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {recommendation.reason}
                </p>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleApply}
              disabled={isApplying}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              size="sm"
            >
              {isApplying ? (
                <span className="animate-pulse">应用中...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  确认
                </>
              )}
            </Button>
            <Button
              onClick={onDismiss}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              忽略
            </Button>
            <Button
              onClick={onCustomize}
              variant="ghost"
              size="sm"
              className="text-gray-500"
              title="自定义选择文件夹"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
