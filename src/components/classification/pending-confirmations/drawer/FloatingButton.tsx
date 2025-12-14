"use client";

/**
 * FloatingButton
 * 浮动按钮组件
 *
 * @description
 * - 右下角固定位置显示
 * - 显示待确认数量
 * - 新消息时有脉冲动画
 * - 渐变紫色背景
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FloatingButtonProps } from "../types";

export function FloatingButton({
  count,
  onClick,
  isNew = false,
}: FloatingButtonProps) {
  const [showPulse, setShowPulse] = useState(isNew);

  // 新消息脉冲动画（显示 2 秒后停止）
  useEffect(() => {
    if (!isNew) return;

    // 使用 requestAnimationFrame 避免同步 setState 警告
    const frameId = requestAnimationFrame(() => {
      setShowPulse(true);
    });

    const timer = setTimeout(() => {
      setShowPulse(false);
    }, 2000);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
    };
  }, [isNew]);

  // 如果没有待确认消息，不显示
  if (count === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 脉冲背景 */}
      {showPulse && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl",
            "bg-gradient-to-br from-violet-500 to-indigo-600",
            "animate-ping opacity-75",
          )}
        />
      )}

      {/* 主按钮 */}
      <Button
        onClick={onClick}
        className={cn(
          "relative h-12 w-12 rounded-xl p-0",
          "bg-gradient-to-br from-violet-500 to-indigo-600",
          "hover:from-violet-600 hover:to-indigo-700",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-300",
          "transform hover:scale-105",
        )}
      >
        <Sparkles className="w-5 h-5 text-white" />

        {/* 数量徽章 */}
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5",
            "flex items-center justify-center",
            "min-w-[20px] h-5 px-1.5",
            "text-xs font-bold text-white",
            "bg-red-500 rounded-full",
            "shadow-sm",
            showPulse && "animate-bounce",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      </Button>
    </div>
  );
}
