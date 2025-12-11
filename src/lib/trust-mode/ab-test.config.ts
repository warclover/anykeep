/**
 * Trust Mode A/B Test Configuration
 * V4.2 托管模式 A/B 测试配置
 *
 * @description 支持灰度发布和实验性功能测试
 * - 用户分组
 * - 实验变体管理
 * - 流量分配
 * - 结果追踪
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { TrustMode } from "@/types/trust-mode";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 实验状态
 */
export type ExperimentStatus = "draft" | "running" | "paused" | "completed";

/**
 * 实验变体
 */
export interface ExperimentVariant {
  /** 变体 ID */
  id: string;
  /** 变体名称 */
  name: string;
  /** 变体描述 */
  description: string;
  /** 流量分配比例 (0-100) */
  trafficPercentage: number;
  /** 变体特定配置 */
  config: ExperimentVariantConfig;
}

/**
 * 变体配置
 */
export interface ExperimentVariantConfig {
  /** 默认托管模式 */
  defaultTrustMode?: TrustMode;
  /** 置信度阈值调整 */
  confidenceThresholdAdjustment?: {
    high?: number;
    medium?: number;
    low?: number;
  };
  /** 是否启用新功能 */
  enableFeatures?: {
    /** 启用智能提示 */
    smartPrompts?: boolean;
    /** 启用批量操作优化 */
    batchOptimization?: boolean;
    /** 启用实时学习 */
    realtimeLearning?: boolean;
  };
  /** UI 变体 */
  uiVariant?: "default" | "simplified" | "detailed";
}

/**
 * 实验配置
 */
export interface Experiment {
  /** 实验 ID */
  id: string;
  /** 实验名称 */
  name: string;
  /** 实验描述 */
  description: string;
  /** 实验状态 */
  status: ExperimentStatus;
  /** 开始时间 */
  startDate?: string;
  /** 结束时间 */
  endDate?: string;
  /** 目标用户群体 */
  targetAudience: TargetAudience;
  /** 实验变体 */
  variants: ExperimentVariant[];
  /** 主要指标 */
  primaryMetrics: ExperimentMetric[];
  /** 次要指标 */
  secondaryMetrics?: ExperimentMetric[];
}

/**
 * 目标用户群体
 */
export interface TargetAudience {
  /** 用户类型过滤 */
  userTypes?: ("new" | "existing" | "power")[];
  /** 最小书签数量 */
  minBookmarkCount?: number;
  /** 最大书签数量 */
  maxBookmarkCount?: number;
  /** 用户 ID 白名单 */
  whitelistUserIds?: string[];
  /** 用户 ID 黑名单 */
  blacklistUserIds?: string[];
  /** 注册天数 */
  minRegistrationDays?: number;
}

/**
 * 实验指标
 */
export interface ExperimentMetric {
  /** 指标 ID */
  id: string;
  /** 指标名称 */
  name: string;
  /** 指标类型 */
  type: "conversion" | "engagement" | "quality" | "satisfaction";
  /** 指标描述 */
  description: string;
  /** 目标方向 */
  goal: "increase" | "decrease" | "neutral";
}

/**
 * 用户实验分配
 */
export interface UserExperimentAssignment {
  /** 用户 ID */
  userId: string;
  /** 实验 ID */
  experimentId: string;
  /** 分配的变体 ID */
  variantId: string;
  /** 分配时间 */
  assignedAt: string;
  /** 是否强制分配 */
  forced: boolean;
}

// ============================================================================
// 实验定义
// ============================================================================

/**
 * 托管模式默认值实验
 * 测试不同默认模式对用户留存的影响
 */
export const DEFAULT_MODE_EXPERIMENT: Experiment = {
  id: "trust-mode-default-v1",
  name: "托管模式默认值测试",
  description: "测试不同默认托管模式对新用户分类行为和留存的影响",
  status: "draft",
  targetAudience: {
    userTypes: ["new"],
    minRegistrationDays: 0,
  },
  variants: [
    {
      id: "control",
      name: "对照组 (Full Auto)",
      description: "默认完全托管模式",
      trafficPercentage: 50,
      config: {
        defaultTrustMode: "full_auto",
      },
    },
    {
      id: "treatment-semi",
      name: "实验组 (Semi Auto)",
      description: "默认半托管模式",
      trafficPercentage: 50,
      config: {
        defaultTrustMode: "semi_auto",
      },
    },
  ],
  primaryMetrics: [
    {
      id: "user-retention-7d",
      name: "7日留存率",
      type: "engagement",
      description: "注册后7天内活跃的用户比例",
      goal: "increase",
    },
    {
      id: "classification-acceptance",
      name: "分类接受率",
      type: "quality",
      description: "AI分类被用户接受的比例",
      goal: "increase",
    },
  ],
  secondaryMetrics: [
    {
      id: "manual-moves",
      name: "手动移动次数",
      type: "engagement",
      description: "用户手动移动书签的平均次数",
      goal: "decrease",
    },
    {
      id: "time-to-organize",
      name: "组织耗时",
      type: "engagement",
      description: "用户完成首次整理的平均时间",
      goal: "decrease",
    },
  ],
};

/**
 * 置信度阈值实验
 * 测试不同阈值对分类准确性的影响
 */
export const CONFIDENCE_THRESHOLD_EXPERIMENT: Experiment = {
  id: "confidence-threshold-v1",
  name: "置信度阈值优化测试",
  description: "测试不同置信度阈值对分类质量和用户满意度的影响",
  status: "draft",
  targetAudience: {
    userTypes: ["existing", "power"],
    minBookmarkCount: 50,
  },
  variants: [
    {
      id: "control",
      name: "对照组 (当前阈值)",
      description: "使用当前阈值配置 (80/60/40)",
      trafficPercentage: 34,
      config: {
        confidenceThresholdAdjustment: {
          high: 80,
          medium: 60,
          low: 40,
        },
      },
    },
    {
      id: "treatment-strict",
      name: "实验组 (严格阈值)",
      description: "提高阈值要求 (85/70/50)",
      trafficPercentage: 33,
      config: {
        confidenceThresholdAdjustment: {
          high: 85,
          medium: 70,
          low: 50,
        },
      },
    },
    {
      id: "treatment-lenient",
      name: "实验组 (宽松阈值)",
      description: "降低阈值要求 (75/55/35)",
      trafficPercentage: 33,
      config: {
        confidenceThresholdAdjustment: {
          high: 75,
          medium: 55,
          low: 35,
        },
      },
    },
  ],
  primaryMetrics: [
    {
      id: "correction-rate",
      name: "用户纠正率",
      type: "quality",
      description: "用户纠正AI分类的比例",
      goal: "decrease",
    },
  ],
};

/**
 * UI 简化实验
 * 测试简化UI对用户体验的影响
 */
export const UI_SIMPLIFICATION_EXPERIMENT: Experiment = {
  id: "ui-simplification-v1",
  name: "托管设置UI简化测试",
  description: "测试简化的托管设置界面对用户理解和使用的影响",
  status: "draft",
  targetAudience: {
    userTypes: ["new", "existing"],
  },
  variants: [
    {
      id: "control",
      name: "对照组 (完整UI)",
      description: "显示所有设置选项",
      trafficPercentage: 50,
      config: {
        uiVariant: "detailed",
      },
    },
    {
      id: "treatment-simple",
      name: "实验组 (简化UI)",
      description: "仅显示核心选项",
      trafficPercentage: 50,
      config: {
        uiVariant: "simplified",
      },
    },
  ],
  primaryMetrics: [
    {
      id: "setting-completion",
      name: "设置完成率",
      type: "conversion",
      description: "完成托管模式设置的用户比例",
      goal: "increase",
    },
  ],
};

// ============================================================================
// 活跃实验列表
// ============================================================================

/**
 * 所有已定义的实验
 */
export const ALL_EXPERIMENTS: Record<string, Experiment> = {
  [DEFAULT_MODE_EXPERIMENT.id]: DEFAULT_MODE_EXPERIMENT,
  [CONFIDENCE_THRESHOLD_EXPERIMENT.id]: CONFIDENCE_THRESHOLD_EXPERIMENT,
  [UI_SIMPLIFICATION_EXPERIMENT.id]: UI_SIMPLIFICATION_EXPERIMENT,
};

/**
 * 获取活跃实验
 */
export function getActiveExperiments(): Experiment[] {
  return Object.values(ALL_EXPERIMENTS).filter(
    (exp) => exp.status === "running"
  );
}

/**
 * 根据 ID 获取实验
 */
export function getExperimentById(id: string): Experiment | undefined {
  return ALL_EXPERIMENTS[id];
}

// ============================================================================
// 用户分组逻辑
// ============================================================================

/**
 * 计算用户应该分配到哪个变体
 * 使用确定性哈希确保同一用户始终分配到同一变体
 */
export function assignUserToVariant(
  userId: string,
  experiment: Experiment
): ExperimentVariant | null {
  // 检查实验是否正在运行
  if (experiment.status !== "running") {
    return null;
  }

  // 计算用户哈希值
  const hash = simpleHash(`${userId}-${experiment.id}`);
  const bucket = hash % 100;

  // 按流量分配比例分配变体
  let cumulativePercentage = 0;
  for (const variant of experiment.variants) {
    cumulativePercentage += variant.trafficPercentage;
    if (bucket < cumulativePercentage) {
      return variant;
    }
  }

  // 默认返回第一个变体
  return experiment.variants[0] || null;
}

/**
 * 检查用户是否符合目标受众条件
 */
export function isUserInTargetAudience(
  userId: string,
  audience: TargetAudience,
  userContext?: {
    registrationDays?: number;
    bookmarkCount?: number;
    userType?: "new" | "existing" | "power";
  }
): boolean {
  // 检查黑名单
  if (audience.blacklistUserIds?.includes(userId)) {
    return false;
  }

  // 检查白名单（如果有白名单，只允许白名单用户）
  if (audience.whitelistUserIds && audience.whitelistUserIds.length > 0) {
    return audience.whitelistUserIds.includes(userId);
  }

  // 检查用户类型
  if (audience.userTypes && userContext?.userType) {
    if (!audience.userTypes.includes(userContext.userType)) {
      return false;
    }
  }

  // 检查注册天数
  if (
    audience.minRegistrationDays !== undefined &&
    userContext?.registrationDays !== undefined
  ) {
    if (userContext.registrationDays < audience.minRegistrationDays) {
      return false;
    }
  }

  // 检查书签数量
  if (audience.minBookmarkCount !== undefined && userContext?.bookmarkCount !== undefined) {
    if (userContext.bookmarkCount < audience.minBookmarkCount) {
      return false;
    }
  }

  if (audience.maxBookmarkCount !== undefined && userContext?.bookmarkCount !== undefined) {
    if (userContext.bookmarkCount > audience.maxBookmarkCount) {
      return false;
    }
  }

  return true;
}

/**
 * 简单哈希函数（用于确定性用户分组）
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash);
}

// ============================================================================
// 环境变量控制
// ============================================================================

/**
 * A/B 测试功能开关
 */
export const AB_TEST_CONFIG = {
  /** 是否启用 A/B 测试 */
  enabled: process.env.NEXT_PUBLIC_AB_TEST_ENABLED === "true",
  /** 调试模式（会在控制台输出分组信息） */
  debug: process.env.NODE_ENV === "development",
  /** 强制指定变体（用于测试） */
  forceVariant: process.env.NEXT_PUBLIC_AB_TEST_FORCE_VARIANT,
};

/**
 * 检查是否应该启用 A/B 测试
 */
export function isAbTestEnabled(): boolean {
  return AB_TEST_CONFIG.enabled;
}

/**
 * 获取用户的所有实验分配
 */
export function getUserExperimentAssignments(
  userId: string,
  userContext?: {
    registrationDays?: number;
    bookmarkCount?: number;
    userType?: "new" | "existing" | "power";
  }
): UserExperimentAssignment[] {
  if (!isAbTestEnabled()) {
    return [];
  }

  const assignments: UserExperimentAssignment[] = [];

  for (const experiment of getActiveExperiments()) {
    // 检查用户是否在目标受众中
    if (!isUserInTargetAudience(userId, experiment.targetAudience, userContext)) {
      continue;
    }

    // 分配变体
    const variant = assignUserToVariant(userId, experiment);
    if (variant) {
      assignments.push({
        userId,
        experimentId: experiment.id,
        variantId: variant.id,
        assignedAt: new Date().toISOString(),
        forced: false,
      });
    }
  }

  return assignments;
}
