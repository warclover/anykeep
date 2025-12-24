/**
 * ReadingPlannerSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";

/**
 * 阅读目标类型
 */
export type ReadingGoal =
  | "clear_backlog"
  | "learn_topic"
  | "daily_routine"
  | "custom";

/**
 * 优先级排序方式
 */
export type PriorityBy = "date" | "importance" | "reading_time" | "topic";

/**
 * 阅读计划输入 Schema
 */
export const readingPlannerInputSchema = z.object({
  /** 阅读目标 */
  goal: z.enum(["clear_backlog", "learn_topic", "daily_routine", "custom"]),

  /** 学习主题（当 goal 为 learn_topic 时必填） */
  topic: z.string().optional(),

  /** 可用时间配置 */
  timeAvailable: z.object({
    /** 每日可用分钟数（15-120） */
    dailyMinutes: z.number().min(15).max(120),
    /** 每周阅读天数（1-7） */
    daysPerWeek: z.number().min(1).max(7),
    /** 总周数（1-12，可选） */
    totalWeeks: z.number().min(1).max(12).optional(),
  }),

  /** 阅读偏好 */
  preferences: z.object({
    /** 优先级排序方式 */
    prioritizeBy: z.enum(["date", "importance", "reading_time", "topic"]),
    /** 是否包含复习内容 */
    includeReview: z.boolean(),
    /** 是否按主题分组 */
    groupByTopic: z.boolean(),
  }),

  /** 范围筛选 */
  scope: z
    .object({
      /** 文件夹 ID */
      folderId: z.number().optional(),
      /** 标签筛选 */
      tags: z.array(z.string()).optional(),
      /** 仅未读内容 */
      unreadOnly: z.boolean().optional(),
    })
    .optional(),
});

export type ReadingPlannerInput = z.infer<typeof readingPlannerInputSchema>;

/**
 * 计划项优先级
 */
export type ItemPriority = "high" | "medium" | "low";

/**
 * 计划项状态
 */
export type ItemStatus = "pending" | "completed" | "skipped";

/**
 * 日程安排项
 */
export interface ScheduleItem {
  /** 书签 ID */
  bookmarkId: number;
  /** 标题 */
  title: string;
  /** 估计阅读时间（分钟） */
  estimatedReadTime: number;
  /** 优先级 */
  priority: ItemPriority;
  /** 是否为复习内容 */
  isReview: boolean;
  /** 平台 */
  platform?: string;
  /** URL */
  url?: string;
}

/**
 * 日程安排（按天）
 */
export interface DaySchedule {
  /** 第几天（从 1 开始） */
  day: number;
  /** 日期（ISO 格式） */
  date: string;
  /** 估计总分钟数 */
  estimatedMinutes: number;
  /** 当天阅读项 */
  items: ScheduleItem[];
}

/**
 * 里程碑
 */
export interface Milestone {
  /** 第几天 */
  day: number;
  /** 描述 */
  description: string;
  /** 已完成项目数 */
  itemsCompleted: number;
}

/**
 * 阅读计划统计
 */
export interface PlanStats {
  /** 总项目数 */
  totalItems: number;
  /** 总阅读时间（分钟） */
  totalReadingTime: number;
  /** 每日平均时间（分钟） */
  averagePerDay: number;
  /** 主题覆盖情况 */
  topicCoverage: Record<string, number>;
  /** 平台分布 */
  platformDistribution: Record<string, number>;
  /** 优先级分布 */
  priorityDistribution: Record<ItemPriority, number>;
}

/**
 * 阅读计划输出
 */
export interface ReadingPlannerOutput {
  /** 计划基本信息 */
  plan: {
    /** 计划 ID（UUID） */
    id: string;
    /** 计划名称 */
    name: string;
    /** 阅读目标 */
    goal: ReadingGoal;
    /** 创建时间 */
    createdAt: string;
    /** 持续时间 */
    duration: {
      /** 开始日期 */
      startDate: string;
      /** 结束日期 */
      endDate: string;
      /** 总天数 */
      totalDays: number;
    };
  };
  /** 日程安排 */
  schedule: DaySchedule[];
  /** 统计信息 */
  stats: PlanStats;
  /** 里程碑 */
  milestones: Milestone[];
  /** 摘要 */
  summary: string;
  /** 建议 */
  suggestions: string[];
}

/**
 * 书签数据（用于计划生成）
 */
export interface BookmarkForPlan {
  id: number;
  title: string;
  url: string;
  platform?: string;
  ai_tags?: string[];
  ai_summary?: string;
  content_length?: number;
  created_at: string;
  folder_id?: number;
  is_read?: boolean;
  tags?: Array<{ name: string }>;
}

/**
 * 平台阅读时间估算（分钟）
 */
export const PLATFORM_READ_TIME_ESTIMATES: Record<string, number> = {
  wechat: 8, // 微信公众号文章
  bilibili: 15, // B站视频
  zhihu: 10, // 知乎问答
  github: 20, // GitHub 仓库
  twitter: 2, // Twitter 短文
  medium: 12, // Medium 博客
  juejin: 10, // 掘金
  csdn: 8, // CSDN
  jianshu: 8, // 简书
  xiaohongshu: 5, // 小红书
  weibo: 3, // 微博
  douban: 10, // 豆瓣
  chrome: 5, // Chrome 书签（默认短）
  edge: 5, // Edge 书签
  firefox: 5, // Firefox 书签
  safari: 5, // Safari 书签
  default: 10, // 默认
};

/**
 * 目标描述映射
 */
export const GOAL_DESCRIPTIONS: Record<ReadingGoal, string> = {
  clear_backlog: "清理阅读积压",
  learn_topic: "学习特定主题",
  daily_routine: "建立日常阅读习惯",
  custom: "自定义阅读计划",
};

/**
 * 优先级排序描述
 */
export const PRIORITY_DESCRIPTIONS: Record<PriorityBy, string> = {
  date: "按收藏时间排序",
  importance: "按重要程度排序",
  reading_time: "按阅读时长排序",
  topic: "按主题相关性排序",
};
