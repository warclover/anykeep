/**
 * classify() - 分类系统主入口
 *
 * 整个分类系统对外暴露的唯一函数。
 * 职责：构建上下文 → CascadeRanker 排序 → 决策输出。
 *
 * 调用深度：3 层（classify → CascadeRanker → Scorers）
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { logger } from "@/lib/logger";
import type {
  MergedScore,
  RankEntry,
  ClassifyRequest,
  ClassifyResult,
  ClassifyAction,
  CandidateFolder,
  Scorer,
} from "./types";
import { generateTraceId } from "./types";
import { CLASSIFICATION_CONFIG } from "./config";
import { CascadeRanker } from "./ranker/cascade-ranker";
import { buildBookmarkContext } from "./context/bookmark-context";
import { buildFolderContexts } from "./context/folder-context";
import { buildUserContext } from "./context/user-context";
import { getCached, setCache } from "./infra/cache";
import { suggestFolderName } from "./folder-naming/folder-namer";

// Scorer 实例（模块级单例）
import { RuleScorer } from "./scorer/rule.scorer";
import { AiTagScorer } from "./scorer/ai-tag.scorer";
import { VectorScorer } from "./scorer/vector.scorer";
import { HistoryScorer } from "./scorer/history.scorer";
import { LlmScorer } from "./scorer/llm.scorer";
import { AuthorScorer } from "./scorer/author.scorer";

/** 默认 Scorer 注册表 */
const DEFAULT_SCORERS: Scorer[] = [
  new RuleScorer(),
  new AiTagScorer(),
  new AuthorScorer(),
  new VectorScorer(),
  new HistoryScorer(),
  new LlmScorer(),
];

/** CascadeRanker 单例 */
const ranker = new CascadeRanker();

/**
 * 对单个书签执行智能分类
 *
 * @example
 * ```typescript
 * import { classify } from '@/lib/classification-v2';
 *
 * const result = await classify({
 *   bookmarkId: '123',
 *   title: 'React Hooks 完全指南',
 *   url: 'https://example.com/react-hooks',
 *   tags: ['React', '前端', 'Hooks'],
 *   userId: 'user_abc',
 * });
 *
 * // result.action: 'classify' | 'suggest' | 'suggest_create' | 'inbox'
 * // result.folderId: 42
 * // result.confidence: 0.87
 * ```
 */
export async function classify(
  request: ClassifyRequest,
  /** 自定义 Scorers，默认使用全量注册表。测试时可注入 mock 实现。 */
  scorers: Scorer[] = DEFAULT_SCORERS,
): Promise<ClassifyResult> {
  const traceId = generateTraceId();
  const startTime = Date.now();

  logger.debug(
    { traceId, bookmarkId: request.bookmarkId, userId: request.userId },
    "Classification V2: Starting",
  );

  // 1. 检查缓存
  const cached = getCached(request.userId, request.bookmarkId);
  if (cached) {
    logger.debug({ traceId }, "Classification V2: Cache hit");
    return cached;
  }

  try {
    // 2. 构建上下文（并行加载）
    const [bookmarkCtx, folderCtxs, userCtx] = await Promise.all([
      buildBookmarkContext(request),
      buildFolderContexts(request.userId),
      buildUserContext(request.userId),
    ]);

    // 3. 无文件夹时，放入 inbox
    if (folderCtxs.length === 0) {
      const result = buildInboxResult(traceId, startTime, "用户尚无文件夹");
      return result;
    }

    // 4. 执行 CascadeRanker
    const rankResult = await ranker.rank(
      scorers,
      bookmarkCtx,
      folderCtxs,
      userCtx,
    );

    // 5. 决策：根据 Top1 分数确定 action
    const top = rankResult.entries[0];

    if (!top || top.mergedScore.value < CLASSIFICATION_CONFIG.action.suggest) {
      // 低置信度 → 尝试建议新文件夹，否则 inbox
      const result = buildInboxResult(traceId, startTime, "置信度不足");
      result.scorerDetails = rankResult.scorerDetails;
      result.timing = { ...rankResult.timing };
      result.candidates = rankResult.entries.map(toCandidate);

      // 尝试生成新文件夹名（旁路，失败不阻塞）
      try {
        const suggestion = await suggestFolderName(
          request.title,
          request.tags ?? [],
          request.summary,
          request.userId,
        );
        if (suggestion.name && suggestion.name !== "新分类") {
          result.action = "suggest_create";
          result.suggestedFolderName = suggestion.name;
          result.reason = `建议创建「${suggestion.name}」（${suggestion.reason}）`;
        }
      } catch (error) {
        // 文件夹命名是旁路增强，失败不阻塞主分类流程，降级为 inbox
        logger.debug(
          { traceId, error },
          "Classification V2: folder naming failed, staying inbox",
        );
      }

      result.timing.totalMs = Date.now() - startTime;
      setCache(request.userId, request.bookmarkId, result);
      return result;
    }

    const action: ClassifyAction =
      top.mergedScore.value >= CLASSIFICATION_CONFIG.action.autoClassify
        ? "classify"
        : "suggest";

    const result: ClassifyResult = {
      folderId: top.folderId,
      folderName: top.folderName,
      confidence: top.mergedScore.value,
      action,
      reason: buildReason(top.mergedScore),
      scorerDetails: rankResult.scorerDetails,
      candidates: rankResult.entries.map(toCandidate),
      timing: {
        ...rankResult.timing,
        totalMs: Date.now() - startTime,
      },
      traceId,
    };

    logger.info(
      {
        traceId,
        action,
        folderId: result.folderId,
        confidence: result.confidence,
        earlyExit: rankResult.timing.earlyExitTier,
        totalMs: result.timing.totalMs,
      },
      "Classification V2: Complete",
    );

    // 6. 缓存结果
    setCache(request.userId, request.bookmarkId, result);

    return result;
  } catch (error) {
    logger.error(
      { traceId, error, bookmarkId: request.bookmarkId },
      "Classification V2: Failed",
    );

    return buildInboxResult(
      traceId,
      startTime,
      `分类异常: ${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function buildInboxResult(
  traceId: string,
  startTime: number,
  reason: string,
): ClassifyResult {
  return {
    folderId: null,
    folderName: null,
    confidence: 0,
    action: "inbox",
    reason,
    scorerDetails: [],
    candidates: [],
    timing: { totalMs: Date.now() - startTime, tierMs: {} },
    traceId,
  };
}

function buildReason(mergedScore: MergedScore): string {
  // 从 signals 中提取最强的 2 个信号作为理由
  const topSignals = mergedScore.signals
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2);

  if (topSignals.length === 0) {
    return `综合评分 ${(mergedScore.value * 100).toFixed(0)}%`;
  }

  return topSignals.map((s) => s.detail).join("；");
}

function toCandidate(entry: RankEntry): CandidateFolder {
  return {
    folderId: entry.folderId,
    folderName: entry.folderName,
    mergedScore: entry.mergedScore.value,
    scorerBreakdown: entry.mergedScore.breakdown,
  };
}
