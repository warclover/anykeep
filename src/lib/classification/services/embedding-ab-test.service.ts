/**
 * Embedding A/B Test Metrics Service
 *
 * 收集和分析向量模型 A/B 测试数据
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { EmbeddingModelId } from "@/lib/classification/config/embedding-config";
import type { ClassificationResultData } from "@/types/supabase";

/**
 * A/B 测试操作类型
 */
export type ABTestOperationType = "classification" | "search" | "similarity";

/**
 * A/B 测试组别
 */
export type ABTestGroup = "control" | "treatment";

/**
 * A/B 测试专用的分类结果数据
 * 继承自规范的 ClassificationResultData，添加 A/B 测试所需的必填字段约束
 *
 * @deprecated 使用 ClassificationResultData from "@/types/supabase" 替代
 */
export interface ABTestClassificationResult {
  folderId: number | null;
  folderName: string;
  confidence: number;
  matchType: string;
}

/**
 * 记录指标的请求参数
 */
export interface RecordMetricsRequest {
  userId: string;
  modelId: EmbeddingModelId;
  modelName: string;
  dimensions?: number;
  operationType: ABTestOperationType;
  bookmarkId?: number;
  folderId?: number;
  executionTimeMs: number;
  tokenCount?: number;
  /** 使用规范的 ClassificationResultData 类型 */
  classificationResult?: ClassificationResultData;
  abTestGroup: ABTestGroup;
  abTestBucket: number;
}

/**
 * A/B 测试摘要数据
 */
export interface ABTestSummary {
  modelId: string;
  operationType: string;
  abTestGroup: string;
  totalCount: number;
  avgExecutionTimeMs: number;
  medianExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  avgTokenCount: number;
  acceptanceRate: number | null;
  feedbackCount: number;
  date: string;
}

/**
 * Embedding A/B Test Service
 */
export class EmbeddingABTestService {
  /**
   * 记录 A/B 测试指标
   */
  async recordMetrics(request: RecordMetricsRequest): Promise<void> {
    try {
      const supabase = await createClient();

      // V4.2 表
      const { error } = await supabase
        .from("embedding_ab_test_metrics")
        .insert({
          user_id: request.userId,
          model_id: request.modelId,
          model_name: request.modelName,
          dimensions: request.dimensions || 1024,
          operation_type: request.operationType,
          bookmark_id: request.bookmarkId,
          folder_id: request.folderId,
          execution_time_ms: request.executionTimeMs,
          token_count: request.tokenCount,
          classification_result: request.classificationResult
            ? JSON.stringify(request.classificationResult)
            : null,
          ab_test_group: request.abTestGroup,
          ab_test_bucket: request.abTestBucket,
        });

      if (error) {
        logger.error(
          { error: error.message, modelId: request.modelId },
          "EmbeddingABTest: Failed to record metrics",
        );
        // Don't throw - metrics recording should not block main flow
        return;
      }

      logger.debug(
        {
          userId: request.userId.slice(0, 8) + "...",
          modelId: request.modelId,
          operationType: request.operationType,
          abTestGroup: request.abTestGroup,
          executionTimeMs: request.executionTimeMs,
        },
        "EmbeddingABTest: Metrics recorded",
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "EmbeddingABTest: Exception while recording metrics",
      );
      // Don't throw - metrics recording should not block main flow
    }
  }

  /**
   * 更新用户反馈
   */
  async updateFeedback(
    metricsId: number,
    userId: string,
    feedback: "accept" | "reject" | "modify",
    feedbackFolderId?: number,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // V4.2 表
      const { error } = await supabase
        .from("embedding_ab_test_metrics")
        .update({
          user_feedback: feedback,
          feedback_folder_id: feedbackFolderId,
          feedback_at: new Date().toISOString(),
        })
        .eq("id", metricsId)
        .eq("user_id", userId);

      if (error) {
        logger.error(
          { error: error.message, metricsId },
          "EmbeddingABTest: Failed to update feedback",
        );
        return;
      }

      logger.info({ metricsId, feedback }, "EmbeddingABTest: Feedback updated");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "EmbeddingABTest: Exception while updating feedback",
      );
    }
  }

  /**
   * 获取 A/B 测试摘要
   */
  async getSummary(
    options: {
      modelIds?: EmbeddingModelId[];
      operationType?: ABTestOperationType;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<ABTestSummary[]> {
    try {
      const supabase = await createClient();

      // V4.2 视图
      let query = supabase.from("embedding_ab_test_summary").select("*");

      if (options.modelIds && options.modelIds.length > 0) {
        query = query.in("model_id", options.modelIds);
      }

      if (options.operationType) {
        query = query.eq("operation_type", options.operationType);
      }

      if (options.startDate) {
        query = query.gte("date", options.startDate.toISOString());
      }

      if (options.endDate) {
        query = query.lte("date", options.endDate.toISOString());
      }

      const { data, error } = await query.order("date", { ascending: false });

      if (error) {
        logger.error(
          { error: error.message },
          "EmbeddingABTest: Failed to get summary",
        );
        return [];
      }

      // 类型断言
      type SummaryRow = {
        model_id: string;
        operation_type: string;
        ab_test_group: string;
        total_count: number;
        avg_execution_time_ms: number;
        median_execution_time_ms: number;
        p95_execution_time_ms: number;
        avg_token_count: number;
        acceptance_rate: number | null;
        feedback_count: number;
        date: string;
      };

      return ((data || []) as SummaryRow[]).map((row: SummaryRow) => ({
        modelId: row.model_id,
        operationType: row.operation_type,
        abTestGroup: row.ab_test_group,
        totalCount: row.total_count,
        avgExecutionTimeMs: row.avg_execution_time_ms,
        medianExecutionTimeMs: row.median_execution_time_ms,
        p95ExecutionTimeMs: row.p95_execution_time_ms,
        avgTokenCount: row.avg_token_count,
        acceptanceRate: row.acceptance_rate,
        feedbackCount: row.feedback_count,
        date: row.date,
      }));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "EmbeddingABTest: Exception while getting summary",
      );
      return [];
    }
  }

  /**
   * 获取模型对比报告
   */
  async getComparisonReport(
    controlModelId: EmbeddingModelId,
    treatmentModelId: EmbeddingModelId,
    operationType: ABTestOperationType = "classification",
    days: number = 7,
  ): Promise<{
    control: {
      modelId: string;
      sampleSize: number;
      avgExecutionTimeMs: number;
      acceptanceRate: number | null;
      confidenceScore: number;
    };
    treatment: {
      modelId: string;
      sampleSize: number;
      avgExecutionTimeMs: number;
      acceptanceRate: number | null;
      confidenceScore: number;
    };
    comparison: {
      executionTimeDiff: number; // positive = treatment faster
      acceptanceRateDiff: number | null; // positive = treatment better
      isSignificant: boolean;
      recommendation: "control" | "treatment" | "inconclusive";
    };
  } | null> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const summaries = await this.getSummary({
        modelIds: [controlModelId, treatmentModelId],
        operationType,
        startDate,
      });

      if (summaries.length === 0) {
        return null;
      }

      // Aggregate by model
      const controlData = summaries.filter((s) => s.modelId === controlModelId);
      const treatmentData = summaries.filter(
        (s) => s.modelId === treatmentModelId,
      );

      const aggregateData = (data: ABTestSummary[]) => {
        const totalCount = data.reduce((sum, d) => sum + d.totalCount, 0);
        const totalFeedback = data.reduce((sum, d) => sum + d.feedbackCount, 0);
        const avgExecutionTime =
          totalCount > 0
            ? data.reduce(
                (sum, d) => sum + d.avgExecutionTimeMs * d.totalCount,
                0,
              ) / totalCount
            : 0;

        const acceptanceRateSum = data
          .filter((d) => d.acceptanceRate !== null)
          .reduce((sum, d) => sum + d.acceptanceRate! * d.feedbackCount, 0);
        const acceptanceRate =
          totalFeedback > 0 ? acceptanceRateSum / totalFeedback : null;

        return {
          sampleSize: totalCount,
          avgExecutionTimeMs: avgExecutionTime,
          acceptanceRate,
          feedbackCount: totalFeedback,
        };
      };

      const control = aggregateData(controlData);
      const treatment = aggregateData(treatmentData);

      // Calculate confidence score (simplified)
      const calculateConfidence = (sampleSize: number) => {
        if (sampleSize < 30) return 0.5;
        if (sampleSize < 100) return 0.7;
        if (sampleSize < 500) return 0.85;
        return 0.95;
      };

      const executionTimeDiff =
        control.avgExecutionTimeMs - treatment.avgExecutionTimeMs;
      const acceptanceRateDiff =
        control.acceptanceRate !== null && treatment.acceptanceRate !== null
          ? treatment.acceptanceRate - control.acceptanceRate
          : null;

      // Determine recommendation
      const minSampleSize = 50;
      const isSignificant =
        control.sampleSize >= minSampleSize &&
        treatment.sampleSize >= minSampleSize;

      let recommendation: "control" | "treatment" | "inconclusive" =
        "inconclusive";
      if (isSignificant) {
        // Treatment is recommended if:
        // 1. Acceptance rate is better (if available)
        // 2. Or execution time is better (if no acceptance data)
        if (acceptanceRateDiff !== null && acceptanceRateDiff > 0.05) {
          recommendation = "treatment";
        } else if (acceptanceRateDiff !== null && acceptanceRateDiff < -0.05) {
          recommendation = "control";
        } else if (executionTimeDiff > 50) {
          // treatment is 50ms faster
          recommendation = "treatment";
        } else if (executionTimeDiff < -50) {
          recommendation = "control";
        }
      }

      return {
        control: {
          modelId: controlModelId,
          sampleSize: control.sampleSize,
          avgExecutionTimeMs: control.avgExecutionTimeMs,
          acceptanceRate: control.acceptanceRate,
          confidenceScore: calculateConfidence(control.sampleSize),
        },
        treatment: {
          modelId: treatmentModelId,
          sampleSize: treatment.sampleSize,
          avgExecutionTimeMs: treatment.avgExecutionTimeMs,
          acceptanceRate: treatment.acceptanceRate,
          confidenceScore: calculateConfidence(treatment.sampleSize),
        },
        comparison: {
          executionTimeDiff,
          acceptanceRateDiff,
          isSignificant,
          recommendation,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "EmbeddingABTest: Exception while generating comparison report",
      );
      return null;
    }
  }
}

// Singleton instance
export const embeddingABTestService = new EmbeddingABTestService();
