/**
 * useFeatureGate Hook - 功能门控检查
 * 检查用户是否有权访问某功能
 */

"use client";

import { useMemo } from "react";
import { useEntitlement } from "./use-entitlement";
import {
  FEATURE_GATES,
  type FeatureKey,
  getRequiredPlan,
  isBooleanGate,
} from "../feature-gates";
import type { PlanTier } from "../types";

interface FeatureGateResult {
  /** 是否允许使用该功能 */
  allowed: boolean;
  /** 数值限制（如果是配额型功能） */
  limit: number | undefined;
  /** 当前套餐等级 */
  planTier: PlanTier;
  /** 需要的最低套餐（用于升级提示） */
  requiredPlan: PlanTier;
  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * 检查单个功能的访问权限
 */
export function useFeatureGate(feature: FeatureKey): FeatureGateResult {
  const { planTier, isLoading } = useEntitlement();

  return useMemo(() => {
    const config = FEATURE_GATES[feature];
    const value = config[planTier];
    const isBoolean = isBooleanGate(feature);
    const requiredPlan = getRequiredPlan(feature);

    if (isBoolean) {
      return {
        allowed: value as boolean,
        limit: undefined,
        planTier,
        requiredPlan,
        isLoading,
      };
    }

    // 数值型：大于 0 即允许
    const numValue = value as number;
    return {
      allowed: numValue > 0,
      limit: numValue === Infinity ? undefined : numValue,
      planTier,
      requiredPlan,
      isLoading,
    };
  }, [feature, planTier, isLoading]);
}

/**
 * 批量检查多个功能
 */
export function useFeatureGates(
  features: FeatureKey[],
): Record<FeatureKey, FeatureGateResult> {
  const { planTier, isLoading } = useEntitlement();

  return useMemo(() => {
    const results: Partial<Record<FeatureKey, FeatureGateResult>> = {};

    for (const feature of features) {
      const config = FEATURE_GATES[feature];
      const value = config[planTier];
      const isBoolean = isBooleanGate(feature);
      const requiredPlan = getRequiredPlan(feature);

      if (isBoolean) {
        results[feature] = {
          allowed: value as boolean,
          limit: undefined,
          planTier,
          requiredPlan,
          isLoading,
        };
      } else {
        const numValue = value as number;
        results[feature] = {
          allowed: numValue > 0,
          limit: numValue === Infinity ? undefined : numValue,
          planTier,
          requiredPlan,
          isLoading,
        };
      }
    }

    return results as Record<FeatureKey, FeatureGateResult>;
  }, [features, planTier, isLoading]);
}

/**
 * 检查功能是否被锁定（需要升级）
 */
export function useIsFeatureLocked(feature: FeatureKey): boolean {
  const { allowed } = useFeatureGate(feature);
  return !allowed;
}

/**
 * 获取功能的数值限制
 */
export function useFeatureLimit(feature: FeatureKey): number | null {
  const { limit } = useFeatureGate(feature);
  return limit ?? null;
}
