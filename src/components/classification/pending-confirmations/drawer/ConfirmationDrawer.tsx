"use client";

/**
 * ConfirmationDrawer
 * 确认消息侧边抽屉组件
 *
 * @description
 * - 从右侧滑入的抽屉面板
 * - 显示所有待确认消息
 * - 提供批量操作和模式切换
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState } from "react";
import { Sparkles, X, Check, RefreshCcw, ArrowLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DrawerCard } from "./DrawerCard";
import type { ConfirmationDrawerProps } from "../types";

export function ConfirmationDrawer({
  open,
  onOpenChange,
  messages,
  folders,
  onConfirm,
  onReject,
  onModify,
  onConfirmAll,
  onRejectAll,
  onModeChange,
}: ConfirmationDrawerProps) {
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [isRejectingAll, setIsRejectingAll] = useState(false);

  const handleConfirmAll = async () => {
    setIsConfirmingAll(true);
    try {
      await onConfirmAll();
    } finally {
      setIsConfirmingAll(false);
    }
  };

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "w-full sm:max-w-[420px] p-0 flex flex-col",
          "border-l-violet-200 dark:border-l-violet-800",
        )}
      >
        {/* 头部 */}
        <SheetHeader className="px-6 py-4 border-b border-violet-100 dark:border-violet-900/50 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <SheetTitle className="text-violet-900 dark:text-violet-100">
                AI 智能分类助手
              </SheetTitle>
            </div>
          </div>
          <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
            {messages.length} 条待确认的分类建议
          </p>
        </SheetHeader>

        {/* 内容区域 */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-3">
            {messages.map((message) => (
              <DrawerCard
                key={message.id}
                message={message}
                folders={folders}
                onConfirm={() => onConfirm(message.id)}
                onReject={() => onReject(message.id)}
                onModify={(newFolderId) => onModify(message.id, newFolderId)}
              />
            ))}

            {messages.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 mx-auto text-violet-300 dark:text-violet-700 mb-3" />
                <p className="text-muted-foreground">暂无待确认的分类建议</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 底部操作栏 */}
        <div className="px-4 py-4 border-t border-violet-100 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 space-y-3">
          {/* 批量操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleConfirmAll}
              disabled={isLoading || messages.length === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
              onClick={handleRejectAll}
              disabled={isLoading || messages.length === 0}
              className="flex-1 text-gray-600 hover:text-red-600 hover:border-red-300"
            >
              {isRejectingAll ? (
                <RefreshCcw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-1.5" />
              )}
              全部忽略
            </Button>
          </div>

          {/* 模式切换 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onModeChange}
            className="w-full text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            切换到内联模式
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
