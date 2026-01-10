/**
 * OrchestrationSkill - 编排 Skill 基类
 *
 * 继承自 BaseSkill，扩展多步骤编排能力：
 * - 流式执行支持
 * - 进度报告
 * - 确认请求
 * - 交付物生成
 * - 原子 Skill 和 Tool 调用
 * - 事件发布（P2 增强）
 *
 * @version 1.1.0
 * @since 2025-12-24
 */

import { BaseSkill } from "../core/base-skill";
import type { SkillContext, ISkill } from "../core/types";
import { logger } from "@/lib/logger";
import { SkillEventEmitter } from "../events/skill-event-emitter";
import type {
  OrchestrationStreamChunk,
  DeliverableType,
  OutputFormat,
  ConfirmOption,
  HeartbeatChunk,
} from "../output/types";
import type {
  OrchestrationContext,
  OrchestrationSkillMetadata,
  ConfirmationOptions,
  Deliverable,
  StepDefinition,
  ProgressState,
  ToolContext,
  ToolResult,
} from "./types";
import type { ConfirmationResult } from "./confirmation-handler";

/**
 * 编排 Skill 基类
 *
 * @example
 * ```typescript
 * class KnowledgeReviewSkill extends OrchestrationSkill<
 *   KnowledgeReviewInput,
 *   KnowledgeReviewOutput
 * > {
 *   readonly metadata = {
 *     id: 'knowledge_review',
 *     name: '知识回顾助手',
 *     // ...
 *   };
 *
 *   async parseInput(message: string, context: OrchestrationContext) {
 *     // 解析自然语言输入
 *   }
 *
 *   async *executeStream(context: OrchestrationContext) {
 *     // 流式执行
 *     yield* this.reportProgress('分析', 10, '正在分析收藏数据...');
 *     // ...
 *   }
 * }
 * ```
 */
export abstract class OrchestrationSkill<TInput = unknown, TOutput = unknown>
  extends BaseSkill<TInput, TOutput>
  implements ISkill<TInput, TOutput>
{
  /** 编排 Skill 元数据 */
  abstract readonly metadata: OrchestrationSkillMetadata;

  /** 进度状态 */
  protected progressState: ProgressState | null = null;

  /** 交付物 ID 计数器 */
  private deliverableIdCounter = 0;

  /** 事件发射器（P2 增强） */
  protected eventEmitter: SkillEventEmitter | null = null;

  /** 当前执行上下文的用户 ID（用于事件发射） */
  private currentUserId: string | null = null;

  // ============================================
  // Phase 3.1: 心跳机制
  // ============================================

  /** 心跳定时器 */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** 心跳开始时间 */
  private heartbeatStartTime: number = 0;

  /** 心跳回调函数 */
  private heartbeatCallback:
    | ((chunk: HeartbeatChunk) => void | Promise<void>)
    | null = null;

  /** 默认心跳间隔（毫秒） */
  protected static readonly DEFAULT_HEARTBEAT_INTERVAL_MS = 500;

  // ============================================
  // Phase 3.2: ETA 估算辅助方法
  // ============================================

  /**
   * 计算 ETA（估计剩余时间）
   *
   * 基于已完成进度和已用时间进行线性估算
   *
   * @param startTime - 开始时间戳
   * @returns ETA 毫秒数和格式化字符串
   */
  private calculateEta(startTime: number): {
    etaMs: number | undefined;
    etaFormatted: string | undefined;
  } {
    const percent = this.progressState?.percent || 0;

    // 进度过低时不进行估算（避免不准确）
    if (percent < 5) {
      return { etaMs: undefined, etaFormatted: undefined };
    }

    const elapsedMs = Date.now() - startTime;

    // 避免除零
    if (percent <= 0 || elapsedMs <= 0) {
      return { etaMs: undefined, etaFormatted: undefined };
    }

    // 线性估算：已用时间 / 已完成比例 * 剩余比例
    const remainingPercent = 100 - percent;
    const estimatedTotalMs = (elapsedMs / percent) * 100;
    const etaMs = Math.round((estimatedTotalMs * remainingPercent) / 100);

    // 限制最大 ETA 为 30 分钟
    const cappedEtaMs = Math.min(etaMs, 30 * 60 * 1000);

    return {
      etaMs: cappedEtaMs,
      etaFormatted: this.formatEta(cappedEtaMs),
    };
  }

  /**
   * 格式化剩余时间为人类可读的字符串
   *
   * @param etaMs - 剩余时间（毫秒）
   * @returns 格式化的字符串
   */
  private formatEta(etaMs: number): string {
    const seconds = Math.ceil(etaMs / 1000);

    if (seconds < 5) {
      return "即将完成";
    }

    if (seconds < 60) {
      // 四舍五入到 5 秒
      const rounded = Math.ceil(seconds / 5) * 5;
      return `约 ${rounded} 秒`;
    }

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) {
      return `约 ${minutes} 分钟`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `约 ${hours} 小时 ${remainingMinutes} 分钟`;
    }
    return `约 ${hours} 小时`;
  }

  /**
   * 初始化事件发射器
   *
   * 子类可在 executeStream 开始时调用，启用事件发布
   */
  protected initEventEmitter(userId: string): void {
    this.currentUserId = userId;
    this.eventEmitter = new SkillEventEmitter(
      this.metadata.id,
      this.metadata.name,
    );
  }

  /**
   * 解析自然语言输入为结构化参数
   *
   * 子类必须实现此方法，将用户的自然语言输入转换为 Skill 所需的结构化参数
   *
   * @param message - 用户输入的原始消息
   * @param context - 编排执行上下文
   * @returns 结构化的输入参数
   */
  abstract parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<TInput>;

  /**
   * 流式执行 Skill
   *
   * 子类必须实现此方法，返回一个异步生成器，逐步产生输出块
   *
   * @param context - 编排执行上下文
   * @yields 输出块
   */
  abstract executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk>;

  /**
   * 初始化进度状态
   *
   * @param steps - 步骤定义列表
   */
  protected initProgress(steps: StepDefinition[]): void {
    this.progressState = {
      currentStepIndex: 0,
      currentStep: steps[0]?.name || "开始",
      percent: 0,
      steps,
      startTime: Date.now(),
    };

    // 发射执行开始事件（P2 增强）
    if (this.eventEmitter && this.currentUserId) {
      this.eventEmitter.emitExecutionStarted({
        userId: this.currentUserId,
        mode: "orchestration",
        estimatedSteps: steps.length,
      });
    }
  }

  // ============================================
  // Phase 3.1: 心跳方法
  // ============================================

  /**
   * 启动心跳
   *
   * 在长时间运行的操作前调用，每隔指定间隔发送心跳
   * 表明系统仍在运行，防止前端超时或误以为系统崩溃
   *
   * @param callback - 心跳回调函数，接收 HeartbeatChunk
   * @param intervalMs - 心跳间隔（毫秒），默认 500ms
   */
  protected startHeartbeat(
    callback: (chunk: HeartbeatChunk) => void | Promise<void>,
    intervalMs: number = OrchestrationSkill.DEFAULT_HEARTBEAT_INTERVAL_MS,
  ): void {
    // 确保没有重复的心跳
    this.stopHeartbeat();

    this.heartbeatCallback = callback;
    this.heartbeatStartTime = Date.now();

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      // Phase 3.2: 计算 ETA
      const { etaMs, etaFormatted } = this.calculateEta(
        this.heartbeatStartTime,
      );
      const chunk: HeartbeatChunk = {
        type: "heartbeat",
        data: {
          currentStep: this.progressState?.currentStep || "处理中",
          percent: this.progressState?.percent || 0,
          timestamp: now,
          elapsedMs: now - this.heartbeatStartTime,
          // Phase 3.2: ETA 估算
          etaMs,
          etaFormatted,
        },
      };

      // 调用回调（支持异步）
      if (this.heartbeatCallback) {
        const result = this.heartbeatCallback(chunk);
        // 如果是 Promise，不等待（fire-and-forget）
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.warn(
              { error: error instanceof Error ? error.message : String(error) },
              "OrchestrationSkill: Heartbeat callback error",
            );
          });
        }
      }
    }, intervalMs);

    logger.debug(
      {
        skillId: this.metadata.id,
        intervalMs,
      },
      "OrchestrationSkill: Heartbeat started",
    );
  }

  /**
   * 停止心跳
   *
   * 在操作完成、出错或取消时调用
   */
  protected stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;

      logger.debug(
        {
          skillId: this.metadata.id,
          elapsedMs: Date.now() - this.heartbeatStartTime,
        },
        "OrchestrationSkill: Heartbeat stopped",
      );
    }

    this.heartbeatCallback = null;
  }

  /**
   * 检查心跳是否正在运行
   */
  protected isHeartbeatRunning(): boolean {
    return this.heartbeatInterval !== null;
  }

  /**
   * 创建心跳生成器包装器
   *
   * 用于将异步生成器包装，在迭代过程中自动发送心跳
   *
   * @param generator - 原始异步生成器
   * @param heartbeatIntervalMs - 心跳间隔
   * @yields 原始块 + 心跳块
   */
  protected async *withHeartbeat<T>(
    generator: AsyncGenerator<T>,
    heartbeatIntervalMs: number = OrchestrationSkill.DEFAULT_HEARTBEAT_INTERVAL_MS,
  ): AsyncGenerator<T | HeartbeatChunk> {
    let lastHeartbeat = Date.now();
    const startTime = Date.now();

    for await (const chunk of generator) {
      yield chunk;

      // 检查是否需要发送心跳
      const now = Date.now();
      if (now - lastHeartbeat >= heartbeatIntervalMs) {
        // Phase 3.2: 计算 ETA
        const { etaMs, etaFormatted } = this.calculateEta(startTime);
        yield {
          type: "heartbeat",
          data: {
            currentStep: this.progressState?.currentStep || "处理中",
            percent: this.progressState?.percent || 0,
            timestamp: now,
            elapsedMs: now - startTime,
            // Phase 3.2: ETA 估算
            etaMs,
            etaFormatted,
          },
        } as HeartbeatChunk;
        lastHeartbeat = now;
      }
    }
  }

  /**
   * 报告进度（生成器方法）
   *
   * @param step - 当前步骤名称
   * @param percent - 进度百分比
   * @param message - 进度消息
   * @yields 进度输出块
   */
  protected *reportProgress(
    step: string,
    percent: number,
    message?: string,
  ): Generator<OrchestrationStreamChunk> {
    // 更新进度状态
    const previousStepIndex = this.progressState?.currentStepIndex ?? -1;
    let newStepIndex = -1;

    if (this.progressState) {
      const stepIndex = this.progressState.steps.findIndex(
        (s) => s.name === step || s.id === step,
      );
      if (stepIndex >= 0) {
        newStepIndex = stepIndex;
        this.progressState.currentStepIndex = stepIndex;
      }
      this.progressState.currentStep = step;
      this.progressState.percent = percent;
      this.progressState.message = message;
    }

    // 发射步骤事件（P2 增强）
    if (this.eventEmitter && this.currentUserId && this.progressState) {
      const totalSteps = this.progressState.steps.length;

      // 如果步骤索引变化，说明进入了新步骤
      if (newStepIndex >= 0 && newStepIndex !== previousStepIndex) {
        // 先完成上一个步骤（如果有）
        if (previousStepIndex >= 0) {
          const prevStep = this.progressState.steps[previousStepIndex];
          if (prevStep) {
            this.eventEmitter.emitStepCompleted({
              userId: this.currentUserId,
              stepIndex: previousStepIndex,
              stepId: prevStep.id || `step-${previousStepIndex}`,
              stepName: prevStep.name,
              success: true,
              progressPercent: percent,
            });
          }
        }

        // 开始新步骤
        const currentStep = this.progressState.steps[newStepIndex];
        if (currentStep) {
          this.eventEmitter.emitStepStarted({
            userId: this.currentUserId,
            stepIndex: newStepIndex,
            stepId: currentStep.id || `step-${newStepIndex}`,
            stepName: currentStep.name,
            totalSteps,
          });
        }
      }
    }

    yield {
      type: "progress",
      data: {
        step,
        percent: Math.round(Math.max(0, Math.min(100, percent))),
        message: message || step,
        timestamp: Date.now(),
        stepIndex: this.progressState?.currentStepIndex,
        totalSteps: this.progressState?.steps.length,
      },
    };
  }

  /**
   * 输出文本（生成器方法）
   *
   * @param text - 文本内容
   * @param isPartial - 是否为部分文本
   * @yields 文本输出块
   */
  protected *emitText(
    text: string,
    isPartial = false,
  ): Generator<OrchestrationStreamChunk> {
    yield {
      type: "text",
      data: {
        text,
        isPartial,
      },
    };
  }

  /**
   * 请求用户确认
   *
   * @param options - 确认选项
   * @returns 确认结果（如果有确认回调）
   */
  protected async requestConfirmation(
    options: Omit<ConfirmationOptions, "id">,
    context: OrchestrationContext,
  ): Promise<ConfirmationResult | null> {
    const id = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullOptions: ConfirmationOptions = { ...options, id };

    // 如果有确认回调，等待用户响应
    if (context.onConfirmation) {
      const response = await context.onConfirmation(fullOptions);
      const confirmed = response.selectedOption !== "cancel";
      return {
        confirmed,
        selectedOption: response.selectedOption,
        status: confirmed ? "confirmed" : "cancelled",
        data: response.data,
      };
    }

    // 没有回调时，返回 null（调用方需要通过 yield 发送确认请求）
    return null;
  }

  /**
   * 生成确认请求块（生成器方法）
   *
   * @param title - 确认标题
   * @param message - 确认消息
   * @param options - 确认选项
   * @param preview - 预览数据
   * @yields 确认请求输出块
   */
  protected *emitConfirmation(
    title: string,
    message: string,
    options: ConfirmOption[],
    preview?: unknown,
  ): Generator<OrchestrationStreamChunk> {
    const id = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    yield {
      type: "confirmation",
      data: {
        id,
        title,
        message,
        options,
        preview,
      },
    };
  }

  /**
   * 生成交付物
   *
   * @param type - 交付物类型
   * @param title - 交付物标题
   * @param content - 交付物内容
   * @param format - 输出格式
   * @param options - 其他选项
   * @returns 交付物对象
   */
  protected createDeliverable(
    type: DeliverableType,
    title: string,
    content: unknown,
    format: OutputFormat,
    options: {
      downloadable?: boolean;
      shareable?: boolean;
      metadata?: Record<string, unknown>;
    } = {},
  ): Deliverable {
    this.deliverableIdCounter++;
    const id = `deliverable-${this.metadata.id}-${this.deliverableIdCounter}`;

    return {
      id,
      type,
      title,
      format,
      content,
      downloadable: options.downloadable ?? true,
      shareable: options.shareable ?? true,
      metadata: {
        ...options.metadata,
        skillId: this.metadata.id, // 自动添加 skillId 便于前端识别
      },
      createdAt: new Date(),
    };
  }

  /**
   * 输出交付物（生成器方法）
   *
   * @param deliverable - 交付物对象
   * @yields 交付物输出块
   */
  protected *emitDeliverable(
    deliverable: Deliverable,
  ): Generator<OrchestrationStreamChunk> {
    // 发射交付物创建事件（P2 增强）
    if (this.eventEmitter && this.currentUserId) {
      this.eventEmitter.emitDeliverableCreated({
        userId: this.currentUserId,
        deliverableId: deliverable.id,
        deliverableType: deliverable.type,
        format: deliverable.format,
        downloadable: deliverable.downloadable ?? true,
        shareable: deliverable.shareable ?? true,
      });
    }

    yield {
      type: "deliverable",
      data: {
        id: deliverable.id,
        type: deliverable.type,
        title: deliverable.title,
        format: deliverable.format,
        content: deliverable.content,
        downloadable: deliverable.downloadable,
        shareable: deliverable.shareable,
        metadata: deliverable.metadata,
      },
    };
  }

  /**
   * 输出后续建议（生成器方法）
   *
   * @param suggestions - 建议列表
   * @yields 建议输出块
   */
  protected *emitSuggestions(
    suggestions: Array<{
      text: string;
      action: string;
      params?: Record<string, unknown>;
      icon?: string;
    }>,
  ): Generator<OrchestrationStreamChunk> {
    yield {
      type: "suggestions",
      data: {
        suggestions,
      },
    };
  }

  /**
   * 输出错误（生成器方法）
   *
   * @param message - 错误消息
   * @param code - 错误代码
   * @param retryable - 是否可重试
   * @yields 错误输出块
   */
  protected *emitError(
    message: string,
    code?: string,
    retryable = false,
  ): Generator<OrchestrationStreamChunk> {
    // Phase 3.1: 停止心跳
    this.stopHeartbeat();

    yield {
      type: "error",
      data: {
        message,
        code,
        retryable,
      },
    };
  }

  /**
   * 输出取消（生成器方法）
   *
   * 当用户取消操作时使用
   *
   * @param message - 取消消息
   * @param reason - 取消原因
   * @yields 取消输出块
   */
  protected *emitCancelled(
    message: string,
    reason?: string,
  ): Generator<OrchestrationStreamChunk> {
    // Phase 3.1: 停止心跳
    this.stopHeartbeat();

    const completedSteps = this.progressState?.currentStepIndex ?? 0;
    const totalSteps = this.progressState?.steps.length ?? 0;

    // 发射取消事件（P2 增强）
    if (this.eventEmitter && this.currentUserId) {
      this.eventEmitter.emitCancelled({
        userId: this.currentUserId,
        reason: reason === "user" ? "user_requested" : "system",
        completedSteps,
        totalSteps,
      });
    }

    yield {
      type: "cancelled",
      data: {
        message,
        reason,
        timestamp: new Date().toISOString(),
        completedSteps,
        totalSteps,
      },
    };
  }

  /**
   * 检查取消状态
   *
   * @param context - 编排上下文
   * @returns 是否已取消
   */
  protected isCancelled(context: OrchestrationContext): boolean {
    return context.cancellationToken?.isCancelled ?? false;
  }

  /**
   * 输出完成（生成器方法）
   *
   * @param success - 是否成功
   * @param summary - 完成摘要
   * @param hasDeliverable - 是否有交付物
   * @yields 完成输出块
   */
  protected *emitDone(
    success: boolean,
    summary?: string,
    hasDeliverable = false,
  ): Generator<OrchestrationStreamChunk> {
    // Phase 3.1: 停止心跳
    this.stopHeartbeat();

    const durationMs = this.progressState
      ? Date.now() - this.progressState.startTime
      : 0;

    // 完成最后一个步骤（P2 增强）
    if (this.eventEmitter && this.currentUserId && this.progressState) {
      const lastStepIndex = this.progressState.currentStepIndex;
      const lastStep = this.progressState.steps[lastStepIndex];
      if (lastStep) {
        this.eventEmitter.emitStepCompleted({
          userId: this.currentUserId,
          stepIndex: lastStepIndex,
          stepId: lastStep.id || `step-${lastStepIndex}`,
          stepName: lastStep.name,
          success,
          progressPercent: 100,
        });
      }

      // 发射执行完成事件
      this.eventEmitter.emitExecutionCompleted({
        userId: this.currentUserId,
        mode: "orchestration",
        success,
        completedSteps: lastStepIndex + 1,
        hasDeliverable,
      });
    }

    yield {
      type: "done",
      data: {
        success,
        summary,
        durationMs,
        mode: "orchestration",
        skillId: this.metadata.id,
      },
    };

    // 重置状态
    this.eventEmitter = null;
    this.currentUserId = null;
  }

  /**
   * 调用原子 Skill
   *
   * 复用现有的原子 Skill 能力
   *
   * @param skill - Skill 实例
   * @param params - 输入参数
   * @param context - Skill 上下文
   * @returns Skill 执行结果
   */
  protected async invokeAtomicSkill<TSkillInput, TSkillOutput>(
    skill: ISkill<TSkillInput, TSkillOutput>,
    params: TSkillInput,
    context: SkillContext,
  ): Promise<TSkillOutput> {
    const result = await skill.execute(params, context);

    if (!result.success) {
      throw new Error(
        `Atomic skill ${skill.metadata.id} failed: ${result.error}`,
      );
    }

    return result.data;
  }

  /**
   * 调用 Tool（复用现有 Tools）
   *
   * @param toolExecutor - Tool 执行函数
   * @param params - Tool 参数
   * @param context - Tool 上下文
   * @returns Tool 执行结果
   */
  protected async invokeTool<TParams, TResult>(
    toolExecutor: (params: TParams, context: ToolContext) => Promise<TResult>,
    params: TParams,
    context: ToolContext,
  ): Promise<ToolResult<TResult>> {
    try {
      const result = await toolExecutor(params, context);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        },
        "OrchestrationSkill: Tool invocation failed",
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  }

  /**
   * 默认的 executeInternal 实现
   *
   * 编排 Skill 主要通过 executeStream 执行，但仍需提供 executeInternal 以兼容原子模式调用
   * 子类可以重写此方法提供更好的原子模式支持
   */
  protected async executeInternal(
    input: TInput,
    context: SkillContext,
  ): Promise<TOutput> {
    // 创建编排上下文
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    // 收集流式输出
    const chunks: OrchestrationStreamChunk[] = [];
    let result: TOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      chunks.push(chunk);

      // 尝试从 done 块获取结果
      if (chunk.type === "done" && chunk.data.success) {
        // 子类应该在 done 之前设置结果
      }
    }

    // 如果没有明确的结果，尝试从交付物构造
    if (result === undefined) {
      const deliverables = chunks
        .filter((c) => c.type === "deliverable")
        .map((c) => (c as { data: unknown }).data);

      if (deliverables.length > 0) {
        result = { deliverables } as unknown as TOutput;
      } else {
        // 返回空结果
        result = {} as TOutput;
      }
    }

    return result;
  }

  /**
   * 获取预设步骤
   */
  protected getSteps(): StepDefinition[] {
    return this.metadata.steps || [];
  }
}

/**
 * 编排 Skill 执行错误
 */
export class OrchestrationExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "OrchestrationExecutionError";
  }
}
