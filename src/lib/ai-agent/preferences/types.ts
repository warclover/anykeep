/**
 * AI 偏好类型定义
 *
 * 用户画像持久化数据结构
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// =============================================================================
// 响应风格
// =============================================================================

/**
 * 响应风格类型
 */
export type ResponseStylePreference = "concise" | "detailed" | "auto";

// =============================================================================
// 学习到的偏好
// =============================================================================

/**
 * AI 学习到的偏好（自动更新）
 */
export interface LearnedPreferences {
  /** 常用标签 Top 10 */
  frequentTags: string[];
  /** 常用文件夹 ID Top 5 */
  frequentFolders: number[];
  /** 常见问题类型 */
  frequentQueries: string[];
  /** 偏好的导出格式 */
  preferredExportFormat?: string;
  /** 最后更新时间（ISO 时间戳） */
  lastUpdated: string;
}

/**
 * 标签使用统计
 */
export interface TagUsageStats {
  /** 标签名 */
  tag: string;
  /** 使用次数 */
  count: number;
  /** 最后使用时间 */
  lastUsed: string;
}

/**
 * 文件夹使用统计
 */
export interface FolderUsageStats {
  /** 文件夹 ID */
  folderId: number;
  /** 使用次数 */
  count: number;
  /** 最后使用时间 */
  lastUsed: string;
}

// =============================================================================
// 显式设置
// =============================================================================

/**
 * 用户显式设置
 */
export interface ExplicitPreferences {
  /** 是否跳过确认弹窗 */
  skipConfirmation?: boolean;
  /** 默认列表数量 */
  defaultLimit?: number;
  /** 首选语言 */
  preferredLanguage?: string;
  /** 是否启用成本节省模式 */
  costSavingMode?: boolean;
}

// =============================================================================
// 完整偏好结构
// =============================================================================

/**
 * AI 偏好完整结构
 *
 * 存储在 profiles.ai_preferences JSONB 字段中
 */
export interface AIPreferences {
  /** 响应风格 */
  responseStyle: ResponseStylePreference;
  /** AI 学习到的偏好（自动更新） */
  learned: LearnedPreferences;
  /** 用户显式设置 */
  explicit: ExplicitPreferences;
  /** 版本号（用于迁移） */
  version: number;
}

// =============================================================================
// 默认值
// =============================================================================

/**
 * 默认学习偏好
 */
export const DEFAULT_LEARNED_PREFERENCES: LearnedPreferences = {
  frequentTags: [],
  frequentFolders: [],
  frequentQueries: [],
  lastUpdated: new Date().toISOString(),
};

/**
 * 默认显式设置
 */
export const DEFAULT_EXPLICIT_PREFERENCES: ExplicitPreferences = {
  skipConfirmation: false,
  defaultLimit: 10,
  costSavingMode: false,
};

/**
 * 默认 AI 偏好
 */
export const DEFAULT_AI_PREFERENCES: AIPreferences = {
  responseStyle: "auto",
  learned: DEFAULT_LEARNED_PREFERENCES,
  explicit: DEFAULT_EXPLICIT_PREFERENCES,
  version: 1,
};

// =============================================================================
// 偏好更新类型
// =============================================================================

/**
 * 偏好更新请求
 */
export interface PreferencesUpdateRequest {
  /** 要更新的响应风格 */
  responseStyle?: ResponseStylePreference;
  /** 要更新的显式设置 */
  explicit?: Partial<ExplicitPreferences>;
}

/**
 * 学习事件类型
 */
export type LearningEventType =
  | "tag_used" // 使用了标签
  | "folder_used" // 使用了文件夹
  | "export_format_used" // 使用了导出格式
  | "query_pattern"; // 查询模式

/**
 * 学习事件
 */
export interface LearningEvent {
  /** 事件类型 */
  type: LearningEventType;
  /** 事件数据 */
  data: unknown;
  /** 事件时间 */
  timestamp: string;
}
