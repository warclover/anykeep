/**
 * OrchestrationSkill - 编排 Skill 基类
 *
 * 继承自 BaseSkill，扩展多步骤编排能力：
 * - 流式执行支持
 * - 进度报告
 * - 确认请求
 * - 交付物生成
 * - 原子 Skill 和 Tool 调用
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { BaseSkill } from "../core/base-skill";
import type { SkillContext, ISkill } from "../core/types";
import { logger } from "@/lib/logger";
import type {
  OrchestrationStreamChunk,
  DeliverableType,
  OutputFormat,
  ConfirmOption,
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
    if (this.progressState) {
      const stepIndex = this.progressState.steps.findIndex(
        (s) => s.name === step || s.id === step,
      );
      if (stepIndex >= 0) {
        this.progressState.currentStepIndex = stepIndex;
      }
      this.progressState.currentStep = step;
      this.progressState.percent = percent;
      this.progressState.message = message;
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
    yield {
      type: "cancelled",
      data: {
        message,
        reason,
        timestamp: new Date().toISOString(),
        completedSteps: this.progressState?.currentStepIndex,
        totalSteps: this.progressState?.steps.length,
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
   * @yields 完成输出块
   */
  protected *emitDone(
    success: boolean,
    summary?: string,
  ): Generator<OrchestrationStreamChunk> {
    const durationMs = this.progressState
      ? Date.now() - this.progressState.startTime
      : 0;

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
