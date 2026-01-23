/**
 * V5.5 配额管理类型定义
 */

/**
 * 每日配额状态
 */
export interface DailyQuota {
  /** 今日已使用数量 */
  used: number;
  /** 每日限制 */
  limit: number;
  /** 剩余可用数量 */
  remaining: number;
}

/**
 * 总配额状态
 */
export interface TotalQuota {
  /** AI 已创建的文件夹数 */
  aiCreated: number;
  /** 动态计算的配额上限 */
  limit: number;
  /** 剩余可用数量 */
  remaining: number;
}

/**
 * 健康度门控状态
 */
export interface HealthGate {
  /** 是否通过健康度检查 */
  passed: boolean;
  /** 空文件夹数量 */
  emptyFolders: number;
  /** 未通过原因（如果未通过） */
  reason?: string;
}

/**
 * 统一配额检查结果
 */
export interface UnifiedQuotaResult {
  /** 是否允许创建新文件夹 */
  allowed: boolean;
  /** 每日配额状态 */
  daily: DailyQuota;
  /** 总配额状态 */
  total: TotalQuota;
  /** 健康度门控状态 */
  health: HealthGate;
}

/**
 * ��额统计原始数据（来自数据库 RPC）
 */
export interface QuotaStatsRaw {
  ai_folder_count: number;
  total_folder_count: number;
  empty_folder_count: number;
  total_bookmark_count: number;
  today_created_count: number;
}

/**
 * AI 文件夹设置
 */
export interface AIFolderSettings {
  /** 自主等级: 1-全自动, 2-半自动, 3-保守 */
  autonomy_level: 1 | 2 | 3;
  /** 每日创建限制 */
  daily_create_limit: number;
}

/**
 * 配额配置常量
 */
export const QUOTA_CONFIG = {
  /** AI 创建文件夹硬上限 */
  AI_HARD_CAP: 30,
  /** 总文件夹硬上限（AI + 手动） */
  TOTAL_HARD_CAP: 50,
  /** 软上限计算比例（书签数 × 比例） */
  SOFT_CAP_RATIO: 0.15,
  /** 软上限最小值 */
  SOFT_CAP_MIN: 5,
  /** 健康度门控：空文件夹阈值 */
  EMPTY_FOLDER_THRESHOLD: 3,
  /** 默认每日限制 */
  DEFAULT_DAILY_LIMIT: 5,
} as const;
