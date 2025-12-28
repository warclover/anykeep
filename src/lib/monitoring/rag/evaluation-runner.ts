/**
 * RAG 评估运行器
 *
 * 负责执行评估流程，生成评估报告
 *
 * @module monitoring/rag/evaluation-runner
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type {
  EvaluationTestCase,
  RAGResponse,
  EvaluationResult,
  EvaluationReport,
} from "./types";
import {
  RAGMetricsCalculator,
  calculateStatistics,
  calculatePercentile,
} from "./metrics-calculator";

/**
 * 评估运行配置
 */
export interface EvaluationRunConfig {
  /** 并发数 */
  concurrency: number;
  /** 超时时间（毫秒） */
  timeoutMs: number;
  /** 是否保存详细结果 */
  saveDetails: boolean;
  /** 失败重试次数 */
  retryCount: number;
}

/**
 * 默认配置
 */
const DEFAULT_RUN_CONFIG: EvaluationRunConfig = {
  concurrency: 3,
  timeoutMs: 30000,
  saveDetails: true,
  retryCount: 1,
};

/**
 * 搜索函数类型
 */
export type SearchFunction = (query: string) => Promise<RAGResponse>;

/**
 * RAG 评估运行器
 */
export class EvaluationRunner {
  private calculator: RAGMetricsCalculator;
  private config: EvaluationRunConfig;

  constructor(config?: Partial<EvaluationRunConfig>) {
    this.calculator = new RAGMetricsCalculator();
    this.config = { ...DEFAULT_RUN_CONFIG, ...config };
  }

  /**
   * 运行评估
   *
   * @param testCases - 测试用例列表
   * @param searchFn - 搜索函数，用于获取 RAG 响应
   * @returns 评估报告
   */
  async run(
    testCases: EvaluationTestCase[],
    searchFn: SearchFunction,
  ): Promise<EvaluationReport> {
    const reportId = `eval-${Date.now()}`;
    const startTime = Date.now();

    logger.info(
      { reportId, testCaseCount: testCases.length },
      "EvaluationRunner: Starting evaluation",
    );

    const results: EvaluationResult[] = [];
    const failures: Array<{ testCaseId: string; error: string }> = [];

    // 分批执行
    const batches = this.chunkArray(testCases, this.config.concurrency);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      logger.debug(
        {
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSize: batch.length,
        },
        "EvaluationRunner: Processing batch",
      );

      const batchResults = await Promise.all(
        batch.map((testCase) =>
          this.evaluateWithRetry(testCase, searchFn, this.config.retryCount),
        ),
      );

      for (const result of batchResults) {
        if (result.success && result.result) {
          results.push(result.result);
        } else {
          failures.push({
            testCaseId: result.testCaseId,
            error: result.error || "Unknown error",
          });
        }
      }
    }

    // 计算聚合分数
    const aggregateScores = this.calculateAggregateScores(results);

    // 计算性能统计
    const latencies = results.map((r) => r.response.latencyMs);
    const performanceStats = {
      avgLatencyMs:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      p50LatencyMs: calculatePercentile(latencies, 50),
      p95LatencyMs: calculatePercentile(latencies, 95),
      p99LatencyMs: calculatePercentile(latencies, 99),
    };

    const report: EvaluationReport = {
      reportId,
      createdAt: new Date().toISOString(),
      totalCases: testCases.length,
      successCount: results.length,
      failureCount: failures.length,
      aggregateScores,
      results: this.config.saveDetails ? results : [],
      performanceStats,
    };

    const duration = Date.now() - startTime;
    logger.info(
      {
        reportId,
        successCount: results.length,
        failureCount: failures.length,
        durationMs: duration,
        aggregateScores: {
          faithfulness: aggregateScores.faithfulness.mean.toFixed(3),
          answerRelevancy: aggregateScores.answerRelevancy.mean.toFixed(3),
          contextPrecision: aggregateScores.contextPrecision.mean.toFixed(3),
          contextRecall: aggregateScores.contextRecall.mean.toFixed(3),
        },
      },
      "EvaluationRunner: Evaluation completed",
    );

    return report;
  }

  /**
   * 带重试的评估执行
   */
  private async evaluateWithRetry(
    testCase: EvaluationTestCase,
    searchFn: SearchFunction,
    retriesLeft: number,
  ): Promise<{
    testCaseId: string;
    success: boolean;
    result?: EvaluationResult;
    error?: string;
  }> {
    try {
      // 带超时的搜索
      const response = await this.withTimeout(
        searchFn(testCase.query),
        this.config.timeoutMs,
      );

      // 计算评估指标
      const result = this.calculator.evaluate(testCase, response);

      return {
        testCaseId: testCase.id,
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (retriesLeft > 0) {
        logger.warn(
          { testCaseId: testCase.id, retriesLeft, error: errorMessage },
          "EvaluationRunner: Retrying failed test case",
        );

        // 等待一小段时间后重试
        await this.sleep(1000);
        return this.evaluateWithRetry(testCase, searchFn, retriesLeft - 1);
      }

      logger.error(
        { testCaseId: testCase.id, error: errorMessage },
        "EvaluationRunner: Test case failed after retries",
      );

      return {
        testCaseId: testCase.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 计算聚合分数
   */
  private calculateAggregateScores(
    results: EvaluationResult[],
  ): EvaluationReport["aggregateScores"] {
    const faithfulnessScores = results.map((r) => r.scores.faithfulness);
    const relevancyScores = results.map((r) => r.scores.answerRelevancy);
    const precisionScores = results.map((r) => r.scores.contextPrecision);
    const recallScores = results.map((r) => r.scores.contextRecall);

    return {
      faithfulness: calculateStatistics(faithfulnessScores),
      answerRelevancy: calculateStatistics(relevancyScores),
      contextPrecision: calculateStatistics(precisionScores),
      contextRecall: calculateStatistics(recallScores),
    };
  }

  /**
   * 带超时的 Promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 格式化评估报告为可读文本
 */
export function formatReportAsText(report: EvaluationReport): string {
  const lines: string[] = [
    "=".repeat(60),
    "RAG 评估报告",
    "=".repeat(60),
    "",
    `报告 ID: ${report.reportId}`,
    `生成时间: ${report.createdAt}`,
    "",
    "--- 测试概览 ---",
    `总用例数: ${report.totalCases}`,
    `成功: ${report.successCount}`,
    `失败: ${report.failureCount}`,
    `成功率: ${((report.successCount / report.totalCases) * 100).toFixed(1)}%`,
    "",
    "--- 质量指标 ---",
    `Faithfulness (忠实度):     ${formatScore(report.aggregateScores.faithfulness)}`,
    `Answer Relevancy (相关性): ${formatScore(report.aggregateScores.answerRelevancy)}`,
    `Context Precision (精确度): ${formatScore(report.aggregateScores.contextPrecision)}`,
    `Context Recall (召回率):   ${formatScore(report.aggregateScores.contextRecall)}`,
    "",
    "--- 性能指标 ---",
    `平均延迟: ${report.performanceStats.avgLatencyMs.toFixed(0)}ms`,
    `P50 延迟: ${report.performanceStats.p50LatencyMs.toFixed(0)}ms`,
    `P95 延迟: ${report.performanceStats.p95LatencyMs.toFixed(0)}ms`,
    `P99 延迟: ${report.performanceStats.p99LatencyMs.toFixed(0)}ms`,
    "",
    "=".repeat(60),
  ];

  return lines.join("\n");
}

/**
 * 格式化分数
 */
function formatScore(stat: {
  mean: number;
  min: number;
  max: number;
  std: number;
}): string {
  return `${(stat.mean * 100).toFixed(1)}% (min: ${(stat.min * 100).toFixed(1)}%, max: ${(stat.max * 100).toFixed(1)}%, std: ${(stat.std * 100).toFixed(1)}%)`;
}

// 单例导出
let runnerInstance: EvaluationRunner | null = null;

export function getEvaluationRunner(
  config?: Partial<EvaluationRunConfig>,
): EvaluationRunner {
  if (!runnerInstance || config) {
    runnerInstance = new EvaluationRunner(config);
  }
  return runnerInstance;
}
