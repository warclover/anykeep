/**
 * Brain-Sync 复习反馈 API
 * POST /api/brain-sync/response - 提交复习反馈
 *
 * @module api/brain-sync/response
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  databaseError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { SM2Algorithm } from "@/lib/ai-skills/shared/review";
import type { ReviewResponse, SM2Input } from "@/lib/ai-skills/shared/review";
import type {
  FlashcardRow,
  UpdateFlashcardReviewResult,
} from "@/types/brain-sync";

/**
 * 请求体验证 Schema
 */
const submitResponseSchema = z.object({
  flashcardId: z.number().int().positive(),
  response: z.enum(["mastered", "fuzzy", "forgotten", "archived"]),
  responseTimeMs: z.number().int().positive().optional(),
});

/**
 * 根据反馈类型确定 SM-2 质量分数
 */
function getQualityFromResponse(response: ReviewResponse): number {
  switch (response) {
    case "mastered":
      return 5; // 完美回忆
    case "fuzzy":
      return 3; // 模糊回忆，但能想起来
    case "forgotten":
      return 1; // 完全忘记
    case "archived":
      return 5; // 归档也视为完美掌握
    default:
      return 3;
  }
}

/**
 * 生成复习反馈提示
 */
function getGuidance(response: ReviewResponse, newInterval: number): string {
  switch (response) {
    case "mastered":
      if (newInterval >= 21) {
        return "太棒了！这个知识点已经牢固掌握，下次复习在三周后。";
      } else if (newInterval >= 7) {
        return "很好！这个知识点掌握得不错，下次复习在一周后。";
      } else {
        return "继续保持！再复习几次就能完全掌握了。";
      }
    case "fuzzy":
      return "没关系，模糊记忆是正常的。明天再复习一次会更清晰。";
    case "forgotten":
      return "别担心，遗忘是记忆的一部分。今天再看一遍，明天继续复习。";
    case "archived":
      return "🎉 恭喜！这个知识点已永久归档，不再出现在复习队列中。如需恢复，可在卡片管理中操作。";
    default:
      return "";
  }
}

/**
 * POST /api/brain-sync/response
 * 提交复习反馈
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = submitResponseSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { flashcardId, response, responseTimeMs } = validation.data;

    const supabase = await createClient();

    // 3. 获取当前 Flashcard 状态（使用类型断言处理新表）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: flashcard, error: flashcardError } = (await (supabase as any)
      .from("flashcards")
      .select("id, ease_factor, interval_days, repetitions, status")
      .eq("id", flashcardId)
      .eq("user_id", user.id)
      .single()) as {
      data: Pick<
        FlashcardRow,
        "id" | "ease_factor" | "interval_days" | "repetitions" | "status"
      > | null;
      error: { message: string } | null;
    };

    if (flashcardError || !flashcard) {
      logger.warn(
        { flashcardId, userId: user.id, error: flashcardError },
        "Brain-Sync: Flashcard not found",
      );
      return notFoundError("Flashcard 不存在或无权限访问");
    }

    // 4. 特殊处理：归档请求
    if (response === "archived") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: archiveResult, error: archiveError } = (await (supabase as any).rpc("archive_flashcard", {
        p_flashcard_id: flashcardId,
        p_user_id: user.id,
      })) as {
        data: { success: boolean; message?: string; error?: string } | null;
        error: { message: string } | null;
      };

      if (archiveError || !archiveResult?.success) {
        logger.error(
          { error: archiveError || archiveResult?.error, flashcardId, userId: user.id },
          "Brain-Sync: Failed to archive flashcard",
        );
        return databaseError("归档卡片失败");
      }

      logger.info(
        { userId: user.id, flashcardId, response: "archived" },
        "Brain-Sync: Flashcard archived",
      );

      return successResponse({
        success: true,
        flashcardId,
        response: "archived",
        newStatus: "archived",
        nextReviewAt: null,
        sm2Result: null,
        guidance: getGuidance("archived", 0),
      });
    }

    // 5. 计算 SM-2 算法结果（非归档情况）
    const quality = getQualityFromResponse(response);
    const sm2Input: SM2Input = {
      quality,
      easeFactor: flashcard.ease_factor || 2.5,
      interval: flashcard.interval_days || 1,
      repetitions: flashcard.repetitions || 0,
    };

    const sm2Result = SM2Algorithm.calculate(sm2Input);

    // 6. 调用数据库函数更新 Flashcard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updateResult, error: updateError } = (await (
      supabase as any
    ).rpc("update_flashcard_review", {
      p_flashcard_id: flashcardId,
      p_user_id: user.id,
      p_response: response,
      p_new_interval: sm2Result.interval,
      p_new_ease: sm2Result.easeFactor,
      p_new_repetitions: sm2Result.repetitions,
      p_response_time_ms: responseTimeMs || null,
    })) as {
      data: UpdateFlashcardReviewResult | null;
      error: { message: string } | null;
    };

    if (updateError) {
      logger.error(
        { error: updateError, flashcardId, userId: user.id },
        "Brain-Sync: Failed to update flashcard review",
      );
      return databaseError("更新复习状态失败");
    }

    // 7. 更新本周队列进度（如果存在）
    // 使用专用函数标记 flashcard 已完成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("mark_flashcard_completed_in_queue", {
      p_user_id: user.id,
      p_flashcard_id: flashcardId,
    });

    const guidance = getGuidance(response, sm2Result.interval);

    logger.info(
      {
        userId: user.id,
        flashcardId,
        response,
        newInterval: sm2Result.interval,
        newEase: sm2Result.easeFactor,
      },
      "Brain-Sync: Review response submitted",
    );

    return successResponse({
      success: true,
      flashcardId,
      response,
      newStatus: updateResult?.new_status || "learning",
      nextReviewAt: updateResult?.next_review_at,
      sm2Result: {
        newInterval: sm2Result.interval,
        newEaseFactor: sm2Result.easeFactor,
        newRepetitions: sm2Result.repetitions,
      },
      guidance,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Response API error",
    );
    return internalError("提交复习反馈失败");
  }
}
