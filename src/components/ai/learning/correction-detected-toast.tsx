"use client";

/**
 * 纠正检测提示组件
 *
 * 当检测到用户纠正 AI 理解时显示的 Toast 提示
 * 用户可以确认或取消纠正
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 */

import { memo, useEffect, useCallback } from "react";
import { ArrowRight, Check, X, AlertCircle, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CorrectionDetectedToastProps } from "./types";
import { INTENT_DISPLAY_NAMES } from "./types";

// =============================================================================
// 组件实现
// =============================================================================

export const CorrectionDetectedToast = memo(function CorrectionDetectedToast({
  detection,
  onConfirm,
  onCancel,
  isVisible,
  autoHideDuration = 0,
}: CorrectionDetectedToastProps) {
  // 自动消失计时器
  useEffect(() => {
    if (!isVisible || autoHideDuration <= 0) return;

    const timer = setTimeout(() => {
      onCancel();
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [isVisible, autoHideDuration, onCancel]);

  // 键盘快捷键
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, onConfirm, onCancel]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (!isVisible) return null;

  const { wrongIntent, correctIntent, confidence } = detection;
  const wrongIntentName = INTENT_DISPLAY_NAMES[wrongIntent];
  const correctIntentName = correctIntent
    ? INTENT_DISPLAY_NAMES[correctIntent]
    : "其他";

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-gradient-to-r from-amber-50 to-orange-50",
          "border border-amber-200 shadow-lg shadow-amber-100/50",
          "max-w-md",
        )}
      >
        {/* 图标 */}
        <div className="flex-shrink-0 flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm">
          <Brain className="size-5 text-white" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <AlertCircle className="size-4" />
            <span>检测到意图纠正</span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-sm text-amber-700">
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              {wrongIntentName}
            </span>
            <ArrowRight className="size-3.5 text-amber-500" />
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              {correctIntentName}
            </span>
            {confidence >= 0.9 && (
              <span className="text-xs text-amber-500">高置信度</span>
            )}
          </div>

          <p className="mt-1 text-xs text-amber-600">
            确认后 AI 将学习此偏好，下次更准确
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            onClick={handleCancel}
          >
            <X className="size-4 mr-1" />
            <span className="text-xs">忽略</span>
          </Button>

          <Button
            size="sm"
            className="h-8 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm"
            onClick={handleConfirm}
          >
            <Check className="size-4 mr-1" />
            <span className="text-xs">确认学习</span>
          </Button>
        </div>
      </div>

      {/* 键盘提示 */}
      <div className="flex justify-center gap-3 mt-2 text-xs text-gray-400">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">
            Enter
          </kbd>{" "}
          确认
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          取消
        </span>
      </div>
    </div>
  );
});

export default CorrectionDetectedToast;
