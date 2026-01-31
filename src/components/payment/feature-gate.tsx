/**
 * FeatureGate - 功能门控组件
 * 根据用户套餐控制功能访问
 */

"use client";

import type { ReactNode } from "react";
import { useFeatureGate } from "@/lib/payment/hooks/use-feature-gate";
import { type FeatureKey } from "@/lib/payment/feature-gates";
import { UpgradePrompt } from "./upgrade-prompt";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGateProps {
  /** 要检查的功能 Key */
  feature: FeatureKey;
  /** 有权限时显示的内容 */
  children: ReactNode;
  /** 自定义无权限时的 UI */
  fallback?: ReactNode;
  /** 静默模式：无权限时直接隐藏，不显示升级提示 */
  silent?: boolean;
  /** 升级提示变体 */
  promptVariant?: "card" | "inline";
  /** 加载中显示骨架屏 */
  showSkeleton?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  silent = false,
  promptVariant = "card",
  showSkeleton = false,
}: FeatureGateProps) {
  const { allowed, requiredPlan, isLoading } = useFeatureGate(feature);

  // 加载中
  if (isLoading && showSkeleton) {
    return <Skeleton className="h-32 w-full" />;
  }

  // 有权限
  if (allowed) {
    return <>{children}</>;
  }

  // 静默模式：直接隐藏
  if (silent) {
    return null;
  }

  // 自定义 fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // 默认升级提示
  return (
    <UpgradePrompt
      feature={feature}
      requiredPlan={requiredPlan}
      variant={promptVariant}
    />
  );
}

/**
 * 条件渲染 Hook 版本
 * 用于需要在逻辑中判断的场景
 */
export function useCanAccessFeature(feature: FeatureKey): boolean {
  const { allowed } = useFeatureGate(feature);
  return allowed;
}
