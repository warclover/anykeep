/**
 * BlueprintQuotaBar - 蓝图配额进度条
 * @module components/knowledge-studio/quota
 *
 * Story 8.3 实现：
 * - 显示当前配额使用情况
 * - 三种告警级别（正常/警告/危险）
 * - 支持三种显示模式
 */

"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, Sparkles, Zap } from "lucide-react";
import { KS_QUOTA } from "@/lib/constants/messages";

// ============================================================================
// Types
// ============================================================================

export interface BlueprintQuotaBarProps {
  /** 已使用配额 */
  used: number;
  /** 总配额限制（-1 表示无限） */
  limit: number;
  /** 显示模式 */
  mode?: "minimal" | "compact" | "bar";
  /** 会员类型 */
  membershipType?: "free" | "pro" | "enterprise";
  /** 配额重置日期 */
  resetAt?: Date;
  /** 自定义类名 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 警告阈值（80%） */
const WARNING_THRESHOLD = 80;
/** 危险阈值（95%） */
const DANGER_THRESHOLD = 95;

// ============================================================================
// Component
// ============================================================================

export function BlueprintQuotaBar({
  used,
  limit,
  mode = "bar",
  membershipType = "free",
  resetAt,
  className,
}: BlueprintQuotaBarProps) {
  // 无限配额
  const isUnlimited = limit === -1;

  // 计算使用百分比
  const percent = isUnlimited ? 0 : Math.round((used / limit) * 100);

  // 剩余配额
  const remaining = isUnlimited ? 999999 : Math.max(0, limit - used);

  // 告警级别
  const getAlertLevel = (): "normal" | "warning" | "danger" => {
    if (isUnlimited) return "normal";
    if (percent >= DANGER_THRESHOLD) return "danger";
    if (percent >= WARNING_THRESHOLD) return "warning";
    return "normal";
  };

  const alertLevel = getAlertLevel();

  // 颜色映射
  const colorMap = {
    normal: {
      bar: "bg-emerald-500",
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: "text-emerald-500",
    },
    warning: {
      bar: "bg-amber-500",
      text: "text-amber-600",
      bg: "bg-amber-50",
      icon: "text-amber-500",
    },
    danger: {
      bar: "bg-red-500",
      text: "text-red-600",
      bg: "bg-red-50",
      icon: "text-red-500",
    },
  };

  const colors = colorMap[alertLevel];

  // Minimal 模式：仅数字
  if (mode === "minimal") {
    return (
      <span className={cn("text-sm", colors.text, className)}>
        {KS_QUOTA.REMAINING(remaining, limit)}
      </span>
    );
  }

  // Compact 模式：图标 + 数字
  if (mode === "compact") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {isUnlimited ? (
          <Sparkles className="h-4 w-4 text-purple-500" />
        ) : alertLevel === "danger" ? (
          <AlertCircle className={cn("h-4 w-4", colors.icon)} />
        ) : (
          <Zap className={cn("h-4 w-4", colors.icon)} />
        )}
        <span className={cn("text-sm font-medium", colors.text)}>
          {isUnlimited
            ? membershipType === "pro"
              ? KS_QUOTA.PRO_UNLIMITED
              : KS_QUOTA.ENTERPRISE_UNLIMITED
            : KS_QUOTA.REMAINING(remaining, limit)}
        </span>
      </div>
    );
  }

  // Bar 模式：完整进度条
  return (
    <div className={cn("space-y-2", className)}>
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isUnlimited ? (
            <Sparkles className="h-4 w-4 text-purple-500" />
          ) : alertLevel === "danger" ? (
            <AlertCircle className={cn("h-4 w-4", colors.icon)} />
          ) : (
            <Zap className={cn("h-4 w-4", colors.icon)} />
          )}
          <span className="text-sm font-medium text-gray-700">
            模板生成配额
          </span>
        </div>
        <span className={cn("text-sm font-medium", colors.text)}>
          {isUnlimited
            ? membershipType === "pro"
              ? KS_QUOTA.PRO_UNLIMITED
              : KS_QUOTA.ENTERPRISE_UNLIMITED
            : `${used} / ${limit}`}
        </span>
      </div>

      {/* 进度条 */}
      {!isUnlimited && (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              colors.bar,
            )}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}

      {/* 提示信息 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {isUnlimited
            ? "无限制使用"
            : alertLevel === "danger"
              ? KS_QUOTA.WARNING_95
              : alertLevel === "warning"
                ? KS_QUOTA.WARNING_80
                : `还可生成 ${remaining} 次`}
        </span>
        {resetAt && !isUnlimited && (
          <span>
            {KS_QUOTA.RESET_DATE(
              resetAt.toLocaleDateString("zh-CN", {
                month: "numeric",
                day: "numeric",
              }),
            )}
          </span>
        )}
      </div>
    </div>
  );
}
