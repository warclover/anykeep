/**
 * 待整理智能整理横幅
 * 显示在首页顶部，提示用户有待处理的整理建议
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  FolderInput,
  Loader2,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInboxOrganization } from "@/hooks/domain/ai";

interface InboxOrganizationBannerProps {
  className?: string;
}

export function InboxOrganizationBanner({
  className,
}: InboxOrganizationBannerProps) {
  const {
    analysis,
    isLoading,
    isProcessing,
    refresh: _refresh,
    applySuggestion,
    rejectSuggestion,
    pendingCount,
  } = useInboxOrganization();

  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 如果已关闭、正在加载、或没有建议，返回 null
  if (isDismissed || isLoading || pendingCount === 0) return null;

  return (
    <div className={cn("relative", className)}>
      {/* 主横幅 */}
      <div className="rounded-xl border overflow-hidden transition-all duration-300 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-800">
        {/* 顶部装饰条 */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* 图标和文字 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500">
                <Sparkles className="w-5 h-5 text-white" />
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  发现 {pendingCount} 个整理机会
                  <Badge variant="secondary" className="text-xs">
                    V2
                  </Badge>
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  AI 分析了待整理文件夹，发现一些内容可以归类整理
                </p>

                {/* 建议预览 */}
                {isExpanded && analysis?.suggestions && (
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {analysis.suggestions.slice(0, 5).map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="flex items-center gap-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg"
                      >
                        {/* 图标 */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            suggestion.suggestionType === "create_new"
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-blue-100 dark:bg-blue-900/30",
                          )}
                        >
                          {suggestion.suggestionType === "create_new" ? (
                            <FolderPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <FolderInput className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>

                        {/* 信息 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {suggestion.suggestionType === "create_new"
                              ? `创建「${suggestion.suggestedFolderName}」`
                              : `移动到「${suggestion.suggestedFolderName}」`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {suggestion.bookmarkIds.length} 个书签 · 置信度{" "}
                            {suggestion.confidence}%
                          </p>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => rejectSuggestion(suggestion.id)}
                            disabled={isProcessing}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                            onClick={() => applySuggestion(suggestion.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}

                    {analysis.suggestions.length > 5 && (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          还有 {analysis.suggestions.length - 5} 条建议
                        </p>
                        <Link
                          href="/inbox"
                          className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
                        >
                          查看全部
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 操作区域 */}
            <div className="flex items-center gap-2 shrink-0">
              {/* 展开/收起按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    预览
                  </>
                )}
              </Button>

              {/* 进入整理按钮 */}
              <Button
                asChild
                size="sm"
                className="h-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              >
                <Link href="/inbox">
                  进入整理
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>

              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InboxOrganizationBanner;
