/**
 * Knowledge Studio - 内化率追踪服务
 * @module knowledge-studio/mastery
 * @description P4 实现 - Brain-Sync 学习效果统计
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IMasteryTracker,
  KnowledgePointMastery,
  ReviewRecord,
  ReportMasteryStats,
  UserMasteryStats,
  LearningTimeline,
  LearningSession,
  MasteryLevel,
} from "./types";

// ============================================================================
// 数据库行类型
// ============================================================================

interface MasteryRow {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  mastery_level: MasteryLevel;
  review_count: number;
  correct_count: number;
  accuracy: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  interval_days: number;
  ease_factor: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  report_id: string;
  started_at: string;
  ended_at: string | null;
  points_studied: number;
  points_reviewed: number;
  correct_answers: number;
  total_answers: number;
  duration_minutes: number;
}

interface DueReviewRow {
  knowledge_point_id: string;
  content: string;
  mastery_level: MasteryLevel;
  interval_days: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  overdue_days: number;
}

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToMastery(row: MasteryRow): KnowledgePointMastery {
  return {
    id: row.id,
    userId: row.user_id,
    knowledgePointId: row.knowledge_point_id,
    masteryLevel: row.mastery_level,
    reviewCount: row.review_count,
    correctCount: row.correct_count,
    accuracy: row.accuracy,
    lastReviewedAt: row.last_reviewed_at
      ? new Date(row.last_reviewed_at)
      : undefined,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at) : undefined,
    intervalDays: row.interval_days,
    easeFactor: row.ease_factor,
  };
}

function rowToSession(row: SessionRow): LearningSession {
  return {
    id: row.id,
    userId: row.user_id,
    reportId: row.report_id,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    pointsStudied: row.points_studied,
    pointsReviewed: row.points_reviewed,
    correctAnswers: row.correct_answers,
    totalAnswers: row.total_answers,
    durationMinutes: row.duration_minutes,
  };
}

// ============================================================================
// 内化率追踪服务实现
// ============================================================================

/**
 * 内化率追踪服务
 *
 * @example
 * ```typescript
 * const tracker = new MasteryTracker();
 *
 * // 获取报告内化率
 * const stats = await tracker.getReportMasteryStats('user-123', 'report-456');
 * console.log(`内化率: ${stats.masteryRate}%`);
 *
 * // 获取待复习知识点
 * const duePoints = await tracker.getDueForReview('user-123');
 * console.log(`今日待复习: ${duePoints.length} 个`);
 * ```
 */
export class MasteryTracker implements IMasteryTracker {
  /**
   * 获取知识点掌握状态
   */
  async getPointMastery(
    userId: string,
    pointId: string,
  ): Promise<KnowledgePointMastery | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_knowledge_point_mastery")
      .select("*")
      .eq("user_id", userId)
      .eq("knowledge_point_id", pointId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 未找到
      }
      logger.error({ error: error.message }, "Failed to get point mastery");
      throw new Error(`获取知识点掌握状态失败: ${error.message}`);
    }

    return rowToMastery(data as MasteryRow);
  }

  /**
   * 记录复习结果（使用 SM-2 算法）
   */
  async recordReview(record: Omit<ReviewRecord, "id">): Promise<void> {
    const supabase = await createClient();

    // 调用 RPC 函数记录复习并更新掌握度
    const { data, error } = await supabase.rpc(
      "record_review_and_update_mastery",
      {
        p_user_id: record.userId,
        p_knowledge_point_id: record.knowledgePointId,
        p_session_id: record.sessionId,
        p_rating: record.rating,
        p_response_time_ms: record.responseTimeMs,
      },
    );

    if (error) {
      logger.error({ error: error.message }, "Failed to record review");
      throw new Error(`记录复习失败: ${error.message}`);
    }

    logger.info(
      {
        userId: record.userId,
        pointId: record.knowledgePointId,
        rating: record.rating,
        result: data,
      },
      "Review recorded with SM-2 update",
    );
  }

  /**
   * 获取报告内化率
   */
  async getReportMasteryStats(
    userId: string,
    reportId: string,
  ): Promise<ReportMasteryStats> {
    const supabase = await createClient();

    // 获取报告的所有知识点
    const { data: points, error: pointsError } = await supabase
      .from("ks_knowledge_points")
      .select("id")
      .eq("report_id", reportId);

    if (pointsError) {
      logger.error(
        { error: pointsError.message },
        "Failed to get report points",
      );
      throw new Error(`获取报告知识点失败: ${pointsError.message}`);
    }

    const pointIds = (points ?? []).map((p) => p.id);

    if (pointIds.length === 0) {
      return {
        reportId,
        userId,
        totalPoints: 0,
        levelCounts: {
          unknown: 0,
          learning: 0,
          familiar: 0,
          proficient: 0,
          mastered: 0,
        },
        masteryRate: 0,
        averageAccuracy: 0,
        totalStudyMinutes: 0,
        totalReviews: 0,
        studyDays: 0,
        status: "not_started",
      };
    }

    // 获取用户对这些知识点的掌握度
    const { data: masteryData, error: masteryError } = await supabase
      .from("ks_knowledge_point_mastery")
      .select("*")
      .eq("user_id", userId)
      .in("knowledge_point_id", pointIds);

    if (masteryError) {
      logger.error(
        { error: masteryError.message },
        "Failed to get mastery data",
      );
      throw new Error(`获取掌握度数据失败: ${masteryError.message}`);
    }

    // 获取学习会话统计
    const { data: sessions } = await supabase
      .from("ks_learning_sessions")
      .select("duration_minutes, started_at")
      .eq("user_id", userId)
      .eq("report_id", reportId);

    // 计算统计数据
    const levelCounts: Record<MasteryLevel, number> = {
      unknown: 0,
      learning: 0,
      familiar: 0,
      proficient: 0,
      mastered: 0,
    };

    let totalReviews = 0;
    let totalAccuracy = 0;
    let lastStudiedAt: Date | undefined;

    for (const mastery of masteryData ?? []) {
      const level = mastery.mastery_level as MasteryLevel;
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      totalReviews += mastery.review_count;
      totalAccuracy += mastery.accuracy;

      if (mastery.last_reviewed_at) {
        const reviewDate = new Date(mastery.last_reviewed_at);
        if (!lastStudiedAt || reviewDate > lastStudiedAt) {
          lastStudiedAt = reviewDate;
        }
      }
    }

    // 未学习的知识点计入 unknown
    levelCounts.unknown += pointIds.length - (masteryData?.length ?? 0);

    // 计算内化率（加权平均）
    const masteredCount = levelCounts.mastered + levelCounts.proficient * 0.75;
    const masteryRate =
      pointIds.length > 0 ? (masteredCount / pointIds.length) * 100 : 0;

    // 计算平均正确率
    const averageAccuracy =
      masteryData && masteryData.length > 0
        ? totalAccuracy / masteryData.length
        : 0;

    // 计算学习时间和天数
    const totalStudyMinutes = (sessions ?? []).reduce(
      (sum, s) => sum + s.duration_minutes,
      0,
    );
    const uniqueDays = new Set(
      (sessions ?? []).map(
        (s) => new Date(s.started_at).toISOString().split("T")[0],
      ),
    ).size;

    // 判断学习状态
    let status: ReportMasteryStats["status"];
    if (masteryData?.length === 0) {
      status = "not_started";
    } else if (levelCounts.mastered === pointIds.length) {
      status = "completed";
    } else if (levelCounts.unknown === 0) {
      status = "reviewing";
    } else {
      status = "in_progress";
    }

    return {
      reportId,
      userId,
      totalPoints: pointIds.length,
      levelCounts,
      masteryRate: Math.round(masteryRate * 100) / 100,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      totalStudyMinutes,
      totalReviews,
      studyDays: uniqueDays,
      lastStudiedAt,
      status,
    };
  }

  /**
   * 获取用户整体内化率
   */
  async getUserMasteryStats(userId: string): Promise<UserMasteryStats> {
    const supabase = await createClient();

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc("get_user_mastery_stats", {
      p_user_id: userId,
    });

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to get user mastery stats",
      );
      throw new Error(`获取用户内化率统计失败: ${error.message}`);
    }

    // 计算连续学习天数
    const { data: recentSessions } = await supabase
      .from("ks_learning_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .gte(
        "started_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("started_at", { ascending: false });

    let streakDays = 0;
    if (recentSessions && recentSessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const studyDates = new Set(
        recentSessions.map((s) => {
          const d = new Date(s.started_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        }),
      );

      let checkDate = today.getTime();
      while (studyDates.has(checkDate)) {
        streakDays++;
        checkDate -= 24 * 60 * 60 * 1000;
      }
    }

    // 计算学习趋势
    const currentWeekMinutes = data?.weeklyStudyMinutes ?? 0;
    const { data: lastWeekData } = await supabase
      .from("ks_learning_sessions")
      .select("duration_minutes")
      .eq("user_id", userId)
      .gte(
        "started_at",
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .lt(
        "started_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      );

    const lastWeekMinutes = (lastWeekData ?? []).reduce(
      (sum, s) => sum + s.duration_minutes,
      0,
    );

    let trend: UserMasteryStats["trend"] = "stable";
    if (currentWeekMinutes > lastWeekMinutes * 1.2) {
      trend = "improving";
    } else if (currentWeekMinutes < lastWeekMinutes * 0.8) {
      trend = "declining";
    }

    // 获取学习的报告数
    const { count: reportsStudied } = await supabase
      .from("ks_learning_sessions")
      .select("report_id", { count: "exact", head: true })
      .eq("user_id", userId);

    return {
      userId,
      reportsStudied: reportsStudied ?? 0,
      pointsMastered:
        (data?.masteredPoints ?? 0) + (data?.proficientPoints ?? 0),
      totalPoints: data?.totalPoints ?? 0,
      overallMasteryRate: data?.overallMasteryRate ?? 0,
      streakDays,
      longestStreak: streakDays, // 需要额外计算历史最长连续
      dueForReview: data?.dueForReview ?? 0,
      weeklyStudyMinutes: currentWeekMinutes,
      trend,
    };
  }

  /**
   * 获取待复习知识点
   */
  async getDueForReview(
    userId: string,
    limit = 20,
  ): Promise<KnowledgePointMastery[]> {
    const supabase = await createClient();

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc("get_due_for_review", {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      logger.error({ error: error.message }, "Failed to get due for review");
      throw new Error(`获取待复习知识点失败: ${error.message}`);
    }

    // 转换为 KnowledgePointMastery 格式
    return (data ?? []).map((row: DueReviewRow) => ({
      id: row.knowledge_point_id,
      userId,
      knowledgePointId: row.knowledge_point_id,
      masteryLevel: row.mastery_level,
      reviewCount: 0, // RPC 不返回这些字段
      correctCount: 0,
      accuracy: 0,
      lastReviewedAt: row.last_reviewed_at
        ? new Date(row.last_reviewed_at)
        : undefined,
      nextReviewAt: row.next_review_at
        ? new Date(row.next_review_at)
        : undefined,
      intervalDays: row.interval_days,
      easeFactor: 2.5,
    }));
  }

  /**
   * 获取学习时间线
   */
  async getLearningTimeline(
    userId: string,
    days: number,
  ): Promise<LearningTimeline[]> {
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 获取会话数据
    const { data: sessions } = await supabase
      .from("ks_learning_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString())
      .order("started_at", { ascending: true });

    // 获取复习记录
    const { data: reviews } = await supabase
      .from("ks_review_records")
      .select("created_at, knowledge_point_id")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    // 按日期聚合
    const timelineMap = new Map<string, LearningTimeline>();

    // 初始化每一天
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      timelineMap.set(dateStr, {
        date,
        studyMinutes: 0,
        pointsReviewed: 0,
        pointsLearned: 0,
        dailyMasteryRate: 0,
      });
    }

    // 聚合会话数据
    for (const session of sessions ?? []) {
      const dateStr = new Date(session.started_at).toISOString().split("T")[0];
      const entry = timelineMap.get(dateStr);
      if (entry) {
        entry.studyMinutes += session.duration_minutes;
        entry.pointsReviewed += session.points_reviewed;
        entry.pointsLearned += session.points_studied;
      }
    }

    // 聚合复习记录
    const reviewsByDate = new Map<string, Set<string>>();
    for (const review of reviews ?? []) {
      const dateStr = new Date(review.created_at).toISOString().split("T")[0];
      if (!reviewsByDate.has(dateStr)) {
        reviewsByDate.set(dateStr, new Set());
      }
      const dateSet = reviewsByDate.get(dateStr);
      if (dateSet) {
        dateSet.add(review.knowledge_point_id);
      }
    }

    // 更新 pointsReviewed
    for (const [dateStr, pointIds] of reviewsByDate) {
      const entry = timelineMap.get(dateStr);
      if (entry) {
        entry.pointsReviewed = Math.max(entry.pointsReviewed, pointIds.size);
      }
    }

    return Array.from(timelineMap.values());
  }

  /**
   * 创建学习会话
   */
  async createSession(
    userId: string,
    reportId: string,
  ): Promise<LearningSession> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_learning_sessions")
      .insert({
        user_id: userId,
        report_id: reportId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Failed to create session");
      throw new Error(`创建学习会话失败: ${error.message}`);
    }

    logger.info(
      { sessionId: data.id, userId, reportId },
      "Learning session created",
    );

    return rowToSession(data as SessionRow);
  }

  /**
   * 结束学习会话
   */
  async endSession(sessionId: string): Promise<LearningSession> {
    const supabase = await createClient();

    // 获取会话
    const { data: session, error: fetchError } = await supabase
      .from("ks_learning_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // 计算时长
    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const durationMinutes = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000,
    );

    // 获取本次会话的复习统计
    const { data: reviews } = await supabase
      .from("ks_review_records")
      .select("rating")
      .eq("session_id", sessionId);

    const totalAnswers = reviews?.length ?? 0;
    const correctAnswers = (reviews ?? []).filter((r) => r.rating >= 3).length;

    // 更新会话
    const { data, error } = await supabase
      .from("ks_learning_sessions")
      .update({
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        points_reviewed: totalAnswers,
        total_answers: totalAnswers,
        correct_answers: correctAnswers,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Failed to end session");
      throw new Error(`结束学习会话失败: ${error.message}`);
    }

    logger.info(
      { sessionId, durationMinutes, totalAnswers, correctAnswers },
      "Learning session ended",
    );

    return rowToSession(data as SessionRow);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建内化率追踪服务实例
 */
export function createMasteryTracker(): IMasteryTracker {
  return new MasteryTracker();
}

// 保留旧名称以兼容
export { MasteryTracker as MasteryTrackerStub };
