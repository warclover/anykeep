"use client";

/**
 * InlineNotificationBar
 * 内联通知条组件（收起状态）
 *
 * @description
 * - 单行紧凑显示待确认数量和平均置信度
 * - 提供一键确认和展开详情操作
 * - 淡紫色渐变背景，AI 感十足
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Settings,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { InlineNotificationBarProps } from "../types";

export function InlineNotificationBar({
  messages,
  averageConfidence,
  isExpanded,
  onToggleExpand,
  onConfirmAll,
  onModeChange,
  isLoading = false,
}: InlineNotificationBarProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const count = messages.length;

  // 处理一键确认
  const handleConfirmAll = async () => {
    setIsConfirming(true);
    try {
      await onConfirmAll();
    } finally {
      setIsConfirming(false);
    }
  };

  // 获取置信度颜色
  const getConfidenceColor = () => {
    if (averageConfidence >= 80)
      return "text-emerald-600 dark:text-emerald-400";
    if (averageConfidence >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5",
        "bg-gradient-to-r from-violet-50 to-indigo-50",
        "dark:from-violet-950/30 dark:to-indigo-950/30",
        "border border-violet-200 dark:border-violet-800",
        "rounded-lg transition-all duration-200",
        isExpanded ? "rounded-b-none border-b-0" : "",
      )}
    >
      {/* 左侧：图标 + 消息数量 + 置信度 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="font-medium text-violet-900 dark:text-violet-100">
            AI 建议了 {count} 条分类
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-sm">
          <span className="text-violet-600 dark:text-violet-400">
            平均置信度
          </span>
          <span className={cn("font-medium", getConfidenceColor())}>
            {averageConfidence}%
          </span>
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2">
        {/* 一键确认按钮 */}
        <Button
          size="sm"
          onClick={handleConfirmAll}
          disabled={isConfirming || isLoading || count === 0}
          className={cn(
            "bg-violet-600 hover:bg-violet-700 text-white",
            "dark:bg-violet-500 dark:hover:bg-violet-600",
          )}
        >
          {isConfirming ? (
            <RefreshCcw className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-1.5" />
          )}
          一键确认
        </Button>

        {/* 展开/收起按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="text-violet-700 hover:text-violet-900 hover:bg-violet-100 dark:text-violet-300 dark:hover:text-violet-100 dark:hover:bg-violet-900/50"
        >
          {isExpanded ? (
            <>
              收起
              <ChevronUp className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              展开
              <ChevronDown className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>

        {/* 设置下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-violet-600 hover:text-violet-900 hover:bg-violet-100 dark:text-violet-400 dark:hover:text-violet-100 dark:hover:bg-violet-900/50"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onModeChange}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              切换到浮动模式
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
