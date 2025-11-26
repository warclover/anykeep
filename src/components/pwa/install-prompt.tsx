/**
 * PWA 安装提示组件
 * 引导用户将应用添加到主屏幕
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Download, Smartphone, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt, usePlatform } from '@/hooks/use-capacitor'

export function InstallPrompt() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const { isNative } = usePlatform()
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // 检查是否应该显示提示
  useEffect(() => {
    // 已安装或原生应用中不显示
    if (isInstalled || isNative) return

    // 检查是否之前已关闭
    const dismissedTime = localStorage.getItem('pwa-prompt-dismissed')
    if (dismissedTime) {
      const dismissedDate = new Date(parseInt(dismissedTime))
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
      // 7 天内不再显示
      if (daysSinceDismissed < 7) return
    }

    // 延迟显示提示
    const timer = setTimeout(() => {
      setShowPrompt(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [isInstalled, isNative])

  const handleDismiss = () => {
    setDismissed(true)
    setShowPrompt(false)
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
  }

  const handleInstall = async () => {
    const success = await promptInstall()
    if (success) {
      setShowPrompt(false)
    }
  }

  // 不显示的情况
  if (!showPrompt || dismissed || isInstalled || isNative) {
    return null
  }

  // iOS Safari 特殊处理（不支持自动安装提示）
  const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* 关闭按钮 */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4">
          {/* 图标和标题 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                安装 AnyKeep
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                添加到主屏幕，随时访问
              </p>
            </div>
          </div>

          {/* 功能亮点 */}
          <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mb-4">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-indigo-500 rounded-full" />
              一键启动，无需打开浏览器
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-indigo-500 rounded-full" />
              系统分享菜单快速收藏
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-indigo-500 rounded-full" />
              离线浏览已缓存内容
            </li>
          </ul>

          {/* 操作按钮 */}
          {isIOSSafari ? (
            // iOS Safari 手动安装指引
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                点击底部分享按钮 <Share2 className="w-3 h-3 inline" />，然后选择「添加到主屏幕」
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="w-full"
              >
                我知道了
              </Button>
            </div>
          ) : canInstall ? (
            // 支持安装提示的浏览器
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="flex-1"
              >
                稍后再说
              </Button>
              <Button
                size="sm"
                onClick={handleInstall}
                className="flex-1 bg-indigo-500 hover:bg-indigo-600"
              >
                <Download className="w-4 h-4 mr-1" />
                立即安装
              </Button>
            </div>
          ) : (
            // 不支持安装但显示提示（通用浏览器指引）
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                使用浏览器菜单中的「添加到主屏幕」或「安装应用」选项
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="w-full"
              >
                我知道了
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
