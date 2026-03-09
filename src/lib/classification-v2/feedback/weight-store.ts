/**
 * WeightStore - 用户级 Scorer 权重持久化
 *
 * 读写数据库中的用户级 Scorer 权重覆盖。
 * 权重由 FeedbackHandler 调整后写入。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { CLASSIFICATION_CONFIG } from "../config";
import type { UserScorerWeights } from "../types";

/**
 * 读取用户的 Scorer 权重覆盖
 *
 * 不存在时返回默认权重。
 */
export async function loadUserWeights(
  userId: string,
): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();

    type WeightRow = {
      weights: Record<string, number>;
    };

    // classification_feedback 表不在 Supabase 生成类型中，使用 any 绕过
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawData, error } = await (supabase as any)
      .from("classification_feedback")
      .select("weights")
      .eq("user_id", userId)
      .eq("feedback_type", "weight_snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !rawData) {
      // 无自定义权重，使用默认
      return { ...CLASSIFICATION_CONFIG.scorerWeights };
    }

    const row = rawData as unknown as WeightRow;
    const stored = row.weights;

    if (!stored || typeof stored !== "object") {
      return { ...CLASSIFICATION_CONFIG.scorerWeights };
    }

    // 合并：用户权重覆盖默认值
    return {
      ...CLASSIFICATION_CONFIG.scorerWeights,
      ...stored,
    };
  } catch (err) {
    logger.error({ err, userId }, "WeightStore: load failed");
    return { ...CLASSIFICATION_CONFIG.scorerWeights };
  }
}

/**
 * 保存用户的 Scorer 权重
 */
export async function saveUserWeights(data: UserScorerWeights): Promise<void> {
  try {
    const supabase = await createClient();

    // classification_feedback 表不在 Supabase 生成类型中，使用 any 绕过
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("classification_feedback").insert({
      user_id: data.userId,
      feedback_type: "weight_snapshot",
      context: {
        weights: data.weights,
        feedbackCount: data.feedbackCount,
        updatedAt: data.updatedAt.toISOString(),
      },
    });

    logger.info(
      { userId: data.userId, feedbackCount: data.feedbackCount },
      "WeightStore: weights saved",
    );
  } catch (err) {
    logger.error({ err, userId: data.userId }, "WeightStore: save failed");
  }
}
