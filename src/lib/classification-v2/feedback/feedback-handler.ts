/**
 * FeedbackHandler - 分类反馈处理 + 权重调整
 *
 * 旁路系统：接收用户确认/拒绝反馈，
 * 根据各 Scorer 的预测 vs 实际结果，调整用户级权重。
 * 不阻塞分类主流程。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { CLASSIFICATION_CONFIG } from "../config";
import type { ClassifyFeedback, ScorerDetail } from "../types";
import { loadUserWeights, saveUserWeights } from "./weight-store";

/** 反馈处理结果 */
export interface FeedbackResult {
  accepted: boolean;
  weightsUpdated: boolean;
  newWeights?: Record<string, number>;
}

/**
 * 处理用户分类反馈
 *
 * 1. 记录反馈到数据库
 * 2. 根据各 Scorer 的预测准确性调整权重
 *
 * 这是旁路操作，失败不影响主流程。
 */
export async function handleFeedback(
  feedback: ClassifyFeedback,
): Promise<FeedbackResult> {
  const { learningRate, minWeight, maxWeight } = CLASSIFICATION_CONFIG.feedback;

  try {
    // 1. 记录反馈
    await recordFeedback(feedback);

    // 2. 判断系统预测是否正确
    const isCorrect = feedback.predictedFolderId === feedback.correctFolderId;

    if (isCorrect) {
      // 预测正确，不调整权重
      return { accepted: true, weightsUpdated: false };
    }

    // 3. 加载当前权重
    const currentWeights = await loadUserWeights(feedback.userId);

    // 4. 调整权重
    const newWeights = adjustWeights(
      currentWeights,
      feedback.scorerResults,
      feedback.correctFolderId,
      learningRate,
      minWeight,
      maxWeight,
    );

    // 5. 持久化
    await saveUserWeights({
      userId: feedback.userId,
      weights: newWeights,
      updatedAt: new Date(),
      feedbackCount: 0, // 由 weight-store 维护
    });

    logger.info(
      {
        userId: feedback.userId,
        traceId: feedback.traceId,
        predicted: feedback.predictedFolderId,
        correct: feedback.correctFolderId,
      },
      "FeedbackHandler: weights adjusted",
    );

    return {
      accepted: true,
      weightsUpdated: true,
      newWeights,
    };
  } catch (err) {
    logger.error(
      { err, userId: feedback.userId, traceId: feedback.traceId },
      "FeedbackHandler: failed",
    );
    return { accepted: false, weightsUpdated: false };
  }
}

// ============================================================================
// 内部函数
// ============================================================================

/**
 * 记录反馈到 classification_feedback 表
 */
async function recordFeedback(feedback: ClassifyFeedback): Promise<void> {
  const supabase = await createClient();

  // classification_feedback 表不在 Supabase 生成类型中，使用 any 绕过
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("classification_feedback").insert({
    user_id: feedback.userId,
    bookmark_id: feedback.bookmarkId,
    feedback_type:
      feedback.predictedFolderId === feedback.correctFolderId
        ? "confirmed"
        : "wrong_folder",
    suggested_correct_folder_id: feedback.correctFolderId,
    context: {
      traceId: feedback.traceId,
      predictedFolderId: feedback.predictedFolderId,
      scorerResults: feedback.scorerResults,
    },
  });
}

/**
 * 根据 Scorer 预测准确性调整权重
 *
 * 规则：
 * - 正确预测的 Scorer → 权重 +learningRate
 * - 错误预测的 Scorer → 权重 -learningRate
 * - 未执行的 Scorer → 不调整
 * - 权重归一化确保总和不变
 */
function adjustWeights(
  currentWeights: Record<string, number>,
  scorerResults: ScorerDetail[],
  correctFolderId: number,
  learningRate: number,
  minWeight: number,
  maxWeight: number,
): Record<string, number> {
  const newWeights = { ...currentWeights };
  const executedScorers = scorerResults.filter((s) => s.executed);

  if (executedScorers.length === 0) return newWeights;

  for (const scorer of executedScorers) {
    const currentW = newWeights[scorer.scorer] ?? scorer.weight;
    const predictedCorrectly = scorer.topFolderId === correctFolderId;

    const delta = predictedCorrectly ? learningRate : -learningRate;
    const adjusted = Math.min(maxWeight, Math.max(minWeight, currentW + delta));

    newWeights[scorer.scorer] = Number(adjusted.toFixed(4));
  }

  // 归一化：确保所有权重总和 = 1.0
  const total = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
  if (total > 0 && Math.abs(total - 1.0) > 0.001) {
    for (const key of Object.keys(newWeights)) {
      newWeights[key] = Number((newWeights[key] / total).toFixed(4));
    }
  }

  return newWeights;
}
