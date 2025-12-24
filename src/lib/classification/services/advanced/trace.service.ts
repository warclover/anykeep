/**
 * V4.0 全链路追踪服务
 *
 * 功能：
 * - 生成唯一 TraceID
 * - 记录匹配器得分详情
 * - 构建决策路径
 * - 生成用户可读的决策理由
 * - 持久化追踪日志
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  ClassificationDecisionType,
  ClassificationDecisionInsert,
} from "@/lib/classification/types";
import type {
  DecisionPath,
  MatcherScoreDetail,
  DecisionReason,
  ClassificationAction,
  MatchResult,
  BookmarkInput,
} from "@/lib/classification/types";
import { generateTraceId } from "@/lib/classification/types";
import { logger } from "@/lib/logger";

// ============================================================================
// 追踪上下文 - 用于在分类过程中收集数据
// ============================================================================

export interface TraceContext {
  traceId: string;
  startTime: number;
  userId: string;
  bookmark: BookmarkInput;
  matcherScores: MatcherScoreDetail[];
}

/**
 * 创建追踪上下文
 */
export function createTraceContext(
  userId: string,
  bookmark: BookmarkInput,
): TraceContext {
  return {
    traceId: generateTraceId(),
    startTime: performance.now(),
    userId,
    bookmark,
    matcherScores: [],
  };
}

/**
 * 记录匹配器执行结果
 */
export function recordMatcherResult(
  context: TraceContext,
  matcherName: string,
  startTime: number,
  available: boolean,
  results: MatchResult[] | null,
  error?: string,
): void {
  const durationMs = Math.round(performance.now() - startTime);

  const scoreDetail: MatcherScoreDetail = {
    matcherName,
    available,
    durationMs,
    topCandidate: null,
    candidates: [],
    error,
  };

  if (results && results.length > 0) {
    // 取 Top 5 候选
    const topResults = results.slice(0, 5);

    scoreDetail.topCandidate = {
      folderId: topResults[0].folderId,
      folderName: topResults[0].folderName,
      score: topResults[0].score,
    };

    scoreDetail.candidates = topResults.map((r) => ({
      folderId: r.folderId,
      folderName: r.folderName,
      score: r.score,
      reason: r.reason,
    }));
  }

  context.matcherScores.push(scoreDetail);
}

// ============================================================================
// 决策理由生成器
// ============================================================================

/**
 * 根据匹配结果生成用户可读的决策理由
 */
export function generateDecisionReason(
  tier: 0 | 1 | 2 | 3,
  matcherScores: MatcherScoreDetail[],
  finalResult: {
    folderId: number | null;
    folderName: string;
    confidence: number;
    action: ClassificationAction;
  },
): DecisionReason {
  // 找到贡献最大的匹配器
  const topMatcher = matcherScores
    .filter((m) => m.available && m.topCandidate)
    .sort(
      (a, b) => (b.topCandidate?.score || 0) - (a.topCandidate?.score || 0),
    )[0];

  let primary = "";
  let secondary: string | undefined;
  let confidenceExplanation = "";

  // 根据层级和匹配器生成理由
  switch (tier) {
    case 1:
      // 高置信度快速匹配
      if (topMatcher?.matcherName === "vector") {
        primary = `与「${finalResult.folderName}」中的内容高度相似`;
      } else if (topMatcher?.matcherName === "history") {
        primary = `您之前将类似内容保存到「${finalResult.folderName}」`;
      } else if (topMatcher?.matcherName === "knn-direct") {
        primary = `找到高度相似的历史收藏`;
      } else if (topMatcher?.matcherName === "fingerprint") {
        primary = `标签与「${finalResult.folderName}」的特征匹配`;
      } else if (topMatcher?.matcherName === "universal") {
        primary = `内容属于「${finalResult.folderName}」类别`;
      } else if (topMatcher?.matcherName === "tag") {
        primary = `标签精确匹配`;
        secondary = topMatcher?.candidates?.[0]?.reason;
      } else {
        primary = `快速匹配命中`;
      }
      confidenceExplanation = "高置信度，跳过 AI 确认";
      break;

    case 2:
      // AI 确认
      primary = `AI 分析后推荐归入「${finalResult.folderName}」`;
      if (topMatcher) {
        secondary = `初步匹配: ${topMatcher.matcherName}`;
      }
      confidenceExplanation = "AI 已确认分类结果";
      break;

    case 3:
      // 自动创建建议
      primary = `建议创建新文件夹「${finalResult.folderName}」`;
      secondary = "现有文件夹均不匹配";
      confidenceExplanation = "基于内容特征推荐新分类";
      break;

    case 0:
    default:
      // 送入待整理
      primary = "暂时无法确定最佳分类";
      secondary = "已送入待整理，稍后可手动归类";
      confidenceExplanation = `置信度 ${finalResult.confidence}%，低于阈值`;
      break;
  }

  return {
    primary,
    secondary,
    confidenceExplanation,
  };
}

// ============================================================================
// 决策路径构建器
// ============================================================================

/**
 * 构建完整的决策路径
 */
export function buildDecisionPath(
  context: TraceContext,
  tier: 0 | 1 | 2 | 3,
  aiCalled: boolean,
  timings: {
    tier1Ms?: number;
    tier2Ms?: number;
    tier3Ms?: number;
  },
  finalResult: {
    folderId: number | null;
    folderName: string;
    confidence: number;
    action: ClassificationAction;
    reason: string;
  },
): DecisionPath {
  const totalMs = Math.round(performance.now() - context.startTime);

  const decisionReason = generateDecisionReason(
    tier,
    context.matcherScores,
    finalResult,
  );

  return {
    traceId: context.traceId,
    timestamp: new Date().toISOString(),
    userId: context.userId,
    bookmark: {
      id: context.bookmark.id,
      title: context.bookmark.title,
      url: context.bookmark.url,
      tags: context.bookmark.tags || [],
    },
    finalTier: tier,
    aiCalled,
    matcherScores: context.matcherScores,
    tierTimings: {
      ...timings,
      totalMs,
    },
    finalResult,
    decisionReason,
  };
}

// ============================================================================
// 追踪存储服务
// ============================================================================

/**
 * 追踪存储服务类
 */
export class TraceStorageService {
  private supabase: SupabaseClient<Database>;

  // 内存缓存最近的追踪（用于快速查询）
  private recentTraces: Map<string, DecisionPath> = new Map();
  private readonly MAX_CACHED_TRACES = 1000;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 保存追踪到数据库
   * @param decisionPath 决策路径
   * @param bookmarkId 书签 ID（必填，因为 classification_decisions 表需要）
   */
  async saveTrace(
    decisionPath: DecisionPath,
    bookmarkId?: number,
  ): Promise<void> {
    try {
      // 只有提供 bookmarkId 时才保存到数据库
      if (bookmarkId) {
        // 将 matcher_scores 序列化为 JSON 兼容格式
        const matcherScoresJson = JSON.parse(
          JSON.stringify({
            traceId: decisionPath.traceId,
            matcherScores: decisionPath.matcherScores,
            tierTimings: decisionPath.tierTimings,
            decisionReason: decisionPath.decisionReason,
          }),
        );

        const insertData: ClassificationDecisionInsert = {
          user_id: decisionPath.userId,
          bookmark_id: bookmarkId,
          decision_type: this.mapTierToDecisionType(decisionPath.finalTier),
          final_folder_id: decisionPath.finalResult.folderId,
          final_folder_name: decisionPath.finalResult.folderName,
          confidence: decisionPath.finalResult.confidence,
          matcher_scores: matcherScoresJson,
          ai_skipped: !decisionPath.aiCalled,
        };

        // Note: classification_decisions 是 V4.2 新增表
        const { error } = await this.supabase
          .from("classification_decisions")
          .upsert(insertData);

        if (error) {
          logger.warn(
            { error, traceId: decisionPath.traceId },
            "Failed to save trace to database",
          );
        }
      }

      // 保存到内存缓存
      this.cacheTrace(decisionPath);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "TraceStorageService: saveTrace failed",
      );
    }
  }

  /**
   * 缓存追踪
   */
  private cacheTrace(decisionPath: DecisionPath): void {
    // 清理旧缓存
    if (this.recentTraces.size >= this.MAX_CACHED_TRACES) {
      const oldestKey = this.recentTraces.keys().next().value;
      if (oldestKey) {
        this.recentTraces.delete(oldestKey);
      }
    }

    this.recentTraces.set(decisionPath.traceId, decisionPath);
  }

  /**
   * 根据 TraceID 查询追踪
   */
  async getTrace(traceId: string): Promise<DecisionPath | null> {
    // 先查缓存
    const cached = this.recentTraces.get(traceId);
    if (cached) {
      return cached;
    }

    // 查数据库
    try {
      // 使用 RPC 或原始 SQL 查询 JSONB 字段
      // 由于 Supabase JS SDK 不直接支持 JSONB 操作符，使用 textSearch 模式
      // Note: classification_decisions 是 V4.2 新增表
      const { data: allDataRaw, error } = await this.supabase
        .from("classification_decisions")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });

      if (error || !allDataRaw) {
        return null;
      }

      // 类型断言
      type DecisionRow = {
        user_id: string;
        created_at: string;
        decision_type: string | null;
        ai_skipped: boolean;
        final_folder_id: number | null;
        final_folder_name: string | null;
        confidence: number | null;
        matcher_scores: { traceId?: string } | null;
      };
      const allData = allDataRaw as DecisionRow[];

      // 在内存中查找匹配的 traceId
      const data = allData.find((d) => {
        return d.matcher_scores?.traceId === traceId;
      });

      if (!data) {
        return null;
      }

      // 重建 DecisionPath（先转为 unknown 再转为目标类型）
      const matcherScoresData = data.matcher_scores as unknown as {
        traceId: string;
        matcherScores: MatcherScoreDetail[];
        tierTimings: DecisionPath["tierTimings"];
        decisionReason: DecisionReason;
      };

      return {
        traceId: matcherScoresData.traceId,
        timestamp: data.created_at,
        userId: data.user_id,
        bookmark: {
          title: "（从数据库恢复）",
          tags: [],
        },
        finalTier: this.mapDecisionTypeToTier(data.decision_type),
        aiCalled: !data.ai_skipped,
        matcherScores: matcherScoresData.matcherScores,
        tierTimings: matcherScoresData.tierTimings,
        finalResult: {
          folderId: data.final_folder_id,
          folderName: data.final_folder_name || "未知",
          confidence: data.confidence || 0,
          action: this.mapDecisionTypeToAction(data.decision_type),
          reason: "",
        },
        decisionReason: matcherScoresData.decisionReason,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          traceId,
        },
        "TraceStorageService: getTrace failed",
      );
      return null;
    }
  }

  /**
   * 获取用户最近的追踪列表
   */
  async getRecentTraces(
    userId: string,
    limit: number = 50,
  ): Promise<
    Array<{
      traceId: string;
      timestamp: string;
      folderName: string;
      confidence: number;
    }>
  > {
    try {
      // Note: classification_decisions 是 V4.2 新增表
      const { data: dataRaw, error } = await this.supabase
        .from("classification_decisions")
        .select("matcher_scores, created_at, final_folder_name, confidence")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !dataRaw) {
        return [];
      }

      // 类型断言
      type RecentRow = {
        matcher_scores: { traceId?: string } | null;
        created_at: string;
        final_folder_name: string | null;
        confidence: number | null;
      };
      const data = dataRaw as RecentRow[];

      return data
        .filter((d) => d.matcher_scores?.traceId)
        .map((d) => {
          return {
            traceId: d.matcher_scores!.traceId!,
            timestamp: d.created_at,
            folderName: d.final_folder_name || "未知",
            confidence: d.confidence || 0,
          };
        });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "TraceStorageService: getRecentTraces failed",
      );
      return [];
    }
  }

  /**
   * 辅助方法：tier 转 decision_type
   */
  private mapTierToDecisionType(
    tier: 0 | 1 | 2 | 3,
  ): ClassificationDecisionType {
    switch (tier) {
      case 1:
        return "tier1_direct";
      case 2:
        return "tier2_ai_confirmed";
      case 3:
        return "tier3_auto_create";
      case 0:
      default:
        return "to_inbox";
    }
  }

  /**
   * 辅助方法：decision_type 转 tier
   */
  private mapDecisionTypeToTier(decisionType: string | null): 0 | 1 | 2 | 3 {
    switch (decisionType) {
      case "tier1_direct":
        return 1;
      case "tier2_ai_confirmed":
        return 2;
      case "tier3_auto_create":
        return 3;
      default:
        return 0;
    }
  }

  /**
   * 辅助方法：decision_type 转 action
   */
  private mapDecisionTypeToAction(
    decisionType: string | null,
  ): ClassificationAction {
    switch (decisionType) {
      case "tier3_auto_create":
        return "suggest_create";
      case "to_inbox":
        return "inbox";
      default:
        return "classify";
    }
  }
}

/**
 * 创建追踪存储服务实例
 *
 * @deprecated 请使用 `import { getTraceStorage } from './service-factory'` 代替
 */
export function createTraceStorageService(
  supabase: SupabaseClient<Database>,
): TraceStorageService {
  return new TraceStorageService(supabase);
}
