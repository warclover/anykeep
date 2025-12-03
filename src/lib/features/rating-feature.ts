/**
 * 评级功能特性控制
 * V6.0 付费功能：评级、锁定、删除标记
 */

import type { MembershipType } from "@/types/supabase";

/**
 * 评级功能权限配置
 */
export const RATING_FEATURE_CONFIG = {
  // 允许使用评级功能的会员等级（PRO = 付费会员）
  allowedTiers: ["PRO"] as const satisfies readonly MembershipType[],

  // 功能标识
  featureKey: "bookmark_rating" as const,

  // 免费用户限制
  freeTierLimits: {
    canView: true, // 可以看到评级显示
    canEdit: false, // 不能编辑评级
    maxRatings: 0, // 允许评级的收藏数量
  },

  // 付费用户权益
  premiumBenefits: {
    canView: true,
    canEdit: true,
    maxRatings: Infinity,
  },
} as const;

/**
 * 检查用户是否有评级功能权限
 */
export function hasRatingFeature(
  membershipType?: MembershipType | null,
): boolean {
  if (!membershipType) return false;
  return (
    RATING_FEATURE_CONFIG.allowedTiers as readonly MembershipType[]
  ).includes(membershipType);
}

/**
 * 获取用户评级功能权限详情
 */
export function getRatingPermissions(membershipType?: MembershipType | null) {
  const hasPremium = hasRatingFeature(membershipType);

  return {
    canView: RATING_FEATURE_CONFIG.freeTierLimits.canView, // 所有用户可见
    canEdit: hasPremium,
    canLock: hasPremium,
    canMark: hasPremium,
    maxRatings: hasPremium
      ? RATING_FEATURE_CONFIG.premiumBenefits.maxRatings
      : RATING_FEATURE_CONFIG.freeTierLimits.maxRatings,
  };
}

/**
 * 评级功能升级提示文案
 */
export const RATING_UPGRADE_MESSAGES = {
  title: "解锁评级功能",
  description: "升级到高级会员，使用收藏评级、锁定保护、删除标记等功能",
  benefits: [
    "⭐ 0-5星评级：快速标记重要收藏",
    "🔒 锁定保护：防止误删重要内容",
    "🗑️ 删除标记：批量清理待处理收藏",
    "📊 评级筛选：按星级快速查找",
  ],
  cta: "立即升级",
  learnMore: "了解高级会员",
} as const;

/**
 * 降级处理策略
 */
export const RATING_DOWNGRADE_POLICY = {
  // 数据保留策略
  dataRetention: {
    keepData: true, // 保留评级数据
    keepDuration: Infinity, // 永久保留
    showInUI: true, // 降级后仍显示（只读）
  },

  // 功能降级行为
  downgradeBehavior: {
    convertToReadOnly: true, // 转为只读模式
    showUpgradePrompt: true, // 显示升级提示
    allowViewHistory: true, // 允许查看历史评级
  },
} as const;
