/**
 * Brain-Sync 共享类型定义
 * @module shared/review/types
 * @version 2.0.0
 * @updated 2026-01-01 - 添加 v2 深度问题类型
 */

// ============================================
// v2 新增类型
// ============================================

/**
 * 问题认知层次（基于布鲁姆认知分类）
 */
export type QuestionDepth =
  | "understand" // 理解层：用自己的话解释
  | "apply" // 应用层：场景应用
  | "analyze" // 分析层：假设/局限分析
  | "evaluate"; // 评价层：比较评价

/**
 * 理解深度反馈
 */
export type ComprehensionLevel =
  | "new_insight" // 有新理解
  | "reinforced" // 巩固已知
  | "still_confused" // 仍不清楚
  | "skipped"; // 跳过

/**
 * v2 生成的 Flashcard（LLM 输出）
 */
export interface GeneratedFlashcardV2 {
  questionDepth: QuestionDepth;
  question: string;
  thinkingHint: string;
  keyPoints: string[];
  sourceParagraph: string;
}

/**
 * v2 生成结果
 */
export interface FlashcardGenerationResultV2 {
  success: boolean;
  flashcards: GeneratedFlashcardV2[];
  error?: string;
}

// ============================================
// Flashcard 相关类型（v1 兼容）
// ============================================

export type FlashcardStatus = "pending" | "learning" | "mastered" | "archived";
export type ReviewResponse = "mastered" | "fuzzy" | "forgotten" | "archived";
export type FlashcardDifficulty = "easy" | "medium" | "hard";

export interface Flashcard {
  id: number;
  userId: string;
  bookmarkId: number;
  question: string;
  answer: string;
  sourceParagraph?: string;
  status: FlashcardStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  difficulty: FlashcardDifficulty;
  nextReviewAt: Date | null;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedFlashcard {
  question: string;
  answer: string;
  sourceParagraph: string;
}

// ============================================
// 复习会话相关类型
// ============================================

export type SessionType = "scheduled" | "manual" | "chat";

export interface ReviewSession {
  id: number;
  userId: string;
  flashcardId: number;
  response: ReviewResponse;
  responseTimeMs?: number;
  prevInterval: number;
  newInterval: number;
  prevEase: number;
  newEase: number;
  sessionType: SessionType;
  createdAt: Date;
}

// ============================================
// 用户偏好相关类型
// ============================================

export type PreferredDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type NotificationChannel = "sidebar" | "push" | "both" | "none";

export interface ReviewPreferences {
  userId: string;
  enabled: boolean;
  preferredDay: PreferredDay;
  preferredTime: string;
  timezone: string;
  weeklyLimit: number;
  includedFolderIds: number[];
  excludedFolderIds: number[];
  notificationChannel: NotificationChannel;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// 复习队列相关类型
// ============================================

export type DueType = "overdue" | "due_this_week" | "upcoming";

export interface ReviewQueueItem {
  flashcardId: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  question: string;
  answer: string;
  sourceParagraph?: string;
  status: FlashcardStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date | null;
  daysOverdue: number;
  priorityScore: number;
  // v2 新增字段
  questionDepth?: QuestionDepth;
  thinkingHint?: string;
  keyPoints?: string[];
}

export interface WeeklyReviewQueue {
  id: number;
  userId: string;
  weekStart: string;
  flashcardIds: number[];
  completedIds: number[];
  totalCount: number;
  completedCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// 统计相关类型
// ============================================

export interface ReviewStats {
  success: boolean;
  totalFlashcards: number;
  masteredCount: number;
  learningCount: number;
  pendingCount: number;
  archivedCount: number;
  masteredRate: number;
  sessionsInPeriod: number;
  masteredSessions: number;
  fuzzySessions: number;
  forgottenSessions: number;
  avgResponseTimeMs?: number;
  timeRange: "week" | "month" | "all";
}

// ============================================
// SM-2 算法相关类型
// ============================================

export interface SM2Input {
  /** 回忆质量 0-5 */
  quality: number;
  /** 当前连续正确次数 */
  repetitions: number;
  /** 当前难度因子 */
  easeFactor: number;
  /** 当前间隔（天） */
  interval: number;
}

export interface SM2Output {
  /** 新间隔（天） */
  interval: number;
  /** 新连续正确次数 */
  repetitions: number;
  /** 新难度因子 */
  easeFactor: number;
}

// ============================================
// Flashcard 生成相关类型
// ============================================

export interface FlashcardGenerationInput {
  title: string;
  summary?: string;
  content: string;
  count: number;
  difficulty: FlashcardDifficulty;
}

export interface FlashcardGenerationResult {
  success: boolean;
  flashcards: GeneratedFlashcard[];
  error?: string;
}
