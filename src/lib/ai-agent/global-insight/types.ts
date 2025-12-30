/**
 * 全局洞察服务类型定义
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

// ============================================
// 配置类型
// ============================================

/**
 * 全局洞察服务配置
 */
export interface GlobalInsightConfig {
  /** 分析周期（天），默认 90 */
  analysisPeriodDays: number;
  /** 最大主题数，默认 20 */
  maxTopics: number;
  /** 更新间隔（小时），默认 24 */
  updateIntervalHours: number;
  /** 是否使用 LLM 辅助分析，默认 false（Phase 1 不启用） */
  enableLLMAnalysis: boolean;
  /** 核心知识阈值（前 N% 权重为核心），默认 70 */
  coreKnowledgeThreshold: number;
}

// ============================================
// 全局洞察数据结构
// ============================================

/**
 * 全局洞察数据
 */
export interface GlobalInsight {
  /** 版本号 */
  version: number;
  /** 主题分布 */
  topicDistribution: TopicWeight[];
  /** 兴趣趋势（30天） */
  interestTrend: TrendPoint[];
  /** 知识盲区 */
  knowledgeGaps: string[];
  /** 核心知识领域 */
  coreKnowledge: string[];
  /** 边缘兴趣 */
  peripheralInterests: string[];
  /** 平台偏好 */
  platformPreference: PlatformWeight[];
  /** 活跃时段 */
  activeTimeSlots: TimeSlot[];
  /** 最后分析时间 (ISO 字符串) */
  lastAnalyzedAt: string;
  /** 分析覆盖的书签数 */
  analyzedBookmarkCount: number;
}

/**
 * 主题权重
 */
export interface TopicWeight {
  /** 主题名称（标签） */
  topic: string;
  /** 权重 (0-1) */
  weight: number;
  /** 相关书签数 */
  bookmarkCount: number;
  /** 最近活跃度 (0-1) */
  recentActivity: number;
  /** 趋势方向 */
  trend: TrendDirection;
}

/**
 * 趋势方向
 */
export type TrendDirection = "rising" | "stable" | "declining";

/**
 * 趋势点
 */
export interface TrendPoint {
  /** 日期 (YYYY-MM-DD) */
  date: string;
  /** 主题 */
  topic: string;
  /** 活跃度 (0-1) */
  activity: number;
}

/**
 * 平台权重
 */
export interface PlatformWeight {
  /** 平台标识 */
  platform: string;
  /** 权重 (0-1) */
  weight: number;
  /** 书签数 */
  bookmarkCount: number;
}

/**
 * 活跃时段
 */
export interface TimeSlot {
  /** 星期几 (0-6, 0=周日) */
  dayOfWeek: number;
  /** 小时 (0-23) */
  hour: number;
  /** 活跃度 (0-1) */
  activity: number;
}

// ============================================
// 辅助类型
// ============================================

/**
 * 用于分析的书签数据
 */
export interface BookmarkForAnalysis {
  id: number;
  title: string;
  tags: string[] | null;
  platform: string;
  created_at: string;
  summary?: string;
}

/**
 * 主题关联映射
 * 用于识别知识盲区
 */
export type TopicRelationMap = Record<string, string[]>;

/**
 * 洞察生成结果
 */
export interface InsightGenerationResult {
  insight: GlobalInsight;
  durationMs: number;
  bookmarkCount: number;
}
