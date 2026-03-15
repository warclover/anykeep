/**
 * 空状态组件
 *
 * 支持两种场景：
 * - default: 新用户/无收藏 — 显示完整 CTA 引导
 * - filtered: 筛选无结果 — 显示简化提示
 *
 * 所有文本通过 i18n 获取，支持多语言。
 */

"use client";

import { Upload, Plus, Link2, Smartphone, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";

interface EmptyStateProps {
  /** 显示场景：default=无收藏, filtered=筛选无结果 */
  variant?: "default" | "filtered";
  /** 点击"导入浏览器书签"回调 */
  onImport?: () => void;
  /** 点击"手动添加收藏"回调 */
  onCreateManual?: () => void;
  /** 点击"粘贴链接快速添加"回调 */
  onQuickAdd?: () => void;
}

export function EmptyState({
  variant = "default",
  onImport,
  onCreateManual,
  onQuickAdd,
}: EmptyStateProps) {
  const t = useUiText();

  // 筛选无结果场景
  if (variant === "filtered") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-muted/50 flex items-center justify-center">
          <SearchX className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-medium text-muted-foreground mb-1">
          {t.emptyState?.filteredTitle ?? "没有找到匹配的收藏"}
        </h3>
        <p className="text-sm text-muted-foreground/70">
          {t.emptyState?.filteredDescription ?? "试试调整筛选条件或清除筛选"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* 插画图标 - 渐变圆形 */}
      <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-purple-500 dark:text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {t.emptyState?.title ?? "开始你的智能收藏之旅"}
      </h3>

      {/* 说明 */}
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
        {t.emptyState?.description ?? "通过以下方式快速添加你的第一个收藏"}
      </p>

      {/* CTA 按钮组 */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md px-4">
        {/* 主按钮：导入浏览器书签 */}
        <Button
          className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-600 hover:to-violet-600"
          onClick={onImport}
        >
          <Upload className="size-4" />
          {t.emptyState?.importBrowser ?? "导入浏览器书签"}
        </Button>

        {/* 次按钮：手动添加收藏 */}
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={onCreateManual}
        >
          <Plus className="size-4" />
          {t.emptyState?.createManual ?? "手动添加收藏"}
        </Button>

        {/* 次按钮：粘贴链接快速添加 */}
        <Button variant="outline" className="flex-1 gap-2" onClick={onQuickAdd}>
          <Link2 className="size-4" />
          {t.emptyState?.quickAdd ?? "粘贴链接快速添加"}
        </Button>
      </div>

      {/* 新手提示 */}
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Smartphone className="size-3.5" />
        <span>
          {t.emptyState?.tip ??
            "支持微信公众号、小红书、B站等平台，通过分享菜单一键收藏"}
        </span>
      </div>
    </div>
  );
}
