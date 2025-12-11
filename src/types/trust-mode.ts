/**
 * 托管模式类型定义
 * V4.2 智能分类系统核心配置
 *
 * @description 定义三种托管模式及其行为配置
 * - Full Auto: 完全托管，AI 全权决策，默认模式
 * - Semi Auto: 半托管，AI 做初步决策，重要事项征求用户意见
 * - Manual: 不托管，用户完全控制，AI 仅辅助
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 核心类型
// ============================================================================

/**
 * 托管模式枚举
 */
export type TrustMode = "full_auto" | "semi_auto" | "manual";

/**
 * 低置信度处理策略
 */
export type LowConfidenceAction =
  | "auto_inbox_then_cluster" // 自动放入待整理，后台聚类处理（Full Auto）
  | "pending_with_message" // 暂存 + 发消息确认（Semi Auto）
  | "direct_inbox"; // 直接放入待整理（Manual）

// ============================================================================
// 配置接口
// ============================================================================

/**
 * 分类行为配置
 */
export interface ClassificationConfig {
  /** 是否启用自动分类 */
  autoClassify: boolean;
  /** 是否需要用户确认（仅 Manual 模式为 true） */
  requireConfirmation: boolean;
  /** 低置信度处理策略 */
  lowConfidenceAction: LowConfidenceAction;
  /** 确认阈值：低于此置信度需要确认（仅 Semi Auto 使用） */
  confirmationThreshold?: number;
  /** 默认目标（仅 Manual 模式使用） */
  defaultDestination?: "inbox";
  /** 仅生成摘要，不分类（仅 Manual 模式使用） */
  aiSummaryOnly?: boolean;
}

/**
 * 文件夹管理配置
 */
export interface FolderManagementConfig {
  /** 是否自动创建文件夹 */
  autoCreate: boolean;
  /** 是否自动合并文件夹 */
  autoMerge: boolean;
  /** 是否自动拆分文件夹 */
  autoSplit: boolean;
  /** 是否自动重命名文件夹 */
  autoRename: boolean;
  /** 每日自动创建文件夹上限 */
  dailyCreateLimit?: number;
  /** 是否发送建议并等待确认（Semi Auto） */
  suggestAndWait?: boolean;
  /** 是否按需提供建议（Manual） */
  suggestOnDemand?: boolean;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 是否启用通知（Manual 模式为 false） */
  enabled?: boolean;
  /** 分类完成时是否通知 */
  onClassification?: boolean;
  /** 低置信度时是否通知（Semi Auto） */
  onLowConfidence?: boolean;
  /** 文件夹创建时是否通知 */
  onFolderCreate?: boolean;
  /** 文件夹建议时是否通知（Semi Auto） */
  onFolderSuggestion?: boolean;
  /** 重大重组时是否通知（Full Auto） */
  onMajorReorganization?: boolean;
}

/**
 * 学习配置
 */
export interface LearningConfig {
  /** 从手动移动中学习 */
  learnFromManualMoves: boolean;
  /** 从删除操作中学习 */
  learnFromDeletions: boolean;
  /** 主动询问反馈（Semi Auto） */
  askForFeedback?: boolean;
  /** 保留用户偏好（Manual 切换时使用） */
  preservePreferences?: boolean;
}

/**
 * 托管模式完整配置
 */
export interface TrustModeConfig {
  /** 模式类型 */
  mode: TrustMode;
  /** 分类配置 */
  classification: ClassificationConfig;
  /** 文件夹管理配置 */
  folderManagement: FolderManagementConfig;
  /** 通知配置 */
  notification: NotificationConfig;
  /** 学习配置 */
  learning: LearningConfig;
}

// ============================================================================
// 数据库模型
// ============================================================================

/**
 * 用户托管模式数据库记录
 */
export interface UserTrustModeRecord {
  id: number;
  user_id: string;
  /** 当前托管模式 */
  trust_mode: TrustMode;
  /** 细粒度开关覆盖（覆盖模式默认值） */
  overrides: Partial<TrustModeConfig>;
  /** 模式切换历史 */
  mode_history: ModeChangeRecord[];
  /** AI 自动决策次数 */
  auto_decisions_count: number;
  /** 用户纠正次数 */
  user_corrections_count: number;
  /** 待确认数量 */
  pending_confirmations_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 模式切换历史记录
 */
export interface ModeChangeRecord {
  /** 切换前的模式 */
  from: TrustMode;
  /** 切换后的模式 */
  to: TrustMode;
  /** 切换时间 */
  timestamp: string;
  /** 切换原因（可选） */
  reason?: string;
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 完全托管模式默认配置
 * @description 用户只管收藏，AI 全权负责整理
 */
export const FULL_AUTO_CONFIG: TrustModeConfig = {
  mode: "full_auto",

  classification: {
    autoClassify: true,
    requireConfirmation: false,
    lowConfidenceAction: "auto_inbox_then_cluster",
  },

  folderManagement: {
    autoCreate: true,
    autoMerge: true,
    autoSplit: true,
    autoRename: true,
    dailyCreateLimit: 6,
  },

  notification: {
    onClassification: false,
    onFolderCreate: false,
    onMajorReorganization: true, // 仅重大变更通知
  },

  learning: {
    learnFromManualMoves: true,
    learnFromDeletions: true,
    askForFeedback: false,
  },
};

/**
 * 半托管模式默认配置
 * @description AI 做初步决策，重要/不确定的事项征求用户意见
 */
export const SEMI_AUTO_CONFIG: TrustModeConfig = {
  mode: "semi_auto",

  classification: {
    autoClassify: true,
    requireConfirmation: false,
    lowConfidenceAction: "pending_with_message",
    confirmationThreshold: 60, // 低于 60% 置信度需确认
  },

  folderManagement: {
    autoCreate: false,
    autoMerge: false,
    autoSplit: false,
    autoRename: false,
    suggestAndWait: true, // 发送建议，等待用户确认
  },

  notification: {
    onClassification: false, // 高置信度不通知
    onLowConfidence: true, // 低置信度通知
    onFolderSuggestion: true, // 文件夹建议通知
  },

  learning: {
    learnFromManualMoves: true,
    learnFromDeletions: true,
    askForFeedback: true, // 主动询问反馈
  },
};

/**
 * 不托管模式默认配置
 * @description 用户完全控制，AI 仅作为辅助工具按需使用
 */
export const MANUAL_CONFIG: TrustModeConfig = {
  mode: "manual",

  classification: {
    autoClassify: false,
    requireConfirmation: false,
    lowConfidenceAction: "direct_inbox",
    defaultDestination: "inbox", // 默认进入待整理
    aiSummaryOnly: true, // 仅生成摘要
  },

  folderManagement: {
    autoCreate: false,
    autoMerge: false,
    autoSplit: false,
    autoRename: false,
    suggestOnDemand: true, // 用户请求时才提供建议
  },

  notification: {
    enabled: false,
  },

  learning: {
    learnFromManualMoves: false, // 不主动学习
    learnFromDeletions: false,
    preservePreferences: true, // 保留用户偏好以备切换模式
  },
};

/**
 * 托管模式配置映射
 */
export const TRUST_MODE_CONFIGS: Record<TrustMode, TrustModeConfig> = {
  full_auto: FULL_AUTO_CONFIG,
  semi_auto: SEMI_AUTO_CONFIG,
  manual: MANUAL_CONFIG,
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取托管模式配置（支持 overrides 覆盖）
 */
export function getTrustModeConfig(
  mode: TrustMode,
  overrides?: Partial<TrustModeConfig>,
): TrustModeConfig {
  const baseConfig = TRUST_MODE_CONFIGS[mode];

  if (!overrides) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    mode: baseConfig.mode, // mode 不可被覆盖
    classification: {
      ...baseConfig.classification,
      ...(overrides.classification || {}),
    },
    folderManagement: {
      ...baseConfig.folderManagement,
      ...(overrides.folderManagement || {}),
    },
    notification: {
      ...baseConfig.notification,
      ...(overrides.notification || {}),
    },
    learning: {
      ...baseConfig.learning,
      ...(overrides.learning || {}),
    },
  };
}

/**
 * 托管模式显示信息
 */
export const TRUST_MODE_INFO: Record<
  TrustMode,
  { label: string; description: string; icon: string }
> = {
  full_auto: {
    label: "完全托管",
    description: "AI 全权负责分类和整理，无需您的干预",
    icon: "sparkles",
  },
  semi_auto: {
    label: "半托管",
    description: "AI 处理大部分工作，不确定时会询问您的意见",
    icon: "message-circle",
  },
  manual: {
    label: "不托管",
    description: "您完全掌控，AI 仅在您请求时提供辅助",
    icon: "hand",
  },
};

/**
 * 验证托管模式是否有效
 */
export function isValidTrustMode(mode: unknown): mode is TrustMode {
  return mode === "full_auto" || mode === "semi_auto" || mode === "manual";
}
