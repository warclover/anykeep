/**
 * Skill 执行流水线
 *
 * 5 阶段标准化执行流程：
 * 1. RESOLVE    - Skill 解析（从 ID 获取实例）
 * 2. VALIDATE   - 输入验证（复用 InputValidator）
 * 3. RISK_CHECK - 风险检查（复用 response-templates.ts）
 * 4. EXECUTE    - 执行（带取消检查）
 * 5. FORMAT     - 格式化输出
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import {
  InputValidator,
  type ValidationResult,
} from "../engine/input-validator";
import {
  getOperationRiskLevel,
  requiresConfirmation,
  type RiskLevel,
} from "@/lib/ai-agent/core/prompts/response-templates";
import type { OrchestrationSkill } from "../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../orchestration/types";
import {
  PipelineStage,
  type PipelineConfig,
  type PipelineContext,
  type PipelineEvent,
  type PipelineChunk,
  type PipelineStats,
  type StageStats,
  DEFAULT_PIPELINE_CONFIG,
} from "./types";
import {
  PipelineError,
  SkillNotFoundError,
  ValidationError,
  RiskConfirmationRequiredError,
  ExecutionTimeoutError,
  ExecutionCancelledError,
  ExecutionFailedError,
  PIPELINE_ERROR_CODES,
} from "./errors";

// ============================================
// 类型定义
// ============================================

/**
 * Skill 注册表接口
 */
export interface SkillRegistry {
  get(skillId: string): OrchestrationSkill | undefined;
  has(skillId: string): boolean;
}

/**
 * 流水线选项
 */
export interface PipelineOptions {
  /** Skill 注册表 */
  skillRegistry: SkillRegistry;
  /** 输入验证器（可选，使用默认） */
  inputValidator?: InputValidator;
  /** 是否启用详细日志 */
  verbose?: boolean;
}

// ============================================
// 核心实现
// ============================================

/**
 * Skill 执行流水线
 *
 * 提供标准化的 Skill 执行流程，包括：
 * - 统一的阶段管理
 * - 一致的错误处理
 * - 风险检查与确认
 * - 执行状态追踪
 *
 * @example
 * ```typescript
 * const pipeline = new SkillExecutionPipeline({
 *   skillRegistry: myRegistry,
 * });
 *
 * for await (const chunk of pipeline.execute('knowledge_review', '帮我复习', context)) {
 *   if (isPipelineEvent(chunk)) {
 *     console.log(`Stage: ${chunk.stage}, Status: ${chunk.status}`);
 *   } else {
 *     // 处理 Skill 输出
 *   }
 * }
 * ```
 */
export class SkillExecutionPipeline {
  private skillRegistry: SkillRegistry;
  private inputValidator: InputValidator;
  private verbose: boolean;

  constructor(options: PipelineOptions) {
    this.skillRegistry = options.skillRegistry;
    this.inputValidator = options.inputValidator ?? new InputValidator();
    this.verbose = options.verbose ?? false;
  }

  /**
   * 执行 Skill
   *
   * @param skillId - Skill ID
   * @param input - 用户输入
   * @param context - 执行上下文
   * @yields 流水线事件或 Skill 输出块
   */
  async *execute(
    skillId: string,
    input: string,
    context: PipelineContext,
  ): AsyncGenerator<PipelineChunk> {
    const config = { ...DEFAULT_PIPELINE_CONFIG, ...context.config };
    const stats = this.createStats();

    try {
      // ① RESOLVE - Skill 解析
      const skill = yield* this.resolveStage(skillId, stats, context.traceId);

      // ② VALIDATE - 输入验证
      let sanitizedInput = input;
      if (!config.skipValidation) {
        const validationResult = yield* this.validateStage(
          input,
          stats,
          context.traceId,
        );
        sanitizedInput = validationResult.sanitizedInput;
      } else {
        this.skipStage(PipelineStage.VALIDATE, stats, context.traceId);
      }

      // ③ RISK_CHECK - 风险评估
      if (!config.skipRiskCheck) {
        yield* this.riskCheckStage(
          skillId,
          config.affectedCount,
          config.userConfirmed,
          stats,
          context.traceId,
        );
      } else {
        this.skipStage(PipelineStage.RISK_CHECK, stats, context.traceId);
      }

      // ④ EXECUTE - 执行
      yield* this.executeStage(skill, sanitizedInput, context, config, stats);

      // ⑤ FORMAT - 格式化（完成标记）
      yield* this.formatStage(stats, context.traceId);

      // 更新统计
      stats.success = true;
      stats.endTime = Date.now();
      stats.totalDurationMs = stats.endTime - stats.startTime;
    } catch (error) {
      // 处理错误
      stats.success = false;
      stats.endTime = Date.now();
      stats.totalDurationMs = stats.endTime - stats.startTime;

      if (error instanceof PipelineError) {
        stats.failedStage = error.stage;
        yield this.createErrorEvent(error, context.traceId);
      } else {
        const pipelineError = new ExecutionFailedError(
          error instanceof Error ? error.message : "未知错误",
          error instanceof Error ? error : undefined,
        );
        stats.failedStage = PipelineStage.EXECUTE;
        yield this.createErrorEvent(pipelineError, context.traceId);
      }
    }

    // 记录执行统计
    if (this.verbose) {
      logger.debug(
        {
          traceId: context.traceId,
          skillId,
          stats,
        },
        "Pipeline execution completed",
      );
    }
  }

  // ============================================
  // 阶段实现
  // ============================================

  /**
   * 解析阶段 - 从 ID 查找 Skill 实例
   */
  private *resolveStage(
    skillId: string,
    stats: PipelineStats,
    traceId: string,
  ): Generator<PipelineEvent, OrchestrationSkill> {
    const stageStats = this.startStage(PipelineStage.RESOLVE, stats);

    // 发出开始事件
    yield this.createStageEvent(PipelineStage.RESOLVE, "running", traceId, {
      skillId,
    });

    // 查找 Skill
    const skill = this.skillRegistry.get(skillId);
    if (!skill) {
      this.failStage(stageStats);
      throw new SkillNotFoundError(skillId);
    }

    // 完成阶段
    this.completeStage(stageStats);

    yield this.createStageEvent(
      PipelineStage.RESOLVE,
      "completed",
      traceId,
      { skillId },
      stageStats.durationMs,
    );

    return skill;
  }

  /**
   * 验证阶段 - 输入验证与清洗
   */
  private *validateStage(
    input: string,
    stats: PipelineStats,
    traceId: string,
  ): Generator<PipelineEvent, ValidationResult> {
    const stageStats = this.startStage(PipelineStage.VALIDATE, stats);

    yield this.createStageEvent(PipelineStage.VALIDATE, "running", traceId);

    const result = this.inputValidator.validate(input);

    if (!result.valid) {
      this.failStage(stageStats);
      throw new ValidationError(
        result.error || "输入验证失败",
        PIPELINE_ERROR_CODES.VALIDATION_FAILED,
        result.warnings,
      );
    }

    this.completeStage(stageStats);

    yield this.createStageEvent(
      PipelineStage.VALIDATE,
      "completed",
      traceId,
      { validationWarnings: result.warnings },
      stageStats.durationMs,
    );

    return result;
  }

  /**
   * 风险检查阶段 - 风险评估与确认
   */
  private *riskCheckStage(
    skillId: string,
    affectedCount: number,
    userConfirmed: boolean,
    stats: PipelineStats,
    traceId: string,
  ): Generator<PipelineEvent, void> {
    const stageStats = this.startStage(PipelineStage.RISK_CHECK, stats);

    yield this.createStageEvent(PipelineStage.RISK_CHECK, "running", traceId);

    // 评估风险级别
    const riskLevel = getOperationRiskLevel(skillId);
    const needsConfirmation = requiresConfirmation(skillId, affectedCount);

    // 如果需要确认且用户未确认
    if (needsConfirmation && !userConfirmed) {
      this.failStage(stageStats);

      // 发出需要确认事件
      yield this.createStageEvent(
        PipelineStage.RISK_CHECK,
        "needs_confirmation",
        traceId,
        {
          riskLevel,
          requiresConfirmation: true,
          affectedCount,
          confirmationOptions: this.buildConfirmationOptions(
            skillId,
            riskLevel,
            affectedCount,
          ),
        },
        stageStats.durationMs,
      );

      throw new RiskConfirmationRequiredError(
        `此操作影响 ${affectedCount} 条内容，需要确认`,
        riskLevel === "high" ? "high" : "medium",
        affectedCount,
      );
    }

    this.completeStage(stageStats);

    yield this.createStageEvent(
      PipelineStage.RISK_CHECK,
      "completed",
      traceId,
      {
        riskLevel,
        requiresConfirmation: false,
      },
      stageStats.durationMs,
    );
  }

  /**
   * 执行阶段 - 执行 Skill + 取消检查
   */
  private async *executeStage(
    skill: OrchestrationSkill,
    input: string,
    context: PipelineContext,
    config: Required<PipelineConfig>,
    stats: PipelineStats,
  ): AsyncGenerator<PipelineChunk> {
    const stageStats = this.startStage(PipelineStage.EXECUTE, stats);

    yield this.createStageEvent(
      PipelineStage.EXECUTE,
      "running",
      context.traceId,
      { skillId: skill.metadata.id },
    );

    // 构建编排上下文
    const orchestrationContext: OrchestrationContext = {
      userId: context.userId,
      traceId: context.traceId,
      params: null,
      originalMessage: input,
      cancellationToken: context.cancellationToken,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      folderId: context.folderId,
    };

    try {
      // 解析输入参数
      const params = await skill.parseInput(input, orchestrationContext);
      orchestrationContext.params = params;

      // 设置超时
      const timeoutPromise = this.createTimeoutPromise(config.timeoutMs);

      // 执行 Skill
      const executeGenerator = skill.executeStream(orchestrationContext);

      for await (const chunk of this.raceWithTimeout(
        executeGenerator,
        timeoutPromise,
        context,
      )) {
        // 检查取消
        if (context.cancellationToken?.isCancelled) {
          throw new ExecutionCancelledError(context.cancellationToken.reason);
        }

        // 检查中止信号
        if (context.signal?.aborted) {
          throw new ExecutionCancelledError("请求被中止");
        }

        yield chunk;
      }

      this.completeStage(stageStats);

      yield this.createStageEvent(
        PipelineStage.EXECUTE,
        "completed",
        context.traceId,
        { skillId: skill.metadata.id },
        stageStats.durationMs,
      );
    } catch (error) {
      this.failStage(stageStats);

      if (error instanceof PipelineError) {
        throw error;
      }

      if (error instanceof Error && error.message === "TIMEOUT") {
        throw new ExecutionTimeoutError(config.timeoutMs);
      }

      throw new ExecutionFailedError(
        error instanceof Error ? error.message : "执行失败",
        error instanceof Error ? error : undefined,
        false,
      );
    }
  }

  /**
   * 格式化阶段 - 完成标记
   */
  private *formatStage(
    stats: PipelineStats,
    traceId: string,
  ): Generator<PipelineEvent> {
    const stageStats = this.startStage(PipelineStage.FORMAT, stats);

    yield this.createStageEvent(PipelineStage.FORMAT, "running", traceId);

    this.completeStage(stageStats);

    yield this.createStageEvent(
      PipelineStage.FORMAT,
      "completed",
      traceId,
      undefined,
      stageStats.durationMs,
    );
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 创建统计对象
   */
  private createStats(): PipelineStats {
    return {
      startTime: Date.now(),
      stages: [],
    };
  }

  /**
   * 开始阶段
   */
  private startStage(stage: PipelineStage, stats: PipelineStats): StageStats {
    const stageStats: StageStats = {
      stage,
      status: "running",
      startTime: Date.now(),
    };
    stats.stages.push(stageStats);
    return stageStats;
  }

  /**
   * 完成阶段
   */
  private completeStage(stageStats: StageStats): void {
    stageStats.status = "completed";
    stageStats.endTime = Date.now();
    stageStats.durationMs = stageStats.endTime - stageStats.startTime;
  }

  /**
   * 阶段失败
   */
  private failStage(stageStats: StageStats): void {
    stageStats.status = "failed";
    stageStats.endTime = Date.now();
    stageStats.durationMs = stageStats.endTime - stageStats.startTime;
  }

  /**
   * 跳过阶段
   */
  private skipStage(
    stage: PipelineStage,
    stats: PipelineStats,
    traceId: string,
  ): void {
    const stageStats: StageStats = {
      stage,
      status: "skipped",
      startTime: Date.now(),
      endTime: Date.now(),
      durationMs: 0,
    };
    stats.stages.push(stageStats);

    if (this.verbose) {
      logger.debug({ stage, traceId }, "Pipeline stage skipped");
    }
  }

  /**
   * 创建阶段事件
   */
  private createStageEvent(
    stage: PipelineStage,
    status: PipelineEvent["status"],
    traceId: string,
    data?: PipelineEvent["data"],
    durationMs?: number,
  ): PipelineEvent {
    return {
      type: "pipeline",
      stage,
      status,
      timestamp: Date.now(),
      traceId,
      durationMs,
      data,
    };
  }

  /**
   * 创建错误事件
   */
  private createErrorEvent(
    error: PipelineError,
    traceId: string,
  ): PipelineEvent {
    return {
      type: "pipeline",
      stage: error.stage,
      status: "failed",
      timestamp: Date.now(),
      traceId,
      data: {
        error: error.message,
        errorCode: error.code,
        retryable: error.retryable,
      },
    };
  }

  /**
   * 构建确认选项
   */
  private buildConfirmationOptions(
    skillId: string,
    riskLevel: RiskLevel,
    affectedCount: number,
  ) {
    const isHighRisk = riskLevel === "high";

    return {
      title: isHighRisk ? "⚠️ 高风险操作确认" : "操作确认",
      message: `即将执行 ${skillId}，影响 ${affectedCount} 条内容`,
      options: [
        {
          id: "confirm",
          label: "确认执行",
          primary: true,
          danger: isHighRisk,
        },
        {
          id: "cancel",
          label: "取消",
        },
      ],
    };
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("TIMEOUT"));
      }, timeoutMs);
    });
  }

  /**
   * 与超时竞争执行
   */
  private async *raceWithTimeout<T>(
    generator: AsyncGenerator<T>,
    timeoutPromise: Promise<never>,
    context: PipelineContext,
  ): AsyncGenerator<T> {
    while (true) {
      const result = await Promise.race([generator.next(), timeoutPromise]);

      if (result.done) {
        return;
      }

      yield result.value;

      // 检查取消
      if (context.cancellationToken?.isCancelled || context.signal?.aborted) {
        return;
      }
    }
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建流水线实例
 */
export function createSkillExecutionPipeline(
  options: PipelineOptions,
): SkillExecutionPipeline {
  return new SkillExecutionPipeline(options);
}
