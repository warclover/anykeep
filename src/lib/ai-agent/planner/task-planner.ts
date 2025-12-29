/**
 * Task Planner
 *
 * 分析用户意图，生成执行计划
 * 使用 LLM 将自然语言转换为结构化的工具调用序列
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import { generateText } from "ai";
import type { ExecutionPlan, PlanStep, PlannerConfig } from "./types";
import { DEFAULT_PLANNER_CONFIG, PLANNER_SYSTEM_PROMPT } from "./types";
import { toolRegistry } from "../tools/tool-registry";
import { inferRiskLevel, type ToolRiskLevel } from "../tools/types";
import { aiProviderRouter } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";

// ============================================
// Zod Schemas for Validation
// ============================================

const PlanStepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  params: z.record(z.string(), z.unknown()),
  outputVariable: z.string().optional(),
  condition: z.string().optional(),
  onError: z.enum(["skip", "abort", "retry"]).optional().default("abort"),
  estimatedDuration: z.number().optional(),
});

const ExecutionPlanSchema = z.object({
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  steps: z.array(PlanStepSchema),
  riskLevel: z.enum(["low", "medium", "high"]),
  estimatedDuration: z.number().optional(),
});

// ============================================
// TaskPlanner Class
// ============================================

/**
 * 任务规划器
 *
 * @example
 * ```typescript
 * const planner = new TaskPlanner();
 * const plan = await planner.plan("搜索最近收藏的 AI 相关书签");
 *
 * if (plan.confidence < 0.6) {
 *   // 需要澄清
 * } else {
 *   // 执行计划
 *   const executor = new PlanExecutor(context);
 *   for await (const event of executor.execute(plan)) {
 *     // 处理执行事件
 *   }
 * }
 * ```
 */
export class TaskPlanner {
  private config: PlannerConfig;

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
  }

  /**
   * 生成执行计划
   *
   * @param userMessage - 用户消息
   * @param context - 可选的上下文信息
   * @returns 执行计划
   */
  async plan(
    userMessage: string,
    context?: Record<string, unknown>,
  ): Promise<ExecutionPlan> {
    const startTime = performance.now();

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions();

    // 构建 System Prompt
    const systemPrompt = PLANNER_SYSTEM_PROMPT.replace(
      "{{tools}}",
      JSON.stringify(toolDescriptions, null, 2),
    ).replace("{{context}}", context ? JSON.stringify(context, null, 2) : "无");

    logger.debug(
      {
        userMessage: userMessage.substring(0, 100),
        toolCount: toolDescriptions.length,
      },
      "TaskPlanner: Generating plan",
    );

    try {
      // 获取 AI 模型
      const selection = aiProviderRouter.selectProvider({ taskType: "chat" });

      if (!selection) {
        logger.warn("TaskPlanner: No AI model available");
        return {
          id: crypto.randomUUID(),
          intent: "无法获取 AI 模型",
          confidence: 0,
          steps: [],
          estimatedDuration: 0,
          riskLevel: "low",
          createdAt: new Date(),
        };
      }

      // 调用 LLM 生成计划（将 system prompt 和用户消息合并到 prompt 中）
      const fullPrompt = `${systemPrompt}\n\n## 用户请求\n${userMessage}`;

      const { text } = await generateText({
        model: selection.model,
        prompt: fullPrompt,
        temperature: 0.1, // 低温度保证确定性
        maxOutputTokens: 2000,
      });

      // 解析 JSON 响应
      const parsed = this.parseJsonResponse(text);

      // 验证计划
      const validatedPlan = this.validatePlan(parsed);

      // 构建完整计划
      const plan: ExecutionPlan = {
        id: crypto.randomUUID(),
        intent: validatedPlan.intent,
        confidence: validatedPlan.confidence,
        steps: validatedPlan.steps,
        estimatedDuration:
          validatedPlan.estimatedDuration ||
          this.estimateDuration(validatedPlan.steps),
        riskLevel: this.calculateRiskLevel(validatedPlan.steps),
        createdAt: new Date(),
      };

      logger.info(
        {
          planId: plan.id,
          intent: plan.intent,
          confidence: plan.confidence,
          stepCount: plan.steps.length,
          riskLevel: plan.riskLevel,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "TaskPlanner: Plan generated",
      );

      return plan;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          userMessage: userMessage.substring(0, 100),
          error: errorMessage,
        },
        "TaskPlanner: Failed to generate plan",
      );

      // 返回一个低置信度的空计划
      return {
        id: crypto.randomUUID(),
        intent: "无法理解用户意图",
        confidence: 0,
        steps: [],
        estimatedDuration: 0,
        riskLevel: "low",
        createdAt: new Date(),
      };
    }
  }

  /**
   * 获取工具描述列表
   */
  private getToolDescriptions(): Array<{
    name: string;
    description: string;
    category: string;
    riskLevel: ToolRiskLevel;
    parameters: unknown;
  }> {
    const tools = toolRegistry.getAll();

    return tools.map((tool) => ({
      name: tool.definition.name,
      description: tool.definition.description,
      category: tool.definition.category,
      riskLevel: inferRiskLevel(tool.definition),
      // 简化参数描述（避免过长的 Zod schema）
      parameters: this.simplifySchema(tool.definition.parameters),
    }));
  }

  /**
   * 简化 Zod Schema 为可读格式
   * 使用安全的方式处理 Zod schema，不依赖内部 API
   */
  private simplifySchema(schema: z.ZodSchema): Record<string, string> | string {
    try {
      // 尝试解析一个空对象来获取错误信息（用于了解结构）
      const result = schema.safeParse({});

      if (result.success) {
        return "no required params";
      }

      // 从错误信息中提取参数信息
      const params: Record<string, string> = {};

      if (result.error && result.error.issues) {
        for (const issue of result.error.issues) {
          const path = issue.path.join(".");
          if (path) {
            params[path] = issue.message;
          }
        }
      }

      return Object.keys(params).length > 0 ? params : "complex schema";
    } catch {
      return "schema parsing error";
    }
  }

  /**
   * 解析 JSON 响应
   */
  private parseJsonResponse(text: string): z.infer<typeof ExecutionPlanSchema> {
    // 尝试直接解析
    try {
      return JSON.parse(text);
    } catch {
      // 尝试从 markdown 代码块中提取
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // 尝试查找 JSON 对象
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }

      throw new Error("Cannot parse JSON from response");
    }
  }

  /**
   * 验证计划
   */
  private validatePlan(
    raw: unknown,
  ): z.infer<typeof ExecutionPlanSchema> & { steps: PlanStep[] } {
    // 基础验证
    const parsed = ExecutionPlanSchema.parse(raw);

    // 验证每个步骤的工具存在
    for (const step of parsed.steps) {
      const tool = toolRegistry.get(step.tool);

      if (!tool) {
        throw new Error(`Unknown tool: ${step.tool}`);
      }

      // 验证参数（允许变量引用）
      const cleanParams = this.cleanVariableReferences(step.params);

      try {
        tool.definition.parameters.parse(cleanParams);
      } catch (error) {
        if (error instanceof z.ZodError) {
          // 如果参数包含变量引用，暂时跳过验证
          const hasVariables = Object.values(step.params).some(
            (v) => typeof v === "string" && v.startsWith("$"),
          );

          if (!hasVariables) {
            logger.warn(
              {
                tool: step.tool,
                errors: error.issues,
              },
              "TaskPlanner: Parameter validation warning",
            );
          }
        }
      }
    }

    // 验证步骤数量
    if (parsed.steps.length > this.config.maxSteps) {
      throw new Error(`Plan exceeds maximum steps (${this.config.maxSteps})`);
    }

    return parsed as z.infer<typeof ExecutionPlanSchema> & {
      steps: PlanStep[];
    };
  }

  /**
   * 清除变量引用用于参数验证
   */
  private cleanVariableReferences(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("$")) {
        // 对于变量引用，使用占位值
        cleaned[key] = "__VARIABLE_PLACEHOLDER__";
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * 估算执行时间
   */
  private estimateDuration(steps: PlanStep[]): number {
    let total = 0;

    for (const step of steps) {
      if (step.estimatedDuration) {
        total += step.estimatedDuration;
      } else {
        const tool = toolRegistry.get(step.tool);
        total += tool?.definition.estimatedDurationMs ?? 2000;
      }
    }

    return total;
  }

  /**
   * 计算整体风险等级
   */
  private calculateRiskLevel(steps: PlanStep[]): ToolRiskLevel {
    let maxRisk: ToolRiskLevel = "low";

    for (const step of steps) {
      const tool = toolRegistry.get(step.tool);

      if (tool) {
        const risk = inferRiskLevel(tool.definition);

        if (risk === "high") {
          return "high";
        }

        if (risk === "medium" && maxRisk === "low") {
          maxRisk = "medium";
        }
      }
    }

    return maxRisk;
  }
}
