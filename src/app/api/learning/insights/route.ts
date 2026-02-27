/**
 * AI Learning Insights API
 *
 * GET /api/learning/insights - 聚合返回学习系统所有可视化数据
 *
 * @version 1.0.0
 * @since 2026-02-27
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { negativeSampleService } from "@/lib/classification/learning/negative-sample.service";
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import { feedbackLoopService } from "@/lib/classification/learning/feedback-loop";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const logCatch =
      <T>(label: string, fallback: T) =>
      (err: unknown) => {
        logger.warn(
          { error: err instanceof Error ? err.message : err },
          `[LearningInsights] ${label} failed, using fallback`,
        );
        return fallback;
      };

    const [
      exclusions,
      exclusionStats,
      preferences,
      learningStats,
      healthReport,
    ] = await Promise.all([
      negativeSampleService
        .getUserExclusions(user.id, { limit: 200 })
        .catch(logCatch("getUserExclusions", [])),
      negativeSampleService.getUserStats(user.id).catch(
        logCatch("getUserStats", {
          total: 0,
          byType: {} as Record<string, number>,
          byFolder: {} as Record<number, number>,
        }),
      ),
      preferenceLearner
        .getUserPreferences(user.id)
        .catch(logCatch("getUserPreferences", null)),
      preferenceLearner.getLearningStats(user.id).catch(
        logCatch("getLearningStats", {
          totalEvents: 0,
          confirmations: 0,
          rejections: 0,
          modifications: 0,
          accuracy: 0,
          lastLearningTime: null,
        }),
      ),
      feedbackLoopService
        .generateHealthReport(user.id)
        .catch(logCatch("generateHealthReport", null)),
    ]);

    return successResponse({
      exclusions,
      exclusionStats,
      preferences,
      learningStats,
      healthReport,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error }, "[LearningInsights] Failed to load data");
    return internalError(`加载学习洞察数据失败: ${message}`);
  }
}
