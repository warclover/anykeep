/**
 * 任务分析器（零接管版）
 *
 * 使用 LLM 深度理解用户的真正目标，但不询问用户
 *
 * 设计原则：
 * - 静默理解：理解过程不打扰用户
 * - 智能默认：不确定时用智能默认值
 * - 直接执行：高置信度直接执行
 *
 * @version 2.0.0
 * @since 2025-12-26
 */

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import type { TaskUnderstanding, TaskContext, SmartDefault } from "../types";
import type { SmartDefaultsService } from "../defaults/smart-defaults-service";

const logger = createLogger("TaskAnalyzer");

// =============================================================================
// 配置
// =============================================================================

/**
 * 任务分析器配置
 */
export interface TaskAnalyzerConfig {
  /** LLM 模型 */
  model: LanguageModel;

  /** 智能默认值服务 */
  smartDefaultsService: SmartDefaultsService;

  /** 分析超时（毫秒） */
  timeoutMs: number;

  /** 低温度（更稳定） */
  temperature: number;
}

// =============================================================================
// 任务分析器
// =============================================================================

/**
 * 任务分析器（零接管版）
 *
 * 深度理解用户意图，生成执行计划
 */
export class TaskAnalyzer {
  private config: TaskAnalyzerConfig;

  constructor(config: TaskAnalyzerConfig) {
    this.config = config;
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 分析用户任务
   *
   * @param input 用户输入
   * @param context 任务上下文
   * @returns 任务理解结果
   */
  async analyze(
    input: string,
    context: TaskContext,
  ): Promise<TaskUnderstanding> {
    const startTime = performance.now();

    try {
      // 1. 构建分析 Prompt
      const prompt = this.buildAnalysisPrompt(input, context);

      // 2. 调用 LLM 分析
      const { object: analysis } = await generateObject({
        model: this.config.model,
        schema: TaskAnalysisSchema,
        prompt,
        temperature: this.config.temperature,
      });

      // 3. 获取智能默认值
      const smartDefaults =
        await this.config.smartDefaultsService.resolveDefaults(
          analysis.taskType,
          context,
        );

      // 4. 构建任务理解结果
      const understanding = this.buildTaskUnderstanding(
        input,
        analysis,
        smartDefaults,
        performance.now() - startTime,
      );

      logger.info(
        {
          input: input.substring(0, 50),
          goal: understanding.goal,
          confidence: understanding.confidence,
          riskLevel: understanding.riskLevel,
          processingTimeMs: understanding.metadata.processingTimeMs,
        },
        "任务分析完成",
      );

      return understanding;
    } catch (error) {
      logger.error({ input, error }, "任务分析失败");

      // 返回兜底的任务理解
      return this.buildFallbackUnderstanding(
        input,
        performance.now() - startTime,
      );
    }
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 构建分析 Prompt（零接管版）
   */
  private buildAnalysisPrompt(input: string, context: TaskContext): string {
    return `你是一个任务理解专家。用户说了这句话，请深度分析他的真正需求。

## 用户输入
"${input}"

## 用户上下文
- 收藏总数: ${context.stats.total}
- 待整理数: ${context.stats.inbox}
- 最近活跃平台: ${context.recentPlatforms.join(", ") || "无"}
- 常用标签: ${context.frequentTags.slice(0, 10).join(", ") || "无"}
- 文件夹列表: ${context.folders.map((f) => f.name).join(", ") || "无"}
- 上次对话主题: ${context.lastTopic || "无"}

## 分析要求（零接管模式）

重要：你的分析将直接用于执行，不会再询问用户。所以：
1. 要有足够的决策依据
2. 不确定的地方用合理的默认值
3. 专注于可执行的计划

### 1. 用户的真正目标是什么？
- 用一句话描述用户的真正目标
- 要具体、可执行

### 2. 任务类型？
从以下选择：
- search: 搜索/查找
- organize: 整理/分类
- move: 移动
- batch_tags: 批量标签
- export: 导出
- delete: 删除
- query: 查询统计
- review: 复习回顾
- other: 其他

### 3. AI 决策依据？
- 说明你为什么这样理解
- 包括你做的假设
- 简洁明了，2-3 句话

### 4. 执行计划？
- 列出 2-5 个关键步骤
- 每步说明目的和使用的工具
- 标记风险步骤

### 5. 风险级别？
- low: 只读操作，无副作用
- medium: 修改数据，但可撤销
- high: 不可撤销的修改（删除）

### 6. 置信度？
- 0-1 之间
- > 0.8: 非常确定
- 0.6-0.8: 比较确定
- < 0.6: 不太确定（但仍会执行，事后可撤销）`;
  }

  /**
   * 构建任务理解结果
   */
  private buildTaskUnderstanding(
    rawInput: string,
    analysis: TaskAnalysis,
    smartDefaults: SmartDefault[],
    processingTimeMs: number,
  ): TaskUnderstanding {
    const riskLevel = analysis.riskLevel;

    // 零接管原则：只有删除操作需要确认
    const requiresConfirmation =
      riskLevel === "high" && analysis.taskType === "delete";

    return {
      id: this.generateId(),
      rawInput,
      goal: analysis.goal,
      reasoning: analysis.reasoning,
      executionPlan: analysis.executionPlan.map((step, index) => ({
        ...step,
        step: index + 1,
        // 只有删除步骤需要确认
        requiresConfirmation:
          step.action?.includes("delete") || step.action?.includes("remove"),
      })),
      confidence: analysis.confidence,
      requiresConfirmation,
      confirmationReason: requiresConfirmation
        ? "删除操作不可撤销，请确认"
        : undefined,
      riskLevel,
      appliedDefaults: smartDefaults,
      matchedTemplate: analysis.taskType,
      metadata: {
        createdAt: new Date(),
        source: "llm",
        processingTimeMs,
      },
    };
  }

  /**
   * 构建兜底的任务理解（分析失败时）
   */
  private buildFallbackUnderstanding(
    rawInput: string,
    processingTimeMs: number,
  ): TaskUnderstanding {
    return {
      id: this.generateId(),
      rawInput,
      goal: "执行用户请求",
      reasoning: "AI 分析遇到问题，将尝试直接理解执行",
      executionPlan: [
        {
          step: 1,
          description: "尝试理解用户意图",
          action: "fallback_processing",
        },
      ],
      confidence: 0.5,
      requiresConfirmation: false,
      riskLevel: "low",
      appliedDefaults: [],
      metadata: {
        createdAt: new Date(),
        source: "llm",
        processingTimeMs,
      },
    };
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `tu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// =============================================================================
// LLM 输出 Schema
// =============================================================================

/**
 * 任务分析 Schema（用于 LLM 结构化输出）
 */
const TaskAnalysisSchema = z.object({
  goal: z.string().describe("用户的真正目标（一句话）"),

  taskType: z
    .enum([
      "search",
      "organize",
      "move",
      "batch_tags",
      "export",
      "delete",
      "query",
      "review",
      "other",
    ])
    .describe("任务类型"),

  reasoning: z.string().describe("AI 决策依据（2-3 句话）"),

  executionPlan: z
    .array(
      z.object({
        description: z.string().describe("步骤描述"),
        action: z.string().optional().describe("使用的工具/Skill"),
        params: z.record(z.string(), z.unknown()).optional().describe("参数"),
      }),
    )
    .describe("执行计划"),

  riskLevel: z.enum(["low", "medium", "high"]).describe("风险级别"),

  confidence: z.number().min(0).max(1).describe("置信度"),
});

type TaskAnalysis = z.infer<typeof TaskAnalysisSchema>;

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建任务分析器
 */
export function createTaskAnalyzer(config: TaskAnalyzerConfig): TaskAnalyzer {
  return new TaskAnalyzer(config);
}
