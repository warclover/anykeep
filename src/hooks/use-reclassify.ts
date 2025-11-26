/**
 * 重分类 Hook
 * 管理智能更新分类的状态和操作
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ClassificationSuggestion, Bookmark } from '@/types/supabase'

/**
 * 重分类检查结果
 */
interface ReclassifyCheckResult {
  shouldTrigger: boolean
  hasPendingSuggestions: boolean
  pendingSuggestionsCount: number
  triggers: {
    weekly: boolean
    threshold: boolean
  }
  stats: {
    inboxCount: number
    inboxThreshold: number
    lastRunAt: string | null
    daysSinceLastRun: number | null
  }
}

/**
 * 建议项（包含书签信息）
 */
interface SuggestionWithBookmark extends ClassificationSuggestion {
  bookmarks: Pick<Bookmark, 'id' | 'title' | 'url' | 'cover_url' | 'platform' | 'ai_summary' | 'ai_tags'>
}

/**
 * Hook 返回类型
 */
interface UseReclassifyReturn {
  // 状态
  checkResult: ReclassifyCheckResult | null
  suggestions: SuggestionWithBookmark[]
  isChecking: boolean
  isRunning: boolean
  isProcessing: boolean

  // 操作
  checkReclassify: () => Promise<void>
  runReclassify: (forceRun?: boolean) => Promise<void>
  fetchSuggestions: () => Promise<void>
  acceptSuggestions: (ids: number[]) => Promise<void>
  rejectSuggestions: (ids: number[]) => Promise<void>
  acceptAllSuggestions: () => Promise<void>
  rejectAllSuggestions: () => Promise<void>

  // 统计
  stats: {
    pending: number
    accepted: number
    rejected: number
    expired: number
  }
}

export function useReclassify(): UseReclassifyReturn {
  const router = useRouter()

  const [checkResult, setCheckResult] = useState<ReclassifyCheckResult | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionWithBookmark[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
  })

  /**
   * 获取建议列表
   */
  const fetchSuggestions = useCallback(async () => {
    try {
      const response = await fetch('/api/reclassify/suggestions?status=pending')
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.data.suggestions || [])
        setStats(data.data.stats || { pending: 0, accepted: 0, rejected: 0, expired: 0 })
      }
    } catch (error) {
      console.error('Fetch suggestions failed:', error)
    }
  }, [])

  /**
   * 检查是否需要重分类
   */
  const checkReclassify = useCallback(async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/reclassify/check')
      if (response.ok) {
        const data = await response.json()
        setCheckResult(data.data)
      }
    } catch (error) {
      console.error('Check reclassify failed:', error)
    } finally {
      setIsChecking(false)
    }
  }, [])

  /**
   * 执行重分类
   */
  const runReclassify = useCallback(async (forceRun = false) => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRun }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.data.suggestionsCreated > 0) {
          toast.success(data.data.message, {
            icon: '🔄',
            description: '点击查看分类建议',
            action: {
              label: '查看',
              onClick: () => fetchSuggestions(),
            },
          })
        } else {
          toast.info(data.data.message)
        }
        // 重新检查状态
        await checkReclassify()
      } else {
        toast.error(data.error?.message || '执行重分类失败')
      }
    } catch (error) {
      toast.error('执行重分类失败')
      console.error('Run reclassify failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [checkReclassify, fetchSuggestions])

  /**
   * 批量接受建议
   */
  const acceptSuggestions = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/reclassify/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', suggestionIds: ids }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.data.message, { icon: '✅' })
        await fetchSuggestions()
        router.refresh()
      } else {
        toast.error(data.error?.message || '接受建议失败')
      }
    } catch (error) {
      toast.error('接受建议失败')
      console.error('Accept suggestions failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [fetchSuggestions, router])

  /**
   * 批量拒绝建议
   */
  const rejectSuggestions = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/reclassify/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', suggestionIds: ids }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.info(data.data.message)
        await fetchSuggestions()
      } else {
        toast.error(data.error?.message || '拒绝建议失败')
      }
    } catch (error) {
      toast.error('拒绝建议失败')
      console.error('Reject suggestions failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [fetchSuggestions])

  /**
   * 接受所有建议
   */
  const acceptAllSuggestions = useCallback(async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/reclassify/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_all' }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.data.message, { icon: '✅' })
        await fetchSuggestions()
        router.refresh()
      } else {
        toast.error(data.error?.message || '接受全部建议失败')
      }
    } catch (error) {
      toast.error('接受全部建议失败')
      console.error('Accept all suggestions failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [fetchSuggestions, router])

  /**
   * 拒绝所有建议
   */
  const rejectAllSuggestions = useCallback(async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/reclassify/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject_all' }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.info(data.data.message)
        await fetchSuggestions()
      } else {
        toast.error(data.error?.message || '拒绝全部建议失败')
      }
    } catch (error) {
      toast.error('拒绝全部建议失败')
      console.error('Reject all suggestions failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [fetchSuggestions])

  // 初始化时检查状态
  useEffect(() => {
    checkReclassify()
    fetchSuggestions()
  }, [checkReclassify, fetchSuggestions])

  return {
    checkResult,
    suggestions,
    isChecking,
    isRunning,
    isProcessing,
    checkReclassify,
    runReclassify,
    fetchSuggestions,
    acceptSuggestions,
    rejectSuggestions,
    acceptAllSuggestions,
    rejectAllSuggestions,
    stats,
  }
}
