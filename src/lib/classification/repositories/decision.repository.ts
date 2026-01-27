/**
 * V3.0 分类决策 Repository
 *
 * 负责记录和查询分类决策，用于反馈闭环学习
 *
 * 注意：classification_decisions 表需要先执行迁移
 * 20251207000002_add_classification_decisions_v3.sql
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TypedSupabaseClient } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { toJson, fromJson } from "@/lib/supabase/json-serializer";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 决策类型
 */
export type DecisionType =
  | "auto_classified"
  | "suggestion_shown"
  | "to_inbox"
  | "knn_direct"
  | "universal_match";

/**
 * 用户反馈动作
 */
export type UserAction =
  | "accepted"
  | "rejected"
  | "changed_folder"
  | "undo"
  | "ignored"
  | "manual_move";

/**
 * 匹配器得分记录
 */
export interface MatcherScores {
  vector?: { score: number; topFolderId?: number };
  history?: { score: number; matchedCount?: number };
  ai?: { score: number; model?: string };
  universal?: { score: number; category?: string };
  knn_direct?: { score: number; sourceBookmarkId?: number };
}

/**
 * 候选文件夹
 */
export interface CandidateFolder {
  folderId: number;
  folderName: string;
  score: number;
}

/**
 * 创建决策记录的输入
 */
export interface CreateDecisionInput {
  userId: string;
  bookmarkId: number;
  decisionType: DecisionType;
  finalFolderId?: number;
  finalFolderName?: string;
  confidence: number;
  matcherScores?: MatcherScores;
  candidates?: CandidateFolder[];
  aiSkipped?: boolean;
  aiModel?: string;
  aiPromptVersion?: string;
  aiResponseTimeMs?: number;
  clientVersion?: string;
}

/**
 * 更新用户反馈的输入
 */
export interface UpdateFeedbackInput {
  bookmarkId: number;
  userId: string;
  userAction: UserAction;
  userChosenFolderId?: number;
}

/**
 * 分类决策记录
 */
export interface ClassificationDecision {
  id: number;
  userId: string;
  bookmarkId: number;
  decisionType: DecisionType;
  finalFolderId: number | null;
  finalFolderName: string | null;
  confidence: number;
  matcherScores: MatcherScores;
  candidates: CandidateFolder[];
  aiSkipped: boolean;
  aiModel: string | null;
  aiPromptVersion: string | null;
  aiResponseTimeMs: number | null;
  userAction: UserAction | null;
  userActionAt: string | null;
  userChosenFolderId: number | null;
  createdAt: string;
}

/**
 * 权重调整结果
 */
export interface WeightAdjustments {
  vector: number;
  history: number;
  ai: number;
  knnDirectThreshold?: number;
  dataSufficient: boolean;
  sampleSize: number;
  aiAccuracy?: number;
  knnAccuracy?: number;
}

// ============================================================================
// Repository 实现
// ============================================================================

/**
 * 数据库行类型（用于类型安全的映射）
 */
interface DecisionRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  decision_type: string;
  final_folder_id: number | null;
  final_folder_name: string | null;
  confidence: number;
  matcher_scores: Record<string, unknown>;
  candidates: unknown[];
  ai_skipped: boolean;
  ai_model: string | null;
  ai_prompt_version: string | null;
  ai_response_time_ms: number | null;
  user_action: string | null;
  user_action_at: string | null;
  user_chosen_folder_id: number | null;
  created_at: string;
}

/**
 * 权重调整 RPC 返回类型
 */
interface WeightAdjustmentsRow {
  vector: number;
  history: number;
  ai: number;
  knn_direct_threshold?: number;
  data_sufficient: boolean;
  sample_size: number;
  ai_accuracy?: number;
  knn_accuracy?: number;
}

/**
 * V3.0 决策 Repository
 *
 * 使用类型断言绕过严格类型检查，因为 classification_decisions 表
 * 需要先执行迁移才能生成正确的 TypeScript 类型。
 */
export class DecisionRepository {
  private supabase: TypedSupabaseClient;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 创建分类决策记录
   */
  async create(input: CreateDecisionInput): Promise<number> {
    const { data, error } = await this.supabase
      .from("classification_decisions")
      .upsert(
        {
          user_id: input.userId,
          bookmark_id: input.bookmarkId,
          decision_type: input.decisionType,
          final_folder_id: input.finalFolderId ?? null,
          final_folder_name: input.finalFolderName ?? null,
          confidence: input.confidence,
          matcher_scores: toJson(input.matcherScores ?? {}),
          candidates: toJson(input.candidates ?? []),
          ai_skipped: input.aiSkipped ?? false,
          ai_model: input.aiModel ?? null,
          ai_prompt_version: input.aiPromptVersion ?? null,
          ai_response_time_ms: input.aiResponseTimeMs ?? null,
          client_version: input.clientVersion ?? null,
        },
        {
          onConflict: "bookmark_id",
        },
      )
      .select("id")
      .single();

    if (error) {
      logger.error(
        { error: error.message, bookmarkId: input.bookmarkId },
        "Failed to create classification decision",
      );
      throw new Error(`创建分类决策记录失败: ${error.message}`);
    }

    return (data as { id: number }).id;
  }

  /**
   * 更新用户反馈
   */
  async updateFeedback(input: UpdateFeedbackInput): Promise<void> {
    const { error } = await this.supabase
      .from("classification_decisions")
      .update({
        user_action: input.userAction,
        user_action_at: new Date().toISOString(),
        user_chosen_folder_id: input.userChosenFolderId ?? null,
      })
      .eq("bookmark_id", input.bookmarkId)
      .eq("user_id", input.userId);

    if (error) {
      logger.error(
        { error: error.message, bookmarkId: input.bookmarkId },
        "Failed to update classification feedback",
      );
      throw new Error(`更新分类反馈失败: ${error.message}`);
    }
  }

  /**
   * 获取书签的分类决策记录
   */
  async getByBookmarkId(
    bookmarkId: number,
    userId: string,
  ): Promise<ClassificationDecision | null> {
    const { data, error } = await this.supabase
      .from("classification_decisions")
      .select("*")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`获取分类决策记录失败: ${error.message}`);
    }

    return this.mapToDecision(data as DecisionRow);
  }

  /**
   * 获取用户的动态权重调整
   */
  async getWeightAdjustments(userId: string): Promise<WeightAdjustments> {
    const { data, error } = await this.supabase.rpc(
      "calculate_matcher_weight_adjustments",
      { p_user_id: userId },
    );

    if (error) {
      logger.warn(
        { error: error.message, userId },
        "Failed to calculate weight adjustments, using defaults",
      );
      // 返回默认权重
      return {
        vector: 0.4,
        history: 0.3,
        ai: 0.3,
        dataSufficient: false,
        sampleSize: 0,
      };
    }

    const row = fromJson<WeightAdjustmentsRow>(data);
    return {
      vector: row.vector,
      history: row.history,
      ai: row.ai,
      knnDirectThreshold: row.knn_direct_threshold,
      dataSufficient: row.data_sufficient,
      sampleSize: row.sample_size,
      aiAccuracy: row.ai_accuracy,
      knnAccuracy: row.knn_accuracy,
    };
  }

  /**
   * 获取用户的分类统计
   */
  async getUserStats(
    userId: string,
    days: number = 30,
  ): Promise<{
    totalDecisions: number;
    autoClassified: number;
    suggestionsShown: number;
    toInbox: number;
    knnDirect: number;
    acceptedRate: number;
    rejectedRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from("classification_decisions")
      .select("decision_type, user_action")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    if (error) {
      throw new Error(`获取分类统计失败: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{
      decision_type: string;
      user_action: string | null;
    }>;

    const stats = {
      totalDecisions: rows.length,
      autoClassified: 0,
      suggestionsShown: 0,
      toInbox: 0,
      knnDirect: 0,
      accepted: 0,
      rejected: 0,
    };

    rows.forEach((d) => {
      switch (d.decision_type) {
        case "auto_classified":
          stats.autoClassified++;
          break;
        case "suggestion_shown":
          stats.suggestionsShown++;
          break;
        case "to_inbox":
          stats.toInbox++;
          break;
        case "knn_direct":
          stats.knnDirect++;
          break;
      }

      if (d.user_action === "accepted") {
        stats.accepted++;
      } else if (
        d.user_action &&
        ["rejected", "changed_folder", "undo"].includes(d.user_action)
      ) {
        stats.rejected++;
      }
    });

    const totalWithFeedback = stats.accepted + stats.rejected;

    return {
      totalDecisions: stats.totalDecisions,
      autoClassified: stats.autoClassified,
      suggestionsShown: stats.suggestionsShown,
      toInbox: stats.toInbox,
      knnDirect: stats.knnDirect,
      acceptedRate:
        totalWithFeedback > 0 ? stats.accepted / totalWithFeedback : 0,
      rejectedRate:
        totalWithFeedback > 0 ? stats.rejected / totalWithFeedback : 0,
    };
  }

  /**
   * 映射数据库记录到领域对象
   */
  private mapToDecision(row: DecisionRow): ClassificationDecision {
    return {
      id: row.id,
      userId: row.user_id,
      bookmarkId: row.bookmark_id,
      decisionType: row.decision_type as DecisionType,
      finalFolderId: row.final_folder_id,
      finalFolderName: row.final_folder_name,
      confidence: row.confidence,
      matcherScores: (row.matcher_scores ?? {}) as MatcherScores,
      candidates: (row.candidates ?? []) as CandidateFolder[],
      aiSkipped: row.ai_skipped,
      aiModel: row.ai_model,
      aiPromptVersion: row.ai_prompt_version,
      aiResponseTimeMs: row.ai_response_time_ms,
      userAction: row.user_action as UserAction | null,
      userActionAt: row.user_action_at,
      userChosenFolderId: row.user_chosen_folder_id,
      createdAt: row.created_at,
    };
  }
}
