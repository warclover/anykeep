/**
 * BlueprintQuotaWarning - 配额警告提示
 * @module components/knowledge-studio/quota
 *
 * Story 8.3 实现：
 * - 内联显示配额警告
 * - 显示蓝图消耗点数
 * - 可嵌入蓝图选择器
 */

"use client";

import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { KS_QUOTA } from "@/lib/constants/messages";

// ============================================================================
// Types
// ============================================================================

export interface BlueprintQuotaWarningProps {
  /** 剩余配额 */
  remaining: number;
  /** 总配额限制 */
  limit: number;
  /** 蓝图消耗点数 */
  creditsCost: number;
  /** 会员类型 */
  membershipType?: "free" | "pro" | "enterprise";
  /** 变体样式 */
  variant?: "inline" | "banner";
  /** 自定义类名 */
  className?: string;
  /** 点击升级回调 */
  onUpgrade?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function BlueprintQuotaWarning({
  remaining,
  limit,
  creditsCost,
  membershipType = "free",
  variant = "inline",
  className,
  onUpgrade,
}: BlueprintQuotaWarningProps) {
  // 无限配额不显示警告
  if (limit === -1) return null;

  // 计算状态
  const isExhausted = remaining <= 0;
  const isInsufficient = remaining < creditsCost;
  const isWarning = remaining <= 3 && remaining >= creditsCost;

  // 不需要警告
  if (!isExhausted && !isInsufficient && !isWarning) return null;

  // 内联样式
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
          isExhausted || isInsufficient
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700",
          className,
        )}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>
          {isExhausted
            ? KS_QUOTA.FREE_TRIAL_EXHAUSTED
            : isInsufficient
              ? KS_QUOTA.WARNING_MESSAGE(remaining, creditsCost)
              : `剩余 ${remaining} 点配额`}
        </span>
        {onUpgrade && (isExhausted || isInsufficient) && (
          <button
            onClick={onUpgrade}
            className="ml-auto font-medium underline hover:no-underline"
          >
            {KS_QUOTA.UPGRADE}
          </button>
        )}
      </div>
    );
  }

  // Banner 样式
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        isExhausted || isInsufficient
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isExhausted || isInsufficient ? "bg-red-100" : "bg-amber-100",
        )}
      >
        <AlertCircle
          className={cn(
            "h-4 w-4",
            isExhausted || isInsufficient ? "text-red-600" : "text-amber-600",
          )}
        />
      </div>
      <div className="flex-1 space-y-1">
        <p
          className={cn(
            "font-medium",
            isExhausted || isInsufficient ? "text-red-800" : "text-amber-800",
          )}
        >
          {isExhausted
            ? KS_QUOTA.EXHAUSTED_TITLE
            : isInsufficient
              ? KS_QUOTA.WARNING_TITLE
              : KS_QUOTA.WARNING_80}
        </p>
        <p
          className={cn(
            "text-sm",
            isExhausted || isInsufficient ? "text-red-700" : "text-amber-700",
          )}
        >
          {isExhausted
            ? KS_QUOTA.EXHAUSTED_MESSAGE
            : isInsufficient
              ? KS_QUOTA.WARNING_MESSAGE(remaining, creditsCost)
              : `本月剩余 ${remaining} 点配额，该模板需要 ${creditsCost} 点`}
        </p>
        {membershipType === "free" && (
          <p className="text-xs text-gray-500">{KS_QUOTA.FREE_TRIAL_RESET}</p>
        )}
      </div>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className={cn(
            "flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            isExhausted || isInsufficient
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-amber-600 text-white hover:bg-amber-700",
          )}
        >
          {KS_QUOTA.UPGRADE_PRO}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Sub-component: Credit Cost Badge
// ============================================================================

export interface CreditCostBadgeProps {
  /** 消耗点数 */
  cost: number;
  /** 大小 */
  size?: "sm" | "md";
  /** 自定义类名 */
  className?: string;
}

export function CreditCostBadge({
  cost,
  size = "sm",
  className,
}: CreditCostBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gray-100 font-medium text-gray-600",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
    >
      <Info className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {KS_QUOTA.CREDITS_COST(cost)}
    </span>
  );
}
