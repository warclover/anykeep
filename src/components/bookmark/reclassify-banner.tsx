/**
 * 重分类通知横幅组件
 * 显示在首页顶部，提示用户有待处理的分类建议或需要执行重分类
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  RefreshCw,
  X,
  ChevronRight,
  Loader2,
  Check,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReclassify } from "@/hooks/use-reclassify";

interface ReclassifyBannerProps {
  className?: string;
}

export function ReclassifyBanner({ className }: ReclassifyBannerProps) {
  const {
    checkResult,
    suggestions,
    isRunning,
    isProcessing,
    runReclassify,
    acceptAllSuggestions,
    rejectAllSuggestions,
    stats,
  } = useReclassify();

  const [isDismissed, setIsDismissed] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 如果已关闭或没有需要显示的内容，返回 null
  if (isDismissed) return null;

  const hasPendingSuggestions = stats.pending > 0;
  const shouldTrigger = checkResult?.shouldTrigger && !hasPendingSuggestions;

  // 如果没有任何需要显示的内容
  if (!hasPendingSuggestions && !shouldTrigger) return null;

  return (
    <div className={cn("relative", className)}>
      {/* 主横幅 */}
      <div
        className={cn(
          "rounded-xl border overflow-hidden transition-all duration-300",
          hasPendingSuggestions
            ? "bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 dark:from-purple-950/30 dark:to-blue-950/30 dark:border-purple-800"
            : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800",
        )}
      >
        {/* 顶部装饰条 */}
        <div
          className={cn(
            "h-1",
            hasPendingSuggestions
              ? "bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500"
              : "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500",
          )}
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* 图标和文字 */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  hasPendingSuggestions
                    ? "bg-gradient-to-br from-purple-500 to-blue-500"
                    : "bg-gradient-to-br from-amber-500 to-orange-500",
                )}
              >
                {hasPendingSuggestions ? (
                  <Sparkles className="w-5 h-5 text-white" />
                ) : (
                  <Inbox className="w-5 h-5 text-white" />
                )}
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {hasPendingSuggestions
                    ? `有 ${stats.pending} 条分类建议待确认`
                    : "待整理文件夹需要整理"}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {hasPendingSuggestions
                    ? "AI 已为您的收藏生成智能分类建议，请确认或忽略"
                    : checkResult?.triggers.threshold
                      ? `待整理文件夹已有 ${checkResult.stats.inboxCount} 条收藏，建议执行智能分类`
                      : `距离上次整理已过 ${checkResult?.stats.daysSinceLastRun} 天，建议执行智能分类`}
                </p>

                {/* 建议列表预览 */}
                {hasPendingSuggestions &&
                  showSuggestions &&
                  suggestions.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                      {suggestions.slice(0, 5).map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="flex items-center gap-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg"
                        >
                          {suggestion.bookmarks?.cover_url ? (
                            <Image
                              src={suggestion.bookmarks.cover_url}
                              alt=""
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {suggestion.bookmarks?.title || "未知标题"}
                            </p>
                            <p className="text-xs text-gray-500">
                              → {suggestion.suggest_new_folder ? "新建" : ""}
                              {suggestion.suggested_folder_name}
                              <span className="ml-2 text-purple-600">
                                {suggestion.confidence}% 匹配
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                      {suggestions.length > 5 && (
                        <p className="text-xs text-gray-500 text-center py-1">
                          还有 {suggestions.length - 5} 条建议...
                        </p>
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {hasPendingSuggestions ? (
              <>
                <Button
                  onClick={acceptAllSuggestions}
                  disabled={isProcessing}
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  全部接受
                </Button>
                <Button
                  onClick={rejectAllSuggestions}
                  disabled={isProcessing}
                  variant="outline"
                  size="sm"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  全部忽略
                </Button>
                <Button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600"
                >
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 mr-1 transition-transform",
                      showSuggestions && "rotate-90",
                    )}
                  />
                  {showSuggestions ? "收起" : "查看详情"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => runReclassify()}
                  disabled={isRunning}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                  )}
                  立即整理
                </Button>
                <Button
                  onClick={() => setIsDismissed(true)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600"
                >
                  稍后再说
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
