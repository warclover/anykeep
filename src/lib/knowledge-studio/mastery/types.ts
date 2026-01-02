/**
 * Knowledge Studio - 内化率追踪类型定义
 * @module knowledge-studio/mastery
 * @description Phase 3 存根 - Brain-Sync 学习效果统计
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 内化率计算
 * - 学习曲线分析
 * - 知识图谱
 * - 进度可视化
 */

// ============================================================================
// 掌握度类型
// ============================================================================

/**
 * 掌握度等级
 */
export type MasteryLevel =
  | "unknown" // 未学习
  | "learning" // 学习中
  | "familiar" // 熟悉
  | "proficient" // 熟练
  | "mastered"; // 精通

/**
 * 学习状态
 */
export type LearningStatus =
  | "not_started" // 未开始
  | "in_progress" // 进行中
  | "reviewing" // 复习中
  | "completed"; // 已完成

// ============================================================================
// 知识点
// ============================================================================

/**
 * 知识点
 */
export interface KnowledgePoint {
  /** 知识点 ID */
  id: string;
  /** 报告 ID */
  reportId: string;
  /** 知识点内容 */
  content: string;
  /** 关键词 */
  keywords: string[];
  /** 段落索引 */
  paragraphIndex: number;
  /** 关联书签 ID */
  sourceBookmarkIds: string[];
  /** 难度等级 (1-5) */
  difficulty: number;
  /** 重要性 (1-5) */
  importance: number;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 知识点掌握状态
 */
export interface KnowledgePointMastery {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 知识点 ID */
  knowledgePointId: string;
  /** 掌握度等级 */
  masteryLevel: MasteryLevel;
  /** 复习次数 */
  reviewCount: number;
  /** 正确次数 */
  correctCount: number;
  /** 正确率 */
  accuracy: number;
  /** 上次复习时间 */
  lastReviewedAt?: Date;
  /** 下次复习时间（SM-2 算法） */
  nextReviewAt?: Date;
  /** 间隔天数（SM-2） */
  intervalDays: number;
  /** 易度因子（SM-2） */
  easeFactor: number;
}

// ============================================================================
// 学习记录
// ============================================================================

/**
 * 学习会话
 */
export interface LearningSession {
  /** 会话 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 报告 ID */
  reportId: string;
  /** 开始时间 */
  startedAt: Date;
  /** 结束时间 */
  endedAt?: Date;
  /** 学习的知识点数量 */
  pointsStudied: number;
  /** 复习的知识点数量 */
  pointsReviewed: number;
  /** 正确回答数 */
  correctAnswers: number;
  /** 总回答数 */
  totalAnswers: number;
  /** 会话时长（分钟） */
  durationMinutes: number;
}

/**
 * 复习记录
 */
export interface ReviewRecord {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 知识点 ID */
  knowledgePointId: string;
  /** 会话 ID */
  sessionId: string;
  /** 复习时间 */
  timestamp: Date;
  /** 用户评分 (0-5, SM-2) */
  rating: number;
  /** 响应时间（毫秒） */
  responseTimeMs: number;
  /** 之前的间隔天数 */
  previousInterval: number;
  /** 新的间隔天数 */
  newInterval: number;
}

// ============================================================================
// 内化率统计
// ============================================================================

/**
 * 报告内化率
 */
export interface ReportMasteryStats {
  /** 报告 ID */
  reportId: string;
  /** 用户 ID */
  userId: string;
  /** 知识点总数 */
  totalPoints: number;
  /** 各等级数量 */
  levelCounts: Record<MasteryLevel, number>;
  /** 内化率 (0-100) */
  masteryRate: number;
  /** 平均正确率 */
  averageAccuracy: number;
  /** 总学习时间（分钟） */
  totalStudyMinutes: number;
  /** 总复习次数 */
  totalReviews: number;
  /** 学习天数 */
  studyDays: number;
  /** 上次学习时间 */
  lastStudiedAt?: Date;
  /** 学习状态 */
  status: LearningStatus;
}

/**
 * 用户整体内化率
 */
export interface UserMasteryStats {
  /** 用户 ID */
  userId: string;
  /** 已学习报告数 */
  reportsStudied: number;
  /** 已掌握知识点数 */
  pointsMastered: number;
  /** 总知识点数 */
  totalPoints: number;
  /** 整体内化率 */
  overallMasteryRate: number;
  /** 学习连续天数 */
  streakDays: number;
  /** 最长连续天数 */
  longestStreak: number;
  /** 今日待复习数 */
  dueForReview: number;
  /** 本周学习时间（分钟） */
  weeklyStudyMinutes: number;
  /** 学习趋势 */
  trend: "improving" | "stable" | "declining";
}

/**
 * 学习进度时间线
 */
export interface LearningTimeline {
  /** 日期 */
  date: Date;
  /** 学习时间（分钟） */
  studyMinutes: number;
  /** 复习知识点数 */
  pointsReviewed: number;
  /** 新学知识点数 */
  pointsLearned: number;
  /** 当日内化率 */
  dailyMasteryRate: number;
}

// ============================================================================
// 服务接口 (Phase 3 存根)
// ============================================================================

/**
 * 知识点提取服务接口
 * @stub Phase 3 实现
 */
export interface IKnowledgeExtractor {
  /** 从报告提取知识点 */
  extractFromReport(reportId: string): Promise<KnowledgePoint[]>;
  /** 获取报告知识点 */
  getReportKnowledgePoints(reportId: string): Promise<KnowledgePoint[]>;
  /** 更新知识点 */
  updateKnowledgePoint(
    pointId: string,
    updates: Partial<KnowledgePoint>,
  ): Promise<void>;
}

/**
 * 内化率追踪服务接口
 * @stub Phase 3 实现
 */
export interface IMasteryTracker {
  /** 获取知识点掌握状态 */
  getPointMastery(
    userId: string,
    pointId: string,
  ): Promise<KnowledgePointMastery | null>;
  /** 记录复习结果 */
  recordReview(record: Omit<ReviewRecord, "id">): Promise<void>;
  /** 获取报告内化率 */
  getReportMasteryStats(
    userId: string,
    reportId: string,
  ): Promise<ReportMasteryStats>;
  /** 获取用户整体内化率 */
  getUserMasteryStats(userId: string): Promise<UserMasteryStats>;
  /** 获取待复习知识点 */
  getDueForReview(
    userId: string,
    limit?: number,
  ): Promise<KnowledgePointMastery[]>;
  /** 获取学习时间线 */
  getLearningTimeline(
    userId: string,
    days: number,
  ): Promise<LearningTimeline[]>;
  /** 创建学习会话 */
  createSession(userId: string, reportId: string): Promise<LearningSession>;
  /** 结束学习会话 */
  endSession(sessionId: string, userId: string): Promise<LearningSession>;
}
