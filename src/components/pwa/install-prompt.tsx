/**
 * PWA 安装提示组件
 *
 * 引导用户将应用安装到主屏幕，安装后自动弹出分享教程。
 * 使用 usePwaInstall 统一管理安装状态和展示时机。
 *
 * 展示条件（由 usePwaInstall.shouldShowBanner 判断）：
 * - 未安装 + 未关闭 + 移动端 + 访问次数 >= 3 + (支持安装提示 || iOS)
 *
 * @version 2.0.0 — 重构为 usePwaInstall 驱动
 * @since 2026-01-08
 */

"use client";

import { useState, useCallback } from "react";
import { X, Download, Smartphone, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/domain/pwa";
import { ShareGuideDialog } from "./share-guide-dialog";

const TEXT = {
  TITLE: "安装 AnyKeep",
  SUBTITLE: "添加到主屏幕，随时访问",
  FEATURES: [
    "一键启动，无需打开浏览器",
    "系统分享菜单快速收藏",
    "离线浏览已缓存内容",
  ],
  IOS_GUIDE: "点击底部分享按钮",
  IOS_GUIDE_SUFFIX: "，然后选择「添加到主屏幕」",
  GENERIC_GUIDE: "使用浏览器菜单中的「添加到主屏幕」或「安装应用」选项",
  GOT_IT: "我知道了",
  LATER: "稍后再说",
  INSTALL: "立即安装",
} as const;

export function InstallPrompt() {
  const {
    canInstall,
    isIOS: isIOSDevice,
    shouldShowBanner,
    install,
    dismiss,
  } = usePwaInstall();

  const [showShareGuide, setShowShareGuide] = useState(false);

  const handleInstall = useCallback(async () => {
    const success = await install();
    if (success) {
      // 安装成功后显示分享教程
      setShowShareGuide(true);
    }
  }, [install]);

  return (
    <>
      {shouldShowBanner && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* 关闭按钮 */}
            <button
              onClick={dismiss}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="关闭"
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
                    {TEXT.TITLE}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {TEXT.SUBTITLE}
                  </p>
                </div>
              </div>

              {/* 功能亮点 */}
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mb-4">
                {TEXT.FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-indigo-500 rounded-full flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* 操作按钮 */}
              {isIOSDevice ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                    {TEXT.IOS_GUIDE} <Share2 className="w-3 h-3 inline" />
                    {TEXT.IOS_GUIDE_SUFFIX}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismiss}
                    className="w-full"
                  >
                    {TEXT.GOT_IT}
                  </Button>
                </div>
              ) : canInstall ? (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismiss}
                    className="flex-1"
                  >
                    {TEXT.LATER}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleInstall}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {TEXT.INSTALL}
                  </Button>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                    {TEXT.GENERIC_GUIDE}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismiss}
                    className="w-full"
                  >
                    {TEXT.GOT_IT}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ShareGuideDialog
        trigger={showShareGuide}
        onClose={() => setShowShareGuide(false)}
      />
    </>
  );
}
