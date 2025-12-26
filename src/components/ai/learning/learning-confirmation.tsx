"use client";

/**
 * 学习确认提示组件
 *
 * 当 AI 成功学习用户纠正后显示的确认提示
 * 自动消失，告知用户"下次会更准确"
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 */

import { memo, useEffect, useRef } from "react";
import { Sparkles, Brain, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningConfirmationProps } from "./types";
import { INTENT_DISPLAY_NAMES } from "./types";

// =============================================================================
// 组件实现
// =============================================================================

export const LearningConfirmation = memo(function LearningConfirmation({
  wrongIntent: _wrongIntent, // Reserved for future use
  correctIntent,
  isVisible,
  autoHideDuration = 3000,
  onDismiss,
}: LearningConfirmationProps) {
  const progressRef = useRef<HTMLDivElement>(null);

  // 自动消失
  useEffect(() => {
    if (!isVisible || autoHideDuration <= 0) return;

    const timer = setTimeout(() => {
      onDismiss?.();
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [isVisible, autoHideDuration, onDismiss]);

  // 进度条动画（使用 ref 直接操作 DOM 避免 setState in effect）
  useEffect(() => {
    if (!isVisible || !progressRef.current) return;

    const element = progressRef.current;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / autoHideDuration) * 100);
      element.style.width = `${remaining}%`;

      if (remaining > 0) {
        requestAnimationFrame(animate);
      }
    };

    // 重置进度条
    element.style.width = "100%";
    const frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [isVisible, autoHideDuration]);

  if (!isVisible) return null;

  const correctIntentName = INTENT_DISPLAY_NAMES[correctIntent];

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
      )}
    >
      <div
        className={cn(
          "relative flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-gradient-to-r from-emerald-50 to-teal-50",
          "border border-emerald-200 shadow-lg shadow-emerald-100/50",
        )}
      >
        {/* 成功图标 - 带动画 */}
        <div className="relative flex-shrink-0">
          <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 shadow-sm">
            <Brain className="size-5 text-white" />
          </div>
          {/* 成功徽章 */}
          <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center size-4 rounded-full bg-white shadow-sm">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </div>
          {/* 闪烁效果 */}
          <Sparkles
            className={cn(
              "absolute -top-1 -right-1 size-3 text-amber-400",
              "animate-pulse",
            )}
          />
        </div>

        {/* 内容 */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <span>AI 已学习</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">
              {correctIntentName}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-emerald-600">
            下次遇到类似问题时会更准确 ✨
          </p>
        </div>

        {/* 进度条（自动消失倒计时） */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-100 rounded-b-xl overflow-hidden">
          <div
            ref={progressRef}
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-none"
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
});

export default LearningConfirmation;
