/**
 * EnhancedBlueprintEngine - 增强蓝图引擎基类
 *
 * 继承 OrchestrationSkill，为 Knowledge Studio 蓝图提供统一的：
 * - Briefing 机制（预生成问题收集）
 * - Outline-First 生成模式（大纲→内容两阶段）
 * - 结构化输出（JSON Schema 约束）
 *
 * @module knowledge-studio/blueprint
 * @version 2.0.0
 */

import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import {
  OrchestrationSkill,
  type OrchestrationContext,
  type OrchestrationSkillMetadata,
  type StepDefinition,
  type Deliverable,
} from "../../ai-skills/orchestration";
import type { OrchestrationStreamChunk } from "../../ai-skills/output/types";
import type {
  BriefingQuestion,
  BriefingConfig,
  BriefingContext,
  EnhancedBlueprintInput,
  StructuredOutput,
  BlueprintOutline,
  EnhancedBlueprintMetadata,
  BlueprintTier,
  TargetUserGroup,
} from "./types";

// ============================================================
// Zod Schemas for BaseSkill compatibility
// ============================================================

/**
 * 蓝图输入 Zod Schema
 * 用于 BaseSkill.inputSchema 兼容
 */
export const EnhancedBlueprintInputSchema = z.object({
  materials: z.array(
    z.object({
      bookmarkId: z.string(),
      title: z.string(),
      content: z.string(),
      url: z.string(),
      platform: z.string().optional(),
    }),
  ),
  briefingContext: z
    .object({
      // Use any() for answers to avoid complex union type issues
      answers: z.record(z.string(), z.any()),
      answeredAt: z.date(),
    })
    .optional(),
  customPrompt: z.string().optional(),
  targetLength: z.enum(["short", "medium", "long"]).optional(),
  /** Phase 3.1: 平台风格 */
  platformStyle: z.enum(["wechat", "xiaohongshu", "general"]).optional(),
  requestMetadata: z
    .object({
      requestId: z.string(),
      userId: z.string(),
      sessionId: z.string().optional(),
    })
    .optional(),
});

/**
 * 蓝图输出 Zod Schema
 * 用于 BaseSkill.outputSchema 兼容
 */
export const StructuredOutputSchema = z.object({
  version: z.string(),
  generatedAt: z.date(),
  blueprintId: z.string(),
  citations: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        sourceId: z.string(),
        sourceTitle: z.string().optional(),
      }),
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 蓝图执行阶段
 */
export type BlueprintStage =
  | "briefing" // Briefing 问题收集
  | "outline" // 大纲生成
  | "content" // 内容生成
  | "structuring" // 结构化输出
  | "complete"; // 完成

/**
 * 蓝图执行上下文
 * 扩展 OrchestrationContext，添加蓝图特有字段
 */
export interface BlueprintExecutionContext extends OrchestrationContext {
  /** 当前执行阶段 */
  stage: BlueprintStage;
  /** Briefing 上下文 */
  briefingContext?: BriefingContext;
  /** 生成的大纲 */
  outline?: BlueprintOutline;
  /** 中间生成内容 */
  intermediateContent?: string;
}

/**
 * 增强蓝图引擎基类
 *
 * 所有具体蓝图（如 G1-辩论、G2-教程等）必须继承此类并实现抽象方法。
 *
 * @template TOutput - 结构化输出类型，必须继承 StructuredOutput
 *
 * @example
 * ```typescript
 * class DebateBlueprint extends EnhancedBlueprintEngine<DebateOutput> {
 *   readonly blueprintId = 'geek-debate';
 *   readonly displayName = '辩论稿';
 *   // ... 实现抽象方法
 * }
 * ```
 */
export abstract class EnhancedBlueprintEngine<
  TOutput extends StructuredOutput = StructuredOutput,
> extends OrchestrationSkill<EnhancedBlueprintInput, TOutput> {
  // ============================================================
  // BaseSkill Required Properties - 提供默认实现
  // ============================================================

  /**
   * 输入 Schema (来自 BaseSkill)
   * 所有蓝图共享相同的输入结构
   */
  readonly inputSchema = EnhancedBlueprintInputSchema;

  /**
   * 输出 Schema (来自 BaseSkill)
   * 子类可覆盖以提供更具体的 Schema
   */
  readonly outputSchema =
    StructuredOutputSchema as unknown as z.ZodSchema<TOutput>;

  // ============================================================
  // Abstract Properties - 必须由子类实现
  // ============================================================

  /**
   * 蓝图唯一标识
   * 格式：category-name，如 'geek-arxiv_decoder', 'creator-scriptwriter'
   */
  abstract readonly blueprintId: string;

  /**
   * 蓝图显示名称
   * 用于 UI 展示，如 '论文实战解码器'、'视频脚本生成器'
   */
  abstract readonly displayName: string;

  /**
   * 蓝图描述
   */
  abstract readonly description: string;

  /**
   * 蓝图图标 (emoji)
   */
  abstract readonly icon: string;

  /**
   * 权限层级
   * - free: 免费用户可用
   * - pro: Pro 用户可用
   * - enterprise: 企业用户可用
   */
  abstract readonly tier: BlueprintTier;

  /**
   * 目标用户群体
   * 用于蓝图推荐和过滤
   */
  abstract readonly targetUsers: TargetUserGroup[];

  /**
   * 配额消耗点数 (Story 8.1)
   * 增强蓝图每次生成消耗 2-3 个配额点数
   * - 2 点：标准复杂度蓝图
   * - 3 点：高复杂度蓝图（如多维度分析、综合报告）
   */
  abstract readonly creditsCost: number;

  /**
   * Briefing 配置
   * 定义预生成问题，最多 3 个问题
   */
  abstract readonly briefingConfig: BriefingConfig;

  // ============================================================
  // Optional Properties - 子类可覆盖
  // ============================================================

  /**
   * 蓝图分类
   * 用于 UI 分组显示
   */
  readonly category?: EnhancedBlueprintMetadata["category"];

  /**
   * 优先级排序
   * 数字越小越靠前，用于蓝图列表排序
   */
  readonly priority?: number;

  /**
   * 是否为新蓝图
   * 用于在 UI 中显示 "NEW" 徽章
   */
  readonly isNew?: boolean;

  /**
   * 蓝图标签
   * 用于搜索和过滤
   */
  readonly tags?: string[];

  /**
   * 使用示例/模板提示
   * 展示蓝图的典型用法
   */
  readonly examplePrompts?: string[];

  // ============================================================
  // Abstract Methods - 必须由子类实现
  // ============================================================

  /**
   * 获取 Briefing 问题列表
   *
   * 返回在生成前需要向用户收集的问题。
   * 问题数量硬限制为 3 个。
   *
   * @returns Briefing 问题数组
   *
   * @example
   * ```typescript
   * getBriefingQuestions(): BriefingQuestion[] {
   *   return [
   *     {
   *       id: 'audience',
   *       type: 'single_choice',
   *       question: '目标读者是谁？',
   *       options: [
   *         { value: 'beginner', label: '初学者' },
   *         { value: 'expert', label: '专家' },
   *       ],
   *       required: true,
   *     },
   *   ];
   * }
   * ```
   */
  abstract getBriefingQuestions(): BriefingQuestion[];

  /**
   * 生成内容大纲
   *
   * 使用 DeepSeek 模型生成结构化大纲，作为内容生成的蓝图。
   * 大纲应包含标题、章节、要点等结构信息。
   *
   * @param context - 执行上下文
   * @param input - 蓝图输入（包含素材和 Briefing 答案）
   * @yields OrchestrationStreamChunk - 流式输出块
   * @returns AsyncGenerator
   *
   * @example
   * ```typescript
   * async *generateOutline(context, input) {
   *   yield* this.reportProgress('outline', 10, '分析素材...');
   *   // 调用 DeepSeek 生成大纲
   *   const outline = await this.callOutlineModel(input);
   *   yield* this.reportProgress('outline', 100, '大纲生成完成');
   *   return outline;
   * }
   * ```
   */
  abstract generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown>;

  /**
   * 获取输出 JSON Schema
   *
   * 定义蓝图的结构化输出格式，用于：
   * 1. LLM Structured Output 约束
   * 2. 输出验证
   * 3. 类型推断
   *
   * @returns JSON Schema 7 定义
   *
   * @example
   * ```typescript
   * getOutputSchema(): JSONSchema7 {
   *   return {
   *     type: 'object',
   *     properties: {
   *       title: { type: 'string' },
   *       sections: {
   *         type: 'array',
   *         items: { ... }
   *       }
   *     },
   *     required: ['title', 'sections']
   *   };
   * }
   * ```
   */
  abstract getOutputSchema(): JSONSchema7;

  // ============================================================
  // Protected Abstract Methods - 子类实现的内部方法
  // ============================================================

  /**
   * 生成内容
   *
   * 基于大纲生成完整内容。
   *
   * @param context - 执行上下文（包含大纲）
   * @param input - 蓝图输入
   * @yields OrchestrationStreamChunk - 流式输出块
   * @returns 生成的原始内容
   */
  protected abstract generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown>;

  /**
   * 结构化输出
   *
   * 将生成的内容转换为结构化输出格式。
   *
   * @param context - 执行上下文（包含大纲和内容）
   * @param rawContent - 原始生成内容
   * @returns 结构化输出
   */
  protected abstract structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<TOutput>;

  // ============================================================
  // OrchestrationSkill Implementation
  // ============================================================

  /**
   * 获取 Skill 元数据
   * 从蓝图属性构建 OrchestrationSkillMetadata
   */
  get metadata(): OrchestrationSkillMetadata {
    return {
      id: this.blueprintId,
      name: this.displayName,
      description: this.description,
      version: "2.0.0",
      author: "AnyKeep",
      category: "learning", // 蓝图属于学习类 Skill
      capabilities: ["generation", "outline", "structured-output"],
      estimatedDurationMs: this.getEstimatedDuration() * 1000,
      requiresConfirmation: false,
    };
  }

  /**
   * 解析输入
   *
   * 从用户消息和上下文中提取 EnhancedBlueprintInput。
   * 在 Knowledge Studio 场景中，输入通常已经结构化。
   *
   * @param message - 用户消息（可能为空）
   * @param context - 编排上下文
   * @returns 解析后的输入
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<EnhancedBlueprintInput> {
    // 从上下文中获取已结构化的输入
    const existingInput = context.params as
      | Partial<EnhancedBlueprintInput>
      | undefined;

    return {
      materials: existingInput?.materials ?? [],
      briefingContext: existingInput?.briefingContext,
      customPrompt: existingInput?.customPrompt ?? message,
      targetLength: existingInput?.targetLength ?? "medium",
      platformStyle: existingInput?.platformStyle, // Phase 3.1
      requestMetadata: existingInput?.requestMetadata,
    };
  }

  /**
   * 执行蓝图生成流程
   *
   * 实现 Outline-First 两阶段生成：
   * 1. Briefing 阶段（如果启用）
   * 2. Outline 生成阶段
   * 3. Content 生成阶段
   * 4. Structuring 阶段
   *
   * @param context - 编排上下文
   * @yields OrchestrationStreamChunk - 流式输出块
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    // 初始化蓝图执行上下文
    const blueprintContext: BlueprintExecutionContext = {
      ...context,
      stage: "briefing",
    };

    // 解析输入
    const input = await this.parseInput("", context);

    // 定义执行步骤
    const steps = this.buildSteps(input);
    this.initProgress(steps);

    try {
      // 阶段 1: Briefing（如果启用且未提供答案）
      if (this.briefingConfig.enabled && !input.briefingContext) {
        yield* this.handleBriefingStage(blueprintContext);
        return; // 等待用户回答后重新执行
      }

      // 记录 Briefing 上下文
      blueprintContext.briefingContext = input.briefingContext;

      // 阶段 2: 生成大纲（如果未提供）
      blueprintContext.stage = "outline";

      if (blueprintContext.outline) {
        // 使用已提供的大纲，跳过大纲生成阶段
        yield* this.reportProgress("outline", 100, "使用已确认的大纲");
      } else {
        // 需要生成大纲
        yield* this.reportProgress("outline", 0, "开始生成大纲...");

        const outlineGenerator = this.generateOutline(blueprintContext, input);
        let outlineResult: IteratorResult<
          OrchestrationStreamChunk,
          BlueprintOutline
        >;

        do {
          outlineResult = await outlineGenerator.next();
          if (!outlineResult.done && outlineResult.value) {
            yield outlineResult.value;
          }
        } while (!outlineResult.done);

        blueprintContext.outline = outlineResult.value;
        yield* this.reportProgress("outline", 100, "大纲生成完成");
      }

      // 阶段 3: 生成内容
      blueprintContext.stage = "content";
      yield* this.reportProgress("content", 0, "开始生成内容...");

      const contentGenerator = this.generateContent(blueprintContext, input);
      let contentResult: IteratorResult<OrchestrationStreamChunk, string>;

      do {
        contentResult = await contentGenerator.next();
        if (!contentResult.done && contentResult.value) {
          yield contentResult.value;
        }
      } while (!contentResult.done);

      blueprintContext.intermediateContent = contentResult.value;
      yield* this.reportProgress("content", 100, "内容生成完成");

      // 阶段 4: 结构化输出
      blueprintContext.stage = "structuring";
      yield* this.reportProgress("structuring", 0, "结构化输出...");

      const structuredOutput = await this.structureOutput(
        blueprintContext,
        blueprintContext.intermediateContent,
      );

      yield* this.reportProgress("structuring", 100, "输出结构化完成");

      // 完成 - 发送交付物
      blueprintContext.stage = "complete";
      const deliverable: Deliverable = {
        id: `${this.blueprintId}-${Date.now()}`,
        type: "document",
        title: `${this.displayName} - 输出`,
        format: "json",
        content: structuredOutput,
        downloadable: true,
        shareable: true,
        metadata: {
          schema: this.getOutputSchema(),
          blueprintId: this.blueprintId,
        },
        createdAt: new Date(),
      };
      yield* this.emitDeliverable(deliverable);

      yield* this.emitDone(true, `${this.displayName}生成完成`);
    } catch (error) {
      yield* this.emitDone(
        false,
        `生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // ============================================================
  // Protected Helper Methods
  // ============================================================

  /**
   * 处理 Briefing 阶段
   *
   * 向用户展示 Briefing 问题并等待回答。
   */
  protected *handleBriefingStage(
    _context: BlueprintExecutionContext,
  ): Generator<OrchestrationStreamChunk> {
    const questions = this.getBriefingQuestions();

    yield* this.reportProgress("briefing", 0, "收集生成偏好...");

    // 发送确认请求块，让前端显示 Briefing 问题
    const confirmationChunk: OrchestrationStreamChunk = {
      type: "confirmation",
      data: {
        id: `briefing-${this.blueprintId}-${Date.now()}`,
        title: "生成前确认",
        message: "请回答以下问题以优化生成结果",
        options: [
          { id: "submit", label: "开始生成", primary: true },
          { id: "cancel", label: "取消" },
        ],
        preview: {
          type: "briefing",
          blueprintId: this.blueprintId,
          questions,
        },
        timeout: 300000, // 5 分钟超时
      },
    };

    yield confirmationChunk;
  }

  /**
   * 构建执行步骤定义
   */
  protected buildSteps(input: EnhancedBlueprintInput): StepDefinition[] {
    const steps: StepDefinition[] = [];

    if (this.briefingConfig.enabled && !input.briefingContext) {
      steps.push({
        id: "briefing",
        name: "收集偏好",
        weight: 5,
      });
    }

    steps.push(
      { id: "outline", name: "生成大纲", weight: 25 },
      { id: "content", name: "生成内容", weight: 60 },
      { id: "structuring", name: "结构化输出", weight: 10 },
    );

    return steps;
  }

  /**
   * 获取预估执行时间（秒）
   */
  protected getEstimatedDuration(): number {
    // 基础时间 30 秒 + Briefing 配置调整
    let duration = 30;
    if (this.briefingConfig.enabled) {
      duration += 10;
    }
    return duration;
  }

  /**
   * 获取蓝图元数据
   */
  getBlueprintMetadata(): EnhancedBlueprintMetadata {
    return {
      // 必需字段
      blueprintId: this.blueprintId,
      displayName: this.displayName,
      description: this.description,
      icon: this.icon,
      tier: this.tier,
      targetUsers: this.targetUsers,

      // 可选字段
      category: this.category,
      priority: this.priority,
      isNew: this.isNew,
      tags: this.tags,
      examplePrompts: this.examplePrompts,

      // 配额字段 (Story 8.1)
      creditsCost: this.creditsCost,

      // 扩展字段
      isGeek: this.blueprintId.startsWith("geek-"),
      estimatedTimeSeconds: this.getEstimatedDuration(),
      supportsOutline: true,
      briefingEnabled: this.briefingConfig.enabled,
      briefingQuestionCount: this.briefingConfig.questions.length,
    };
  }

  /**
   * 验证 Briefing 配置
   * 确保问题数量不超过 3 个
   */
  protected validateBriefingConfig(): void {
    if (this.briefingConfig.questions.length > 3) {
      throw new Error(
        `Briefing 问题数量超过限制: ${this.briefingConfig.questions.length}/3`,
      );
    }
  }
}

// ============================================================
// Type Exports
// ============================================================

export type {
  BriefingQuestion,
  BriefingConfig,
  BriefingContext,
  EnhancedBlueprintInput,
  StructuredOutput,
  BlueprintOutline,
  EnhancedBlueprintMetadata,
} from "./types";
