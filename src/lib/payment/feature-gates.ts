/**
 * Feature Gates - 功能门控配置
 * 控制不同套餐等级的功能访问权限
 */

import type { PlanTier } from "./types";

// ============================================
// 功能开关配置（布尔型 + 数值型统一处理）
// ============================================

export const FEATURE_GATES = {
  // ============================================
  // 布尔型功能开关
  // ============================================

  // AI 高级功能
  synthesis: { free: false, pro: true, pro_plus: true, lifetime: true },
  "knowledge-studio": {
    free: false,
    pro: true,
    pro_plus: true,
    lifetime: true,
  },
  "knowledge-studio-advanced": {
    free: false,
    pro: false,
    pro_plus: true,
    lifetime: false,
  },
  "brain-sync": { free: false, pro: true, pro_plus: true, lifetime: true },
  librarian: { free: false, pro: true, pro_plus: true, lifetime: true },

  // TTS 语音
  tts: { free: false, pro: true, pro_plus: true, lifetime: true },
  "audio-library": { free: false, pro: true, pro_plus: true, lifetime: true },

  // 数据分析
  "advanced-analytics": {
    free: false,
    pro: true,
    pro_plus: true,
    lifetime: true,
  },
  "link-monitor-auto": {
    free: false,
    pro: true,
    pro_plus: true,
    lifetime: true,
  },

  // 导出功能
  "export-csv": { free: false, pro: true, pro_plus: true, lifetime: true },
  "export-markdown": { free: false, pro: true, pro_plus: true, lifetime: true },
  "export-all-formats": {
    free: false,
    pro: false,
    pro_plus: true,
    lifetime: true,
  },

  // ============================================
  // 数值型配额限制
  // ============================================

  // 收藏数量
  "bookmarks-limit": {
    free: 500,
    pro: 5000,
    pro_plus: Infinity,
    lifetime: Infinity,
  },

  // AI 调用配额
  "ai-calls-monthly": { free: 20, pro: 500, pro_plus: 3000, lifetime: 500 },
  "ai-calls-daily-limit": { free: 50, pro: 100, pro_plus: 200, lifetime: 100 },

  // TTS 配额（小时）
  "tts-hours-monthly": { free: 0, pro: 10, pro_plus: 50, lifetime: 10 },

  // 批量操作
  "batch-limit": { free: 20, pro: 200, pro_plus: Infinity, lifetime: 200 },

  // 快照
  "snapshot-limit": {
    free: 3,
    pro: 20,
    pro_plus: Infinity,
    lifetime: Infinity,
  },

  // 智能列表
  "smart-list-limit": { free: 1, pro: 10, pro_plus: Infinity, lifetime: 10 },

  // Skills 数量
  "skills-available": { free: 5, pro: 20, pro_plus: 30, lifetime: 20 },

  // 回收站保留天数
  "trash-retention-days": { free: 7, pro: 30, pro_plus: 90, lifetime: 30 },

  // 活动历史保留天数
  "activity-history-days": {
    free: 30,
    pro: 180,
    pro_plus: Infinity,
    lifetime: 180,
  },

  // 存储空间 (MB)
  "storage-mb": { free: 100, pro: 5120, pro_plus: 20480, lifetime: 20480 },

  // 主题合成次数/月
  "synthesis-monthly": { free: 0, pro: 10, pro_plus: Infinity, lifetime: 10 },
} as const;

export type FeatureKey = keyof typeof FEATURE_GATES;

// ============================================
// 功能分类
// ============================================

export const FEATURE_CATEGORIES = {
  ai: [
    "synthesis",
    "knowledge-studio",
    "knowledge-studio-advanced",
    "brain-sync",
    "librarian",
    "ai-calls-monthly",
    "ai-calls-daily-limit",
    "synthesis-monthly",
  ],
  tts: ["tts", "audio-library", "tts-hours-monthly"],
  analytics: [
    "advanced-analytics",
    "link-monitor-auto",
    "activity-history-days",
  ],
  storage: ["storage-mb", "snapshot-limit", "bookmarks-limit"],
  tools: ["batch-limit", "smart-list-limit", "trash-retention-days"],
  export: ["export-csv", "export-markdown", "export-all-formats"],
  skills: ["skills-available"],
} as const;

// ============================================
// 辅助函数
// ============================================

/**
 * 检查功能是否为布尔型开关
 */
export function isBooleanGate(feature: FeatureKey): boolean {
  const value = FEATURE_GATES[feature].free;
  return typeof value === "boolean";
}

/**
 * 获取功能在指定套餐下的值
 */
export function getFeatureValue(
  feature: FeatureKey,
  tier: PlanTier,
): boolean | number {
  return FEATURE_GATES[feature][tier];
}

/**
 * 检查用户是否有权访问某功能
 */
export function hasFeatureAccess(feature: FeatureKey, tier: PlanTier): boolean {
  const value = FEATURE_GATES[feature][tier];
  if (typeof value === "boolean") {
    return value;
  }
  // 数值型：大于 0 即有访问权限
  return value > 0;
}

/**
 * 获取功能的配额限制
 */
export function getFeatureLimit(feature: FeatureKey, tier: PlanTier): number {
  const value = FEATURE_GATES[feature][tier];
  if (typeof value === "boolean") {
    return value ? Infinity : 0;
  }
  return value;
}

/**
 * 获取解锁某功能所需的最低套餐
 */
export function getRequiredPlan(feature: FeatureKey): PlanTier {
  const config = FEATURE_GATES[feature];
  const tiers: PlanTier[] = ["free", "pro", "pro_plus", "lifetime"];

  for (const tier of tiers) {
    const value = config[tier];
    if (typeof value === "boolean" && value) {
      return tier;
    }
    if (typeof value === "number" && value > 0) {
      return tier;
    }
  }

  return "pro"; // 默认需要 Pro
}

/**
 * 获取套餐升级后的功能提升列表
 */
export function getUpgradeFeatures(
  fromTier: PlanTier,
  toTier: PlanTier,
): FeatureKey[] {
  const upgrades: FeatureKey[] = [];

  for (const [feature, config] of Object.entries(FEATURE_GATES)) {
    const fromValue = config[fromTier as keyof typeof config];
    const toValue = config[toTier as keyof typeof config];

    if (typeof fromValue === "boolean" && typeof toValue === "boolean") {
      if (!fromValue && toValue) {
        upgrades.push(feature as FeatureKey);
      }
    } else if (typeof fromValue === "number" && typeof toValue === "number") {
      if (toValue > fromValue) {
        upgrades.push(feature as FeatureKey);
      }
    }
  }

  return upgrades;
}

// ============================================
// 功能展示名称（用于 UI）
// ============================================

export const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
  synthesis: "主题合成器",
  "knowledge-studio": "知识工作室",
  "knowledge-studio-advanced": "知识工作室高级版",
  "brain-sync": "Brain-Sync 复习",
  librarian: "智能管理员",
  tts: "TTS 语音朗读",
  "audio-library": "音频库",
  "advanced-analytics": "高级数据分析",
  "link-monitor-auto": "自动链接监控",
  "export-csv": "CSV 导出",
  "export-markdown": "Markdown 导出",
  "export-all-formats": "全格式导出",
  "bookmarks-limit": "��藏数量",
  "ai-calls-monthly": "AI 月配额",
  "ai-calls-daily-limit": "AI 日配额",
  "tts-hours-monthly": "TTS 月时长",
  "batch-limit": "批量操作数量",
  "snapshot-limit": "快照数量",
  "smart-list-limit": "智能列表数量",
  "skills-available": "AI Skills 数量",
  "trash-retention-days": "回收站保留",
  "activity-history-days": "活动历史",
  "storage-mb": "存储空间",
  "synthesis-monthly": "主题合成次数",
};

// ============================================
// 功能单位（用于显示）
// ============================================

export const FEATURE_UNITS: Partial<Record<FeatureKey, string>> = {
  "bookmarks-limit": "条",
  "ai-calls-monthly": "次/月",
  "ai-calls-daily-limit": "次/日",
  "tts-hours-monthly": "小时/月",
  "batch-limit": "条/次",
  "snapshot-limit": "个",
  "smart-list-limit": "个",
  "skills-available": "个",
  "trash-retention-days": "天",
  "activity-history-days": "天",
  "storage-mb": "MB",
  "synthesis-monthly": "次/月",
};
