/**
 * KnowledgeReviewSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 复习时间范围选项
 */
export type ReviewTimeRange = "week" | "month" | "quarter" | "all";

/**
 * 复习优先级
 */
export type ReviewPriority = "high" | "medium" | "low";

/**
 * 复习模式
 */
export type ReviewMode = "spaced" | "sequential" | "random";

/**
 * KnowledgeReview Skill 输入
 */
export interface KnowledgeReviewInput {
  /** 复习时间范围 */
  timeRange: ReviewTimeRange;
  /** 复习模式 */
  mode: ReviewMode;
  /** 最大复习项数量 */
  limit: number;
  /** 筛选文件夹ID */
  folderId?: number;
  /** 筛选标签 */
  tags?: string[];
  /** 是否包含已复习内容 */
  includeReviewed: boolean;
}

/**
 * 艾宾浩斯遗忘曲线间隔（天）
 */
export const EBBINGHAUS_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

/**
 * 需要复习的书签项
 */
export interface ReviewBookmark {
  /** 书签ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** AI摘要 */
  aiSummary: string | null;
  /** 所有标签（AI + 用户） */
  tags: string[];
  /** 平台 */
  platform: string;
  /** 文件夹名称 */
  folderName: string | null;
  /** 创建时间 */
  createdAt: string;
  /** 距离创建天数 */
  daysSinceCreated: number;
  /** 复习优先级 */
  priority: ReviewPriority;
  /** 复习原因 */
  reviewReason: string;
  /** 下一个艾宾浩斯间隔 */
  nextInterval: number;
}

/**
 * 复习计划分组
 */
export interface ReviewGroup {
  /** 分组名称 */
  name: string;
  /** 分组描述 */
  description: string;
  /** 分组内的书签 */
  items: ReviewBookmark[];
  /** 优先级 */
  priority: ReviewPriority;
  /** 建议复习时间 */
  suggestedTime: string;
}

/**
 * 复习统计数据
 */
export interface ReviewStats {
  /** 总收藏数 */
  totalBookmarks: number;
  /** 需要复习的数量 */
  needsReviewCount: number;
  /** 今日需复习 */
  todayCount: number;
  /** 本周需复习 */
  weekCount: number;
  /** 按优先级分布 */
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  /** 按平台分布 */
  byPlatform: Record<string, number>;
  /** 平均复习间隔（天） */
  avgReviewInterval: number;
}

/**
 * KnowledgeReview Skill 输出
 */
export interface KnowledgeReviewOutput {
  /** 复习统计 */
  stats: ReviewStats;
  /** 复习分组 */
  groups: ReviewGroup[];
  /** 复习计划摘要 */
  summary: string;
  /** 下一步建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}
