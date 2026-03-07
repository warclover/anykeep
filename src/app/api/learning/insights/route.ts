/**
 * AI Learning Insights API
 *
 * GET /api/learning/insights - 聚合返回学习系统所有可视化数据
 *
 * @version 1.0.0
 * @since 2026-02-27
 */

import type { NextRequest } from "next/server";
import { successResponse } from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { negativeSampleService } from "@/lib/classification/learning/negative-sample.service";
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import { feedbackLoopService } from "@/lib/classification/learning/feedback-loop";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
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
        .getUserExclusions(userId, { limit: 200 })
        .catch(logCatch("getUserExclusions", [])),
      negativeSampleService.getUserStats(userId).catch(
        logCatch("getUserStats", {
          total: 0,
          byType: {} as Record<string, number>,
          byFolder: {} as Record<number, number>,
        }),
      ),
      preferenceLearner
        .getUserPreferences(userId)
        .catch(logCatch("getUserPreferences", null)),
      preferenceLearner.getLearningStats(userId).catch(
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
        .generateHealthReport(userId)
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
  },
);
