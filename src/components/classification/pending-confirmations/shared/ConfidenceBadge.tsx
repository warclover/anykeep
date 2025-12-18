"use client";

/**
 * ConfidenceBadge
 * 置信度徽章组件
 *
 * @description 显示 AI 分类的置信度
 * - 支持颜色分级（高/中/低）
 * - 可选显示标签文字
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ConfidenceBadgeProps } from "../types";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取置信度颜色
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (confidence >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

/**
 * 获取置信度背景色
 */
function getConfidenceBgColor(confidence: number): string {
  if (confidence >= 80)
    return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
  if (confidence >= 60)
    return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
}

/**
 * 获取置信度等级描述
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 80) return "高置信度";
  if (confidence >= 60) return "中置信度";
  return "低置信度";
}

// ============================================================================
// 组件
// ============================================================================

export function ConfidenceBadge({
  confidence,
  showLabel = false,
  size = "default",
}: ConfidenceBadgeProps) {
  const colorClass = getConfidenceColor(confidence);
  const bgClass = getConfidenceBgColor(confidence);
  const level = getConfidenceLevel(confidence);

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium transition-colors",
        bgClass,
        colorClass,
        size === "sm" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5",
      )}
    >
      <Sparkles
        className={cn("mr-1", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")}
      />
      {confidence}%{showLabel && <span className="ml-1">{level}</span>}
    </Badge>
  );

  // 带 Tooltip 版本
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">AI 置信度: {level}</p>
          <p className="text-xs text-muted-foreground">
            {confidence >= 80 && "AI 对此分类非常有信心"}
            {confidence >= 60 && confidence < 80 && "AI 对此分类较有把握"}
            {confidence < 60 && "建议您检查此分类是否正确"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
