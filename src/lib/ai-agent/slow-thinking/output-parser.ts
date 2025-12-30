/**
 * 慢思考服务 - 输出解析器
 *
 * 解析 LLM 输出为结构化的内心独白
 *
 * @module ai-agent/slow-thinking
 * @version 1.0.0
 * @since 2025-12-30
 */

import type {
  InternalMonologue,
  ReasoningStep,
  ExecutionStrategy,
  StrategyType,
} from "./types";

/**
 * 从文本中提取指定标签的内容
 *
 * @param text - 源文本
 * @param tag - 标签名
 * @returns 提取的内容或 undefined
 */
export function extractTag(text: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim();
}

/**
 * 解析推理步骤
 *
 * @param thinking - 思考过程文本
 * @returns 推理步骤数组
 */
export function parseReasoningSteps(thinking: string): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  const lines = thinking.split("\n").filter((l) => l.trim());

  lines.forEach((line, index) => {
    // 匹配数字开头的行（如 "1. xxx" 或 "1、xxx"）
    const match = line.match(/^\s*(\d+)[.、\)]\s*(.+)/);
    if (match) {
      const stepNum = parseInt(match[1], 10);
      const thought = match[2].trim();

      steps.push({
        step: stepNum || index + 1,
        thought,
      });
    }
  });

  return steps;
}

/**
 * 解析执行策略
 *
 * @param strategyStr - 策略字符串
 * @returns 执行策略对象
 */
export function parseStrategy(strategyStr: string): ExecutionStrategy {
  const typeMatch = strategyStr.match(/type:\s*(\w+)/i);
  const descMatch = strategyStr.match(/description:\s*(.+?)(?:\n|$)/i);
  const preMatch = strategyStr.match(/pre_processing:\s*(.+?)(?:\n|$)/i);
  const postMatch = strategyStr.match(/post_processing:\s*(.+?)(?:\n|$)/i);

  const typeValue = typeMatch?.[1]?.toLowerCase() as StrategyType | undefined;
  const validTypes: StrategyType[] = ["default", "customized", "multi_step"];

  return {
    type: typeValue && validTypes.includes(typeValue) ? typeValue : "default",
    description: descMatch?.[1]?.trim() ?? "",
    preProcessing: preMatch?.[1]
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    postProcessing: postMatch?.[1]
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * 解析 LLM 输出为内心独白
 *
 * @param llmOutput - LLM 原始输出
 * @param originalInput - 原始用户输入
 * @returns 内心独白对象
 */
export function parseMonologue(
  llmOutput: string,
  originalInput: string,
): InternalMonologue {
  // 提取各个部分
  const thinking = extractTag(llmOutput, "thinking") ?? "";
  const inferredIntent =
    extractTag(llmOutput, "inferred_intent") ?? originalInput;
  const inferredGoal = extractTag(llmOutput, "inferred_goal");
  const strategyStr = extractTag(llmOutput, "strategy") ?? "";
  const suggestChangeStr = extractTag(llmOutput, "suggest_route_change") ?? "";
  const confidenceStr = extractTag(llmOutput, "confidence") ?? "70";
  const conclusion = extractTag(llmOutput, "conclusion");

  // 解析布尔值
  const suggestChange =
    suggestChangeStr.toLowerCase() === "true" || suggestChangeStr === "是";

  // 解析置信度
  let confidence = parseInt(confidenceStr.replace(/[^0-9]/g, ""), 10);
  if (isNaN(confidence) || confidence < 0 || confidence > 100) {
    confidence = 70; // 默认置信度
  }

  // 解析推理步骤
  const reasoningSteps = parseReasoningSteps(thinking);

  // 解析策略
  const suggestedStrategy = parseStrategy(strategyStr);

  return {
    originalInput,
    thinking,
    reasoningSteps,
    inferredIntent,
    inferredGoal: inferredGoal || undefined,
    suggestedStrategy,
    suggestRouteChange: suggestChange,
    thinkingDurationMs: 0, // 由调用方填充
    confidence,
    conclusion: conclusion || undefined,
  };
}

/**
 * 验证内心独白的有效性
 *
 * @param monologue - 内心独白对象
 * @returns 是否有效
 */
export function validateMonologue(monologue: InternalMonologue): boolean {
  // 基本字段检查
  if (!monologue.originalInput) {
    return false;
  }

  // 必须有推断意图
  if (!monologue.inferredIntent || monologue.inferredIntent.length < 2) {
    return false;
  }

  // 置信度必须在有效范围内
  if (monologue.confidence < 0 || monologue.confidence > 100) {
    return false;
  }

  // 策略类型必须有效
  const validTypes = ["default", "customized", "multi_step"];
  if (!validTypes.includes(monologue.suggestedStrategy.type)) {
    return false;
  }

  return true;
}

/**
 * 创建默认的内心独白（当解析失败时使用）
 *
 * @param originalInput - 原始用户输入
 * @returns 默认内心独白
 */
export function createDefaultMonologue(
  originalInput: string,
): InternalMonologue {
  return {
    originalInput,
    thinking: "无法完成深度分析，使用默认执行策略。",
    reasoningSteps: [],
    inferredIntent: originalInput,
    suggestedStrategy: {
      type: "default",
      description: "使用默认执行策略",
    },
    suggestRouteChange: false,
    thinkingDurationMs: 0,
    confidence: 50,
  };
}
