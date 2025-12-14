"use client";

/**
 * InlineExpandedList
 * 内联展开列表组件
 *
 * @description
 * - 展开状态下显示所有待确认消息
 * - 底部提供批量操作按钮
 * - 带动画过渡效果
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState } from "react";
import { Check, X, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InlineListItem } from "./InlineListItem";
import type { InlineExpandedListProps } from "../types";

export function InlineExpandedList({
  messages,
  folders,
  onConfirm,
  onReject,
  onModify,
  onConfirmAll,
  onRejectAll,
}: InlineExpandedListProps) {
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [isRejectingAll, setIsRejectingAll] = useState(false);

  // 处理全部确认
  const handleConfirmAll = async () => {
    setIsConfirmingAll(true);
    try {
      await onConfirmAll();
    } finally {
      setIsConfirmingAll(false);
    }
  };

  // 处理全部忽略
  const handleRejectAll = async () => {
    setIsRejectingAll(true);
    try {
      await onRejectAll();
    } finally {
      setIsRejectingAll(false);
    }
  };

  const isLoading = isConfirmingAll || isRejectingAll;

  return (
    <div
      className={cn(
        "border border-t-0 border-violet-200 dark:border-violet-800",
        "rounded-b-lg overflow-hidden",
        "bg-white dark:bg-gray-950",
      )}
    >
      {/* 列表 */}
      <div className="max-h-[320px] overflow-y-auto">
        {messages.map((message) => (
          <InlineListItem
            key={message.id}
            message={message}
            folders={folders}
            onConfirm={() => onConfirm(message.id)}
            onReject={() => onReject(message.id)}
            onModify={(newFolderId) => onModify(message.id, newFolderId)}
          />
        ))}
      </div>

      {/* 底部批量操作栏 */}
      <div
        className={cn(
          "flex items-center justify-center gap-3 px-4 py-3",
          "border-t border-violet-100 dark:border-violet-900/50",
          "bg-violet-50/50 dark:bg-violet-950/20",
        )}
      >
        <Button
          variant="default"
          size="sm"
          onClick={handleConfirmAll}
          disabled={isLoading || messages.length === 0}
          className={cn(
            "bg-emerald-600 hover:bg-emerald-700 text-white",
            "dark:bg-emerald-500 dark:hover:bg-emerald-600",
          )}
        >
          {isConfirmingAll ? (
            <RefreshCcw className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-1.5" />
          )}
          全部确认
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRejectAll}
          disabled={isLoading || messages.length === 0}
          className="text-gray-600 hover:text-red-600 hover:border-red-300 dark:text-gray-400 dark:hover:text-red-400"
        >
          {isRejectingAll ? (
            <RefreshCcw className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <X className="w-4 h-4 mr-1.5" />
          )}
          全部忽略
        </Button>
      </div>
    </div>
  );
}
