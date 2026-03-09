/**
 * ReAct 循环执行器
 *
 * 实现 Think → Act → Observe 循环，让 AI 能够：
 * - 分析当前状态和目标
 * - 执行工具调用
 * - 观察结果并决定是否继续
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type { AgentContext, AgentStreamChunk } from "../core/types";
import type {
  UnifiedStreamChunk,
  ThinkingChunk,
} from "../../ai-skills/output/types";
import type {
  ReactLoopConfig,
  ReactLoopConfigRequired,
  ReactRoundState,
  ReactExecutionResult,
  ReactFinishReason,
  ReactToolCall,
} from "./types";
import {
  createReactConfig,
  createInitialRoundState,
  createReactContext,
} from "./types";
import { ReactPromptBuilder, analyzeObservation } from "./react-prompt-builder";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 原子执行器类型
 *
 * 用于注入 Agent 的执行函数
 */
export type AtomicExecutor = (
  input: string,
  context: AgentContext,
) => AsyncGenerator<AgentStreamChunk>;

/**
 * ReAct 循环事件回调
 */
export interface ReactLoopCallbacks {
  /** 循环开始时调用 */
  onLoopStart?: (config: ReactLoopConfigRequired) => void;
  /** 轮次开始时调用 */
  onRoundStart?: (round: number, phase: "think" | "act" | "observe") => void;
  /** 轮次结束时调用 */
  onRoundEnd?: (state: ReactRoundState) => void;
  /** 循环结束时调用 */
  onLoopEnd?: (result: ReactExecutionResult) => void;
}

// ============================================================================
// ReactLoopExecutor 类
// ============================================================================

/**
 * ReAct 循环执行器
 *
 * 包装原子执行器，实现 Think → Act → Observe 循环
 */
export class ReactLoopExecutor {
  private config: ReactLoopConfigRequired;
  private callbacks: ReactLoopCallbacks;

  constructor(
    config: ReactLoopConfig = {},
    callbacks: ReactLoopCallbacks = {},
  ) {
    this.config = createReactConfig(config);
    this.callbacks = callbacks;
  }

  /**
   * 执行 ReAct 循环
   *
   * @param input - 用户输入
   * @param context - Agent 上下文
   * @param atomicExecutor - 原子执行器
   * @yields 统一流式输出块
   */
  async *executeWithReact(
    input: string,
    context: AgentContext,
    atomicExecutor: AtomicExecutor,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 验证 userId 存在性
    if (!context.userId) {
      logger.error(
        { input: input.slice(0, 50) },
        "ReactLoopExecutor: userId is required but not provided",
      );
      yield {
        type: "error",
        data: {
          message: "用户身份验证失败，请重新登录",
          code: "MISSING_USER_ID",
          retryable: false,
        },
      };
      return;
    }

    const startTime = Date.now();
    const reactContext = createReactContext(input);
    const promptBuilder = new ReactPromptBuilder(this.config, reactContext);

    // 通知循环开始
    this.callbacks.onLoopStart?.(this.config);

    logger.debug(
      {
        input: input.slice(0, 100),
        maxRounds: this.config.maxRounds,
        userId: context.userId.slice(0, 8),
      },
      "ReactLoopExecutor: Starting ReAct loop",
    );

    let totalTokensUsed = 0;
    let lastResponse = "";
    let finishReason: ReactFinishReason = "max_rounds";

    for (let round = 1; round <= this.config.maxRounds; round++) {
      reactContext.currentRound = round;
      const roundState = createInitialRoundState(round);

      // ========================================
      // PHASE 1: THINK - 思考阶段
      // ========================================
      this.callbacks.onRoundStart?.(round, "think");

      if (this.config.showThinking) {
        yield this.createThinkingChunk(
          "react_think",
          promptBuilder.buildThinkingPrompt(),
          round,
        );
      }

      roundState.phase = "think";
      roundState.thinking = `第 ${round} 轮：分析用户需求「${input.slice(0, 50)}${input.length > 50 ? "..." : ""}」`;

      // ========================================
      // PHASE 2: ACT - 行动阶段
      // ========================================
      this.callbacks.onRoundStart?.(round, "act");
      roundState.phase = "act";

      if (this.config.showThinking) {
        yield this.createThinkingChunk(
          "react_act",
          `执行工具调用或生成回答...`,
          round,
        );
      }

      // 收集本轮的工具调用和响应
      const toolCalls: ReactToolCall[] = [];
      let roundResponse = "";
      let hasToolCalls = false;

      try {
        // 执行原子操作
        for await (const chunk of atomicExecutor(input, context)) {
          // 转换并传递 chunk
          const adaptedChunk = this.adaptAtomicChunk(chunk);
          yield adaptedChunk;

          // 收集工具调用信息
          if (chunk.type === "tool-call" && chunk.toolCall) {
            hasToolCalls = true;
            toolCalls.push({
              name: chunk.toolCall.toolName,
              args: chunk.toolCall.args,
              result: chunk.toolCall.result,
              error: chunk.toolCall.error,
              durationMs: chunk.toolCall.durationMs,
            });
          }

          // 收集文本响应
          if (chunk.type === "text" && chunk.text) {
            roundResponse += chunk.text;
          }

          // 收集最终结果
          if (chunk.type === "done" && chunk.result) {
            lastResponse = chunk.result.content;
            if (chunk.result.tokensUsed) {
              totalTokensUsed += chunk.result.tokensUsed.total;
            }
          }
        }
      } catch (error) {
        logger.error(
          {
            round,
            error: error instanceof Error ? error.message : String(error),
          },
          "ReactLoopExecutor: Error in atomic execution",
        );

        yield {
          type: "error",
          data: {
            message: error instanceof Error ? error.message : "执行出错",
            code: "REACT_EXECUTION_ERROR",
            retryable: true,
          },
        };

        finishReason = "error";
        break;
      }

      roundState.toolCalls = toolCalls;
      roundState.action = hasToolCalls
        ? `调用了 ${toolCalls.length} 个工具`
        : "直接生成回答";

      // ========================================
      // PHASE 3: OBSERVE - 观察阶段
      // ========================================
      if (this.config.enableObservation) {
        this.callbacks.onRoundStart?.(round, "observe");
        roundState.phase = "observe";

        // 分析观察结果
        const observation = analyzeObservation(
          toolCalls.map((tc) => ({
            name: tc.name,
            result: tc.result,
            error: tc.error,
          })),
          reactContext,
          roundResponse || lastResponse,
        );

        roundState.observation = observation.summary;
        roundState.goalAchieved = observation.goalAchieved;
        roundState.shouldContinue = observation.shouldContinue;

        if (this.config.showThinking) {
          yield this.createThinkingChunk(
            "react_observe",
            `观察结果：${observation.summary}\n` +
              `目标达成：${observation.goalAchieved ? "是" : "否"} (置信度: ${Math.round(observation.confidence * 100)}%)`,
            round,
          );
        }

        logger.debug(
          {
            round,
            goalAchieved: observation.goalAchieved,
            confidence: observation.confidence,
            shouldContinue: observation.shouldContinue,
          },
          "ReactLoopExecutor: Observation analysis",
        );

        // 判断是否结束循环
        if (observation.goalAchieved) {
          finishReason = "goal_achieved";
          roundState.endedAt = Date.now();
          promptBuilder.addRoundToContext(roundState);
          this.callbacks.onRoundEnd?.(roundState);

          // 发送完成思考块
          if (this.config.showThinking) {
            yield this.createThinkingChunk(
              "react_complete",
              `✓ 目标已达成，共执行 ${round} 轮`,
              round,
              true,
            );
          }
          break;
        }

        // 无工具调用且有响应 → 视为直接回答，结束循环
        if (!hasToolCalls && (roundResponse || lastResponse)) {
          finishReason = "no_tool_calls";
          roundState.goalAchieved = true;
          roundState.endedAt = Date.now();
          promptBuilder.addRoundToContext(roundState);
          this.callbacks.onRoundEnd?.(roundState);

          if (this.config.showThinking) {
            yield this.createThinkingChunk(
              "react_complete",
              `✓ 已直接生成回答，共执行 ${round} 轮`,
              round,
              true,
            );
          }
          break;
        }
      } else {
        // 未启用观察阶段，每轮后都退出
        roundState.goalAchieved = !hasToolCalls;
        roundState.shouldContinue = hasToolCalls;

        if (!hasToolCalls) {
          finishReason = "no_tool_calls";
          roundState.endedAt = Date.now();
          promptBuilder.addRoundToContext(roundState);
          this.callbacks.onRoundEnd?.(roundState);
          break;
        }
      }

      roundState.endedAt = Date.now();
      promptBuilder.addRoundToContext(roundState);
      this.callbacks.onRoundEnd?.(roundState);

      // 检查是否达到最大轮次
      if (round >= this.config.maxRounds) {
        if (this.config.showThinking) {
          yield this.createThinkingChunk(
            "react_complete",
            `⚠ 已达到最大轮次 (${this.config.maxRounds})`,
            round,
            true,
          );
        }
      }
    }

    // 构建最终结果
    const totalDurationMs = Date.now() - startTime;
    const result: ReactExecutionResult = {
      success: finishReason !== "error",
      response: lastResponse,
      rounds: reactContext.previousRounds,
      totalRounds: reactContext.previousRounds.length,
      goalAchieved:
        finishReason === "goal_achieved" || finishReason === "no_tool_calls",
      finishReason,
      totalDurationMs,
      tokensUsed:
        totalTokensUsed > 0
          ? {
              prompt: 0,
              completion: 0,
              total: totalTokensUsed,
            }
          : undefined,
    };

    logger.info(
      {
        finishReason,
        totalRounds: result.totalRounds,
        goalAchieved: result.goalAchieved,
        durationMs: totalDurationMs,
      },
      "ReactLoopExecutor: ReAct loop completed",
    );

    this.callbacks.onLoopEnd?.(result);
  }

  /**
   * 创建思考块
   */
  private createThinkingChunk(
    phase: ThinkingChunk["data"]["phase"],
    content: string,
    round: number,
    isFinal: boolean = false,
  ): ThinkingChunk {
    return {
      type: "thinking",
      data: {
        phase,
        content,
        timestamp: Date.now(),
        round,
        isFinal,
      },
    };
  }

  /**
   * 适配原子输出块到统一输出块
   */
  private adaptAtomicChunk(chunk: AgentStreamChunk): UnifiedStreamChunk {
    switch (chunk.type) {
      case "text":
        return {
          type: "text",
          data: {
            text: chunk.text || "",
            isPartial: true,
          },
        };

      case "tool-call":
        return {
          type: "tool-call",
          data: {
            toolName: chunk.toolCall?.toolName || "",
            args: chunk.toolCall?.args || {},
            status: chunk.toolCall?.status || "pending",
            result: chunk.toolCall?.result,
            error: chunk.toolCall?.error,
          },
        };

      case "tool-result":
        // 工具结果通过 tool-call 块的 result 字段返回
        return {
          type: "text",
          data: {
            text: "",
            isPartial: true,
          },
        };

      case "confirmation":
        // 适配 PendingConfirmation 类型到 ConfirmationChunk
        // PendingConfirmation 使用 confirmationId, description, impactSummary
        // ConfirmationChunk 使用 id, title, message, options
        return {
          type: "confirmation",
          data: {
            id: chunk.confirmation?.confirmationId || "",
            title: chunk.confirmation?.description || "确认操作",
            message: chunk.confirmation?.impactSummary || "",
            options: [
              { id: "confirm", label: "确认", primary: true },
              {
                id: "cancel",
                label: "取消",
                danger: chunk.confirmation?.riskLevel === "high",
              },
            ],
            preview: chunk.confirmation?.affectedItems,
            timeout: chunk.confirmation?.expiresAt
              ? new Date(chunk.confirmation.expiresAt).getTime() - Date.now()
              : undefined,
          },
        };

      case "error":
        return {
          type: "error",
          data: {
            message: chunk.error || "Unknown error",
            code: "AGENT_ERROR",
            retryable: true,
          },
        };

      case "done":
        return {
          type: "done",
          data: {
            success: chunk.result?.success ?? true,
            summary: chunk.result?.content,
            tokensUsed: chunk.result?.tokensUsed?.total,
            durationMs: chunk.result?.durationMs,
            mode: "atomic",
            conversationId: chunk.result?.conversationId,
          },
        };

      default:
        // 兜底：返回空文本块
        return {
          type: "text",
          data: {
            text: "",
            isPartial: true,
          },
        };
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReactLoopConfig>): void {
    this.config = createReactConfig({
      ...this.config,
      ...config,
    });
  }

  /**
   * 获取当前配置
   */
  getConfig(): ReactLoopConfigRequired {
    return { ...this.config };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 ReAct 循环执行器
 */
export function createReactLoopExecutor(
  config?: ReactLoopConfig,
  callbacks?: ReactLoopCallbacks,
): ReactLoopExecutor {
  return new ReactLoopExecutor(config, callbacks);
}
