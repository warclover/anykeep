/**
 * AI 文件夹推荐 Hook
 * 管理文件夹推荐状态和操作
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { FolderRecommendation } from '@/components/bookmark/folder-recommendation-toast'

interface UseFolderRecommendationReturn {
  recommendation: FolderRecommendation | null
  bookmarkId: number | null
  isLoading: boolean
  fetchRecommendation: (bookmarkId: number, title: string, summary?: string, tags?: string[]) => Promise<void>
  applyRecommendation: (folderId: number | null, createNew: boolean, newFolderName?: string) => Promise<void>
  dismissRecommendation: () => void
}

export function useFolderRecommendation(): UseFolderRecommendationReturn {
  const router = useRouter()
  const [recommendation, setRecommendation] = useState<FolderRecommendation | null>(null)
  const [bookmarkId, setBookmarkId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  /**
   * 获取文件夹推荐
   */
  const fetchRecommendation = useCallback(async (
    id: number,
    title: string,
    summary: string = '',
    tags: string[] = []
  ) => {
    setIsLoading(true)
    setBookmarkId(id)

    try {
      const response = await fetch('/api/ai/recommend-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          summary,
          tags,
        }),
      })

      if (!response.ok) {
        throw new Error('获取推荐失败')
      }

      const data = await response.json()
      setRecommendation(data.data)
    } catch (error) {
      // 推荐失败不影响用户体验，静默失败
      console.error('Folder recommendation failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 应用推荐（移动到文件夹或创建新文件夹）
   */
  const applyRecommendation = useCallback(async (
    folderId: number | null,
    createNew: boolean,
    newFolderName?: string
  ) => {
    if (!bookmarkId) return

    try {
      let targetFolderId = folderId

      // 如果需要新建文件夹
      if (createNew && newFolderName) {
        const createResponse = await fetch('/api/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newFolderName,
          }),
        })

        if (!createResponse.ok) {
          throw new Error('创建文件夹失败')
        }

        const createData = await createResponse.json()
        targetFolderId = createData.data.id
        toast.success(`已创建文件夹「${newFolderName}」`)
      }

      // 移动收藏到文件夹
      if (targetFolderId !== null) {
        const moveResponse = await fetch('/api/bookmarks/batch-move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ids: [bookmarkId],
            folderId: targetFolderId,
          }),
        })

        if (!moveResponse.ok) {
          throw new Error('移动收藏失败')
        }

        const folderName = createNew ? newFolderName : recommendation?.folderName
        toast.success(`已移动到「${folderName}」`)
      }

      // 刷新页面数据
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    }
  }, [bookmarkId, recommendation, router])

  /**
   * 关闭推荐
   */
  const dismissRecommendation = useCallback(() => {
    setRecommendation(null)
    setBookmarkId(null)
  }, [])

  return {
    recommendation,
    bookmarkId,
    isLoading,
    fetchRecommendation,
    applyRecommendation,
    dismissRecommendation,
  }
}
