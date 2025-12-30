/**
 * 分析器基类
 *
 * 所有分析器的抽象基类，提供通用功能
 *
 * @module ai-agent/async-analysis/analyzers
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import type {
  IAnalyzer,
  AnalyzerOutput,
  AsyncAnalysisTask,
  AnalysisTaskType,
} from "../types";

/**
 * 分析器基类
 *
 * 提供分析器的通用功能，包括：
 * - 日志记录
 * - 错误处理
 * - 执行计时
 */
export abstract class BaseAnalyzer implements IAnalyzer {
  abstract readonly type: AnalysisTaskType;

  /**
   * 执行分析
   *
   * 模板方法：包装具体分析逻辑，添加日志和计时
   */
  async analyze(task: AsyncAnalysisTask): Promise<AnalyzerOutput> {
    const startTime = Date.now();

    logger.info(
      {
        module: "AsyncAnalysis",
        taskId: task.id,
        type: this.type,
        userId: task.userId,
      },
      `Starting ${this.type} analysis`,
    );

    try {
      const result = await this.doAnalyze(task);

      const durationMs = Date.now() - startTime;
      logger.info(
        {
          module: "AsyncAnalysis",
          taskId: task.id,
          type: this.type,
          durationMs,
          insightCount: result.insights.length,
          actionCount: result.suggestedActions.length,
        },
        `Completed ${this.type} analysis`,
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error(
        {
          module: "AsyncAnalysis",
          taskId: task.id,
          type: this.type,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        },
        `Failed ${this.type} analysis`,
      );

      throw error;
    }
  }

  /**
   * 检查是否可以执行
   *
   * 默认实现：始终可执行
   * 子类可覆盖以添加前置条件检查
   */
  async canExecute(_task: AsyncAnalysisTask): Promise<boolean> {
    return true;
  }

  /**
   * 具体分析逻辑
   *
   * 由子类实现
   */
  protected abstract doAnalyze(
    task: AsyncAnalysisTask,
  ): Promise<AnalyzerOutput>;

  /**
   * 创建空结果
   *
   * 辅助方法，用于返回无洞察的结果
   */
  protected createEmptyResult(data: unknown = null): AnalyzerOutput {
    return {
      data,
      insights: [],
      suggestedActions: [],
    };
  }
}
