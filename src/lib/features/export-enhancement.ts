/**
 * 导出增强功能特性控制
 * V2.1: 独立页面 + 多入口复用
 */

import type { MembershipType } from "@/types/supabase";

/**
 * 导出增强功能配置
 */
export const EXPORT_ENHANCEMENT_CONFIG = {
  // 功能开关
  enabled: true,

  // 功能标识
  featureKey: "export_enhancement" as const,

  // 允许使用的会员等级（所有用户都可以使用基础导出）
  allowedTiers: ["free", "pro"] as const satisfies readonly MembershipType[],

  // 免费用户限制
  freeTierLimits: {
    // 可用格式
    availableFormats: ["csv", "markdown", "json"] as const,
    // 单次导出上限
    maxExportCount: 1000,
    // 是否支持 Obsidian 格式
    obsidianSupport: false,
    // 是否支持字段选择
    fieldSelection: false,
    // 是否支持导出预览
    exportPreview: true,
  },

  // 付费用户权益
  premiumBenefits: {
    // 可用格式（全部）
    availableFormats: [
      "csv",
      "markdown",
      "obsidian",
      "obsidian-zip",
      "json",
      "html",
    ] as const,
    // 单次导出上限
    maxExportCount: Infinity,
    // 是否支持 Obsidian 格式
    obsidianSupport: true,
    // 是否支持字段选择
    fieldSelection: true,
    // 是否支持导出预览
    exportPreview: true,
  },
} as const;

/**
 * 检查用户是否有导出增强功能权限
 */
export function hasExportEnhancement(
  membershipType?: MembershipType | null,
): boolean {
  if (!EXPORT_ENHANCEMENT_CONFIG.enabled) return false;
  if (!membershipType) return true; // 免费用户也可以使用基础功能
  return (
    EXPORT_ENHANCEMENT_CONFIG.allowedTiers as readonly MembershipType[]
  ).includes(membershipType);
}

/**
 * 检查是否是付费用户
 */
export function isPremiumUser(membershipType?: MembershipType | null): boolean {
  return membershipType === "pro";
}

/**
 * 获取用户导出功能权限详情
 */
export function getExportPermissions(membershipType?: MembershipType | null) {
  const hasPremium = isPremiumUser(membershipType);

  const limits = hasPremium
    ? EXPORT_ENHANCEMENT_CONFIG.premiumBenefits
    : EXPORT_ENHANCEMENT_CONFIG.freeTierLimits;

  return {
    // 功能是否可用
    isAvailable: EXPORT_ENHANCEMENT_CONFIG.enabled,
    // 是否付费用户
    isPremium: hasPremium,
    // 可用格式列表
    availableFormats: limits.availableFormats,
    // 单次导出上限
    maxExportCount: limits.maxExportCount,
    // Obsidian 支持
    obsidianSupport: limits.obsidianSupport,
    // 字段选择支持
    fieldSelection: limits.fieldSelection,
    // 导出预览支持
    exportPreview: limits.exportPreview,
  };
}

/**
 * 检查指定格式是否可用
 */
export function isFormatAvailable(
  format: string,
  membershipType?: MembershipType | null,
): boolean {
  const permissions = getExportPermissions(membershipType);
  return (permissions.availableFormats as readonly string[]).includes(format);
}

/**
 * 导出功能升级提示文案
 */
export const EXPORT_UPGRADE_MESSAGES = {
  title: "解锁高级导出功能",
  description: "升级到高级会员，使用更多导出格式和高级功能",
  benefits: [
    "📄 Obsidian 格式：支持 Frontmatter 元数据",
    "📦 ZIP 打包：每条书签独立文件",
    "⚙️ 字段选择：自定义 CSV 导出字段",
    "∞ 无限导出：不限制单次导出数量",
  ],
  cta: "立即升级",
  learnMore: "了解高级会员",
} as const;

/**
 * 格式限制提示
 */
export const FORMAT_RESTRICTION_MESSAGES: Record<string, string> = {
  obsidian: "Obsidian 格式仅对高级会员开放",
  "obsidian-zip": "Obsidian ZIP 导出仅对高级会员开放",
  html: "HTML 格式仅对高级会员开放",
};
