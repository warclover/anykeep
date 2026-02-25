/**
 * MD 收藏功能 - 功能门控
 * P2-007: Markdown 内容收藏
 *
 * v2.2 校准：与现有 profiles.membership_type 字段对齐
 */

import type { FeatureGateResult } from "../types";

/**
 * 现有系统会员类型（来自 profiles 表）
 */
type MembershipType = "FREE" | "PRO";

/**
 * 功能配置
 */
interface FeatureConfig {
  enabled: boolean;
  limit: number; // -1 表示无限制
}

/**
 * MD 收藏功能配置
 * - FREE: 可用（限制 50 条）
 * - PRO: 无限制
 */
const FEATURE_CONFIG: Record<MembershipType, FeatureConfig> = {
  FREE: { enabled: true, limit: 50 },
  PRO: { enabled: true, limit: -1 },
};

/**
 * 检查 MD 功能是否对该会员等级启用
 * @param membership 会员类型
 * @returns 是否启用
 */
export function isMdFeatureEnabled(membership: string): boolean {
  const key = membership.toUpperCase() as MembershipType;
  return FEATURE_CONFIG[key]?.enabled ?? false;
}

/**
 * 获取 MD 收藏数量限制
 * @param membership 会员类型
 * @returns 数量限制（-1 表示无限制）
 */
export function getMdFeatureLimit(membership: string): number {
  const key = membership.toUpperCase() as MembershipType;
  return FEATURE_CONFIG[key]?.limit ?? 0;
}

/**
 * 检查是否可以创建新的 MD 收藏
 * @param membership 会员类型
 * @param currentCount 当前收藏数量
 * @returns 检查结果
 */
export function canCreateMdCollection(
  membership: string,
  currentCount: number,
): FeatureGateResult {
  if (!isMdFeatureEnabled(membership)) {
    return {
      allowed: false,
      reason: "此功能需要升级到 Pro 版本",
    };
  }

  const limit = getMdFeatureLimit(membership);
  if (limit !== -1 && currentCount >= limit) {
    return {
      allowed: false,
      reason: `已达到 ${limit} 条限制`,
    };
  }

  return { allowed: true };
}

/**
 * 获取功能不可用时的提示信息
 * @param membership 会员类型
 * @returns 提示信息
 */
export function getFeatureUnavailableMessage(membership: string): string {
  if (!isMdFeatureEnabled(membership)) {
    return "MD 收藏是 Pro 专属功能，升级后即可使用";
  }
  return "";
}

/**
 * 检查是否需要显示升级提示
 * @param membership 会员类型
 * @returns 是否需要显示
 */
export function shouldShowUpgradePrompt(membership: string): boolean {
  return !isMdFeatureEnabled(membership);
}
