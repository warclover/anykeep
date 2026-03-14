"use client";

/**
 * PWA 分享教程弹窗
 *
 * 在 PWA 安装成功后或首次以 standalone 模式打开时，
 * 显示「从手机分享内容到 AnyKeep」的 3 步教程。
 * 通过 localStorage 记录，仅显示一次。
 */

import { useState, useEffect, useCallback } from "react";
import { Share2, Smartphone, Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const GUIDE_STORAGE_KEY = "anykeep_guide_share_v1";

interface ShareGuideDialogProps {
  /** 外部触发显示（PWA 安装成功时设为 true） */
  trigger?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

export function ShareGuideDialog({ trigger, onClose }: ShareGuideDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (dismissed) return;

    // 外部触发（安装成功后）或首次 standalone 模式打开
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone);

    if (trigger || isStandalone) {
      const timer = setTimeout(() => setVisible(true), trigger ? 300 : 1000);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  const handleClose = useCallback(() => {
    setVisible(false);
    localStorage.setItem(GUIDE_STORAGE_KEY, "true");
    onClose?.();
  }, [onClose]);

  if (!visible) return null;

  const steps = [
    {
      icon: Share2,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      title: "点击分享",
      description: "在任意 App 中找到分享按钮",
    },
    {
      icon: Smartphone,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/30",
      title: "选择 AnyKeep",
      description: "在分享面板中找到 AnyKeep 图标",
    },
    {
      icon: Bookmark,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-900/30",
      title: "自动收藏",
      description: "链接自动识别并保存到收藏",
    },
  ];

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
          aria-label="关闭"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 头部渐变 */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 pt-8 pb-6 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-2xl flex items-center justify-center">
            <Share2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold">从任意 App 分享到 AnyKeep</h2>
          <p className="text-sm text-white/80 mt-1">随时随地收藏感兴趣的内容</p>
        </div>

        {/* 步骤 */}
        <div className="px-6 py-5 space-y-4">
          {steps.map((s, idx) => (
            <div key={s.title} className="flex items-start gap-3">
              {/* 步骤编号 */}
              <div
                className={`flex-shrink-0 w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}
              >
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {s.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 pb-6">
          <Button
            onClick={handleClose}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            开始使用
          </Button>
        </div>
      </div>
    </div>
  );
}
