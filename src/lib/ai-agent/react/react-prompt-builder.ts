/**
 * ReAct Prompt 构建器
 *
 * 为 ReAct 循环的各个阶段生成适当的提示语，
 * 引导 AI 进行有效的思考、行动和观察。
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  ReactContext,
  ReactRoundState,
  ReactLoopConfig,
  ObservationAnalysis,
} from "./types";

// ============================================================================
// ReAct 系统提示
// ============================================================================

/**
 * ReAct 模式的系统提示增强
 *
 * 这段提示会注入到基础系统提示中，引导 AI 使用 ReAct 模式
 */
export const REACT_SYSTEM_PROMPT_ENHANCEMENT = `
## ReAct 思维模式

你正在使用 ReAct (Reasoning + Acting) 模式来处理用户请求。
在每一轮中，你需要：

1. **思考 (Think)**：分析当前状态和目标
   - 用户真正想要什么？
   - 我已经获得了哪些信息？
   - 还缺少什么信息？
   - 下一步应该做什么？

2. **行动 (Act)**：执行必要的操作
   - 如果需要更多信息，调用适当的工具
   - 如果信息足够，直接生成回答
   - 选择最高效的工具组合

3. **观察 (Observe)**：评估行动结果
   - 工具返回了什么结果？
   - 这些结果是否满足用户需求？
   - 是否需要进一步操作？

**重要原则**：
- 每轮只执行必要的最小操作
- 达成目标后立即停止，不要过度操作
- 如果信息足够，直接回答，不要多余调用工具
`;

/**
 * 构建完整的 ReAct 系统提示
 *
 * @param baseSystemPrompt 基础系统提示
 * @param config ReAct 配置
 * @returns 增强后的系统提示
 */
export function buildReactSystemPrompt(
  baseSystemPrompt: string,
  config: ReactLoopConfig,
): string {
  const maxRoundsNote = config.maxRounds
    ? `\n**注意**：最多执行 ${config.maxRounds} 轮操作，请高效利用每一轮。`
    : "";

  return `${baseSystemPrompt}

${REACT_SYSTEM_PROMPT_ENHANCEMENT}
${maxRoundsNote}
`;
}

// ============================================================================
// 思考阶段提示
// ============================================================================

/**
 * 构建思考阶段提示
 *
 * @param context ReAct 上下文
 * @param previousRounds 之前的轮次状态
 * @returns 思考阶段提示
 */
export function buildThinkingPrompt(
  context: ReactContext,
  previousRounds: ReactRoundState[] = [],
): string {
  const roundNumber = context.currentRound;
  const isFirstRound = roundNumber === 1;

  // 首轮思考提示
  if (isFirstRound) {
    return `
## 第 ${roundNumber} 轮 - 思考阶段

**用户请求**：${context.originalInput}

请分析：
1. 用户的核心需求是什么？
2. 需要什么信息才能满足这个需求？
3. 应该调用哪些工具来获取信息？
4. 还是已有信息足够直接回答？

请根据分析决定下一步行动。
`;
  }

  // 后续轮次思考提示
  const previousSummary = summarizePreviousRounds(previousRounds);

  return `
## 第 ${roundNumber} 轮 - 思考阶段

**用户请求**：${context.originalInput}

**已完成的操作**：
${previousSummary}

请分析：
1. 之前的操作结果是否满足用户需求？
2. 还缺少什么信息？
3. 需要进一步操作吗？
4. 还是已经可以给出最终答案？

请根据分析决定下一步行动。
`;
}

// ============================================================================
// 观察阶段提示
// ============================================================================

/**
 * 构建观察阶段提示
 *
 * @param toolResults 工具执行结果
 * @param context ReAct 上下文
 * @returns 观察阶段提示
 */
export function buildObservationPrompt(
  toolResults: Array<{ name: string; result: unknown; error?: string }>,
  context: ReactContext,
): string {
  const resultsDescription = toolResults
    .map((tr, i) => {
      if (tr.error) {
        return `${i + 1}. **${tr.name}** - 执行失败: ${tr.error}`;
      }
      const resultSummary = summarizeToolResult(tr.result);
      return `${i + 1}. **${tr.name}** - ${resultSummary}`;
    })
    .join("\n");

  return `
## 观察阶段

**本轮执行的工具调用结果**：
${resultsDescription}

请分析：
1. 这些结果是否满足用户需求「${context.originalInput}」？
2. 结果的质量和完整性如何？
3. 是否需要进一步操作？

如果信息足够，请直接生成最终回答。
如果还需要更多信息，请说明需要什么并继续下一轮。
`;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 总结之前的轮次
 */
function summarizePreviousRounds(rounds: ReactRoundState[]): string {
  if (rounds.length === 0) {
    return "（无）";
  }

  return rounds
    .map((round) => {
      const toolsSummary =
        round.toolCalls && round.toolCalls.length > 0
          ? round.toolCalls.map((tc) => tc.name).join(", ")
          : "无工具调用";

      const outcome = round.goalAchieved
        ? "✓ 目标达成"
        : round.observation || "继续处理";

      return `- 第 ${round.round} 轮: ${toolsSummary} → ${outcome}`;
    })
    .join("\n");
}

/**
 * 总结工具执行结果
 */
function summarizeToolResult(result: unknown): string {
  if (result === null || result === undefined) {
    return "无结果";
  }

  if (typeof result === "string") {
    return result.length > 100 ? result.substring(0, 100) + "..." : result;
  }

  if (Array.isArray(result)) {
    return `返回 ${result.length} 条结果`;
  }

  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;

    // 处理常见的结果格式
    if ("total" in obj && typeof obj.total === "number") {
      return `共 ${obj.total} 条`;
    }
    if ("count" in obj && typeof obj.count === "number") {
      return `共 ${obj.count} 条`;
    }
    if ("results" in obj && Array.isArray(obj.results)) {
      return `返回 ${obj.results.length} 条结果`;
    }
    if ("success" in obj) {
      return obj.success ? "执行成功" : "执行失败";
    }

    return "返回对象数据";
  }

  return String(result);
}

// ============================================================================
// ReactPromptBuilder 类
// ============================================================================

/**
 * ReAct Prompt 构建器类
 *
 * 提供面向对象的接口来构建各阶段的提示
 */
export class ReactPromptBuilder {
  private config: ReactLoopConfig;
  private context: ReactContext;

  constructor(config: ReactLoopConfig, context: ReactContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * 构建系统提示
   */
  buildSystemPrompt(basePrompt: string): string {
    return buildReactSystemPrompt(basePrompt, this.config);
  }

  /**
   * 构建思考阶段提示
   */
  buildThinkingPrompt(): string {
    return buildThinkingPrompt(this.context, this.context.previousRounds);
  }

  /**
   * 构建观察阶段提示
   */
  buildObservationPrompt(
    toolResults: Array<{ name: string; result: unknown; error?: string }>,
  ): string {
    return buildObservationPrompt(toolResults, this.context);
  }

  /**
   * 构建目标评估提示
   *
   * 用于判断是否达成目标
   */
  buildGoalEvaluationPrompt(currentOutput: string): string {
    return `
## 目标评估

**用户原始请求**：${this.context.originalInput}

**当前回答**：
${currentOutput}

请评估：
1. 这个回答是否完整满足了用户需求？
2. 是否还有遗漏的关键信息？
3. 用户可能还需要什么？

如果回答完整，请确认目标达成。
如果有遗漏，请指出需要补充的内容。
`;
  }

  /**
   * 更新上下文
   */
  updateContext(updates: Partial<ReactContext>): void {
    Object.assign(this.context, updates);
  }

  /**
   * 添加轮次记录
   */
  addRoundToContext(round: ReactRoundState): void {
    this.context.previousRounds.push(round);
    this.context.currentRound = round.round + 1;
  }
}

// ============================================================================
// 观察分析器
// ============================================================================

/**
 * 分析观察结果，判断是否达成目标
 *
 * @param toolResults 工具执行结果
 * @param context ReAct 上下文
 * @param responseText AI 生成的响应文本
 * @returns 观察分析结果
 */
export function analyzeObservation(
  toolResults: Array<{ name: string; result: unknown; error?: string }>,
  context: ReactContext,
  responseText: string,
): ObservationAnalysis {
  // 检查是否有工具调用
  const hasToolCalls = toolResults.length > 0;

  // 检查是否有错误
  const hasErrors = toolResults.some((tr) => tr.error);

  // 检查是否有有效结果
  const hasValidResults = toolResults.some(
    (tr) => !tr.error && tr.result !== null && tr.result !== undefined,
  );

  // 基于启发式规则判断目标达成
  let goalAchieved = false;
  let confidence = 0.5;
  let shouldContinue = true;

  // 无工具调用且有响应文本 → 可能是直接回答
  if (!hasToolCalls && responseText.length > 50) {
    goalAchieved = true;
    confidence = 0.8;
    shouldContinue = false;
  }

  // 有有效结果且无错误 → 可能达成目标
  if (hasValidResults && !hasErrors) {
    // 检查响应是否包含总结性语句
    const hasConclusionMarkers =
      responseText.includes("综上") ||
      responseText.includes("总结") ||
      responseText.includes("以上就是") ||
      responseText.includes("希望对您有帮助");

    if (hasConclusionMarkers) {
      goalAchieved = true;
      confidence = 0.9;
      shouldContinue = false;
    } else {
      confidence = 0.6;
    }
  }

  // 有错误 → 可能需要重试或调整
  if (hasErrors) {
    confidence = 0.3;
    shouldContinue = true;
  }

  return {
    summary: hasToolCalls
      ? `执行了 ${toolResults.length} 个工具调用${hasErrors ? "，部分失败" : ""}`
      : "直接生成回答",
    goalAchieved,
    confidence,
    shouldContinue: shouldContinue && !goalAchieved,
    missingInfo: hasErrors
      ? toolResults.filter((tr) => tr.error).map((tr) => tr.name)
      : undefined,
  };
}
