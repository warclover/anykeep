/**
 * 浏览器书签批量导入组件
 * PRD v4.1: 支持从浏览器书签栏批量导入
 */

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  Link2,
  Check,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Import
} from 'lucide-react'

interface BookmarkNode {
  id: string
  title: string
  url?: string
  children?: BookmarkNode[]
  dateAdded?: number
}

interface ImportState {
  status: 'idle' | 'importing' | 'success' | 'error'
  message?: string
  progress?: { current: number; total: number }
}

interface BookmarkImportProps {
  onBack: () => void
}

export function BookmarkImport({ onBack }: BookmarkImportProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' })

  // 加载书签树
  useEffect(() => {
    loadBookmarks()
  }, [])

  async function loadBookmarks() {
    try {
      const tree = await browser.bookmarks.getTree()
      setBookmarks(tree[0]?.children || [])
    } catch (error) {
      console.error('Failed to load bookmarks:', error)
    } finally {
      setLoading(false)
    }
  }

  // 切换文件夹展开状态
  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 切换书签选中状态
  function toggleBookmark(id: string, url?: string) {
    if (!url) return // 只能选择有 URL 的书签

    setSelectedBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 全选/取消文件夹内所有书签
  function toggleFolderSelection(folder: BookmarkNode, selected: boolean) {
    setSelectedBookmarks((prev) => {
      const next = new Set(prev)

      function processNode(node: BookmarkNode) {
        if (node.url) {
          if (selected) {
            next.add(node.id)
          } else {
            next.delete(node.id)
          }
        }
        if (node.children) {
          node.children.forEach(processNode)
        }
      }

      processNode(folder)
      return next
    })
  }

  // 获取选中的书签详情
  function getSelectedBookmarkDetails(): { id: string; title: string; url: string }[] {
    const details: { id: string; title: string; url: string }[] = []

    function processNode(node: BookmarkNode) {
      if (node.url && selectedBookmarks.has(node.id)) {
        details.push({
          id: node.id,
          title: node.title,
          url: node.url,
        })
      }
      if (node.children) {
        node.children.forEach(processNode)
      }
    }

    bookmarks.forEach(processNode)
    return details
  }

  // 批量导入书签
  async function handleImport() {
    const selected = getSelectedBookmarkDetails()
    if (selected.length === 0) return

    setImportState({
      status: 'importing',
      progress: { current: 0, total: selected.length }
    })

    try {
      const storage = await browser.storage.local.get(['authToken', 'userId', 'apiUrl'])

      if (!storage.authToken || !storage.userId) {
        throw new Error('请先登录 AnyKeep')
      }

      const apiUrl = storage.apiUrl || 'https://anykeep.vercel.app'
      let successCount = 0
      let failCount = 0

      // 逐个导入（可改为批量 API）
      for (let i = 0; i < selected.length; i++) {
        const bookmark = selected[i]

        try {
          const response = await fetch(`${apiUrl}/api/bookmarks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storage.authToken}`,
            },
            body: JSON.stringify({
              title: bookmark.title,
              url: bookmark.url,
              platform: detectPlatform(bookmark.url),
              user_id: storage.userId,
              source: 'browser_import',
            }),
          })

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }

        setImportState({
          status: 'importing',
          progress: { current: i + 1, total: selected.length },
        })
      }

      setImportState({
        status: 'success',
        message: `成功导入 ${successCount} 个书签${failCount > 0 ? `，${failCount} 个失败` : ''}`,
      })

      // 清除选中
      setSelectedBookmarks(new Set())

    } catch (error) {
      setImportState({
        status: 'error',
        message: error instanceof Error ? error.message : '导入失败',
      })
    }
  }

  // 平台检测
  function detectPlatform(url: string): string {
    const patterns: Record<string, RegExp[]> = {
      WECHAT_OFFICIAL_ACCOUNT: [/mp\.weixin\.qq\.com/],
      BILIBILI: [/bilibili\.com/, /b23\.tv/],
      XIAOHONGSHU: [/xiaohongshu\.com/, /xhslink\.com/],
      ZHIHU: [/zhihu\.com/],
      GITHUB: [/github\.com/],
      YOUTUBE: [/youtube\.com/, /youtu\.be/],
    }

    for (const [platform, regexes] of Object.entries(patterns)) {
      if (regexes.some((r) => r.test(url))) {
        return platform
      }
    }
    return 'OTHER'
  }

  // 渲染书签树节点
  function renderNode(node: BookmarkNode, depth: number = 0) {
    const isFolder = !node.url
    const isExpanded = expandedFolders.has(node.id)
    const isSelected = selectedBookmarks.has(node.id)

    if (isFolder) {
      // 计算文件夹内选中数量
      let totalInFolder = 0
      let selectedInFolder = 0

      function countBookmarks(n: BookmarkNode) {
        if (n.url) {
          totalInFolder++
          if (selectedBookmarks.has(n.id)) selectedInFolder++
        }
        n.children?.forEach(countBookmarks)
      }
      countBookmarks(node)

      const allSelected = totalInFolder > 0 && selectedInFolder === totalInFolder
      const partialSelected = selectedInFolder > 0 && selectedInFolder < totalInFolder

      return (
        <div key={node.id}>
          <div
            className="flex items-center gap-2 py-2 px-2 hover:bg-gray-50 rounded-lg cursor-pointer group"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {/* 展开按钮 */}
            <button
              onClick={() => toggleFolder(node.id)}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* 文件夹图标 */}
            {isExpanded ? (
              <FolderOpen className="w-5 h-5 text-amber-500" />
            ) : (
              <Folder className="w-5 h-5 text-amber-500" />
            )}

            {/* 文件夹名 */}
            <span className="flex-1 text-sm text-gray-700 truncate">{node.title || '书签栏'}</span>

            {/* 全选复选框 */}
            {totalInFolder > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolderSelection(node, !allSelected)
                }}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'bg-indigo-500 border-indigo-500'
                    : partialSelected
                    ? 'bg-indigo-200 border-indigo-500'
                    : 'border-gray-300 hover:border-indigo-400'
                }`}
              >
                {(allSelected || partialSelected) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </button>
            )}

            {/* 计数 */}
            <span className="text-xs text-gray-400">
              {selectedInFolder > 0 ? `${selectedInFolder}/` : ''}{totalInFolder}
            </span>
          </div>

          {/* 子节点 */}
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    // 书签项
    return (
      <div
        key={node.id}
        onClick={() => toggleBookmark(node.id, node.url)}
        className={`flex items-center gap-2 py-2 px-2 hover:bg-gray-50 rounded-lg cursor-pointer ${
          isSelected ? 'bg-indigo-50' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 28}px` }}
      >
        {/* 复选框 */}
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-indigo-500 border-indigo-500'
              : 'border-gray-300'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>

        {/* 链接图标 */}
        <Link2 className="w-4 h-4 text-gray-400 shrink-0" />

        {/* 标题 */}
        <span className="text-sm text-gray-700 truncate">{node.title}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          onClick={onBack}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="font-semibold text-gray-900">导入浏览器书签</h2>
          <p className="text-xs text-gray-500">选择要导入的书签</p>
        </div>
      </header>

      {/* 书签列表 */}
      <main className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Folder className="w-12 h-12 text-gray-300 mb-2" />
            <p className="text-gray-500">暂无书签</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {bookmarks.map((node) => renderNode(node))}
          </div>
        )}
      </main>

      {/* Footer - 导入按钮 */}
      <footer className="px-4 py-3 border-t border-gray-100">
        {importState.status === 'idle' && (
          <button
            onClick={handleImport}
            disabled={selectedBookmarks.size === 0}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              selectedBookmarks.size > 0
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Import className="w-5 h-5" />
            导入 {selectedBookmarks.size > 0 ? `${selectedBookmarks.size} 个` : ''}书签
          </button>
        )}

        {importState.status === 'importing' && importState.progress && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(importState.progress.current / importState.progress.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-center text-sm text-gray-500">
              正在导入 {importState.progress.current} / {importState.progress.total}
            </p>
          </div>
        )}

        {importState.status === 'success' && (
          <div className="w-full py-3 bg-green-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            {importState.message}
          </div>
        )}

        {importState.status === 'error' && (
          <div className="space-y-2">
            <div className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-medium flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {importState.message}
            </div>
            <button
              onClick={() => setImportState({ status: 'idle' })}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              重试
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
