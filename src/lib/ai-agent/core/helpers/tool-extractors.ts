/**
 * 工具调用提取器
 *
 * 从 AI SDK 结果中提取工具调用信息
 *
 * @module ai-agent/core/helpers/tool-extractors
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { AgentToolCall } from "../types";
import type { PendingConfirmation } from "../../tools/types";

// ============================================
// 工具调用提取
// ============================================

/**
 * 从结果中提取工具调用
 *
 * 注意：AI SDK v5.0 中，toolResults 的 result 属性已重命名为 output
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractToolCalls(result: any): AgentToolCall[] {
  const toolCalls: AgentToolCall[] = [];

  if (result.steps) {
    for (const step of result.steps) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          const toolResult = step.toolResults?.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) => r.toolCallId === tc.toolCallId,
          );
          // 兼容 v4 (result) 和 v5 (output)
          const resultData = toolResult?.output ?? toolResult?.result;

          toolCalls.push({
            id: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args ?? tc.input, // v5: args → input
            status: "completed",
            result: resultData,
          });
        }
      }
    }
  }

  return toolCalls;
}

/**
 * 从 steps 提取工具调用
 *
 * 注意：AI SDK v5.0 中，toolResults 的 result 属性已重命名为 output
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractToolCallsFromSteps(steps: any[]): AgentToolCall[] {
  const toolCalls: AgentToolCall[] = [];

  if (!steps) return toolCalls;

  for (const step of steps) {
    if (step.toolCalls) {
      for (const tc of step.toolCalls) {
        // AI SDK v5.0: result → output
        const toolResult = step.toolResults?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r.toolCallId === tc.toolCallId,
        );

        // 兼容 v4 (result) 和 v5 (output)
        const result = toolResult?.output ?? toolResult?.result;

        toolCalls.push({
          id: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args ?? tc.input, // v5: args → input
          status: "completed",
          result,
        });
      }
    }
  }

  return toolCalls;
}

// ============================================
// 待确认操作提取
// ============================================

/**
 * 从工具调用结果中提取待确认操作
 */
export function extractPendingConfirmations(
  toolCalls: AgentToolCall[],
): PendingConfirmation[] {
  const confirmations: PendingConfirmation[] = [];

  for (const tc of toolCalls) {
    // 检查结果中是否包含 __pendingConfirmation
    if (tc.result && typeof tc.result === "object") {
      const result = tc.result as Record<string, unknown>;

      // 情况1: __pendingConfirmation 直接在顶层
      if (result.__pendingConfirmation) {
        confirmations.push(result.__pendingConfirmation as PendingConfirmation);
        continue;
      }

      // 情况2: __pendingConfirmation 在 data 字段中（Tool 标准返回格式）
      if (result.data && typeof result.data === "object") {
        const data = result.data as Record<string, unknown>;
        if (data.__pendingConfirmation) {
          confirmations.push(data.__pendingConfirmation as PendingConfirmation);
        }
      }
    }
  }

  return confirmations;
}

// ============================================
// 完成原因映射
// ============================================

/**
 * 映射完成原因
 */
export function mapFinishReason(
  reason: string | undefined,
): "stop" | "length" | "tool-calls" | "error" {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool-calls":
      return "tool-calls";
    default:
      return "stop";
  }
}
