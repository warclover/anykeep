/**
 * UnifiedOutputAdapter - 统一输出适配器
 *
 * 职责：
 * - 将原子模式（KnowledgeAgent）的输出转换为统一格式
 * - 将编排模式的输出转换为统一格式
 * - 提供一致的输出接口给前端
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { AgentStreamChunk } from "../../ai-agent/core/types";
import type { PendingConfirmation } from "../../ai-agent/tools/types";
import type {
  UnifiedStreamChunk,
  OrchestrationStreamChunk,
  ConfirmOption,
} from "./types";

/**
 * 适配器配置
 */
interface OutputAdapterConfig {
  /** 是否包含调试信息 */
  includeDebugInfo?: boolean;
  /** 是否显示工具调用详情 */
  showToolCallDetails?: boolean;
}

/**
 * 统一输出适配器
 */
export class UnifiedOutputAdapter {
  private config: Required<OutputAdapterConfig>;

  constructor(config: OutputAdapterConfig = {}) {
    this.config = {
      includeDebugInfo: false,
      showToolCallDetails: true,
      ...config,
    };
  }

  /**
   * 适配原子模式输出
   *
   * 将 KnowledgeAgent 的 AgentStreamChunk 转换为 UnifiedStreamChunk
   */
  adaptAtomicChunk(chunk: AgentStreamChunk): UnifiedStreamChunk {
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
        if (!this.config.showToolCallDetails) {
          // 如果不显示工具调用详情，返回一个简单的文本提示
          return {
            type: "text",
            data: {
              text: "",
              isPartial: true,
            },
          };
        }

        return {
          type: "tool-call",
          data: {
            toolName: chunk.toolCall?.toolName || "unknown",
            args: chunk.toolCall?.args || {},
            status: chunk.toolCall?.status || "pending",
            result: chunk.toolCall?.result,
            error: chunk.toolCall?.error,
          },
        };

      case "tool-result":
        // 工具结果通常已经在 tool-call 中处理
        // 这里返回一个空文本，避免重复
        return {
          type: "text",
          data: {
            text: "",
            isPartial: true,
          },
        };

      case "confirmation":
        return {
          type: "confirmation",
          data: this.adaptConfirmation(chunk.confirmation!),
        };

      case "error":
        return {
          type: "error",
          data: {
            message: chunk.error || "Unknown error",
            retryable: true,
          },
        };

      case "done":
        return {
          type: "done",
          data: {
            success: chunk.result?.success ?? false,
            summary: chunk.result?.content,
            tokensUsed: chunk.result?.tokensUsed?.total,
            durationMs: chunk.result?.durationMs,
            mode: "atomic",
          },
        };

      default:
        // 未知类型，返回空文本
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
   * 适配编排模式输出
   *
   * 编排模式输出已经是统一格式，直接返回
   */
  adaptOrchestrationChunk(chunk: OrchestrationStreamChunk): UnifiedStreamChunk {
    // 编排模式的输出格式与统一格式兼容
    return chunk as UnifiedStreamChunk;
  }

  /**
   * 适配确认请求
   */
  private adaptConfirmation(confirmation: PendingConfirmation): {
    id: string;
    title: string;
    message: string;
    options: ConfirmOption[];
    preview?: unknown;
  } {
    // 将 PendingConfirmation 转换为统一的确认格式
    const options: ConfirmOption[] = [
      {
        id: "confirm",
        label: "确认",
        primary: true,
      },
      {
        id: "cancel",
        label: "取消",
      },
    ];

    return {
      id: confirmation.confirmationId,
      title: confirmation.toolName,
      message: confirmation.description || confirmation.impactSummary,
      options,
      preview: confirmation.affectedItems,
    };
  }

  /**
   * 创建路由信息块
   */
  createRoutingChunk(
    mode: "atomic" | "orchestration",
    reason: string,
    skill: string | null,
    intentType?: string,
    complexityLevel?: string,
  ): UnifiedStreamChunk {
    return {
      type: "routing",
      data: {
        mode,
        reason,
        skill,
        intentType,
        complexityLevel,
      },
    };
  }

  /**
   * 创建回退通知块
   */
  createFallbackChunk(reason: string): UnifiedStreamChunk {
    return {
      type: "fallback",
      data: {
        reason,
        originalMode: "orchestration",
        fallbackMode: "atomic",
      },
    };
  }

  /**
   * 创建错误块
   */
  createErrorChunk(
    message: string,
    code?: string,
    retryable = false,
  ): UnifiedStreamChunk {
    return {
      type: "error",
      data: {
        message,
        code,
        retryable,
      },
    };
  }

  /**
   * 过滤空输出
   *
   * 过滤掉空的文本块和其他无意义的输出
   */
  filterEmptyChunks(chunks: UnifiedStreamChunk[]): UnifiedStreamChunk[] {
    return chunks.filter((chunk) => {
      if (chunk.type === "text") {
        return chunk.data.text.length > 0;
      }
      return true;
    });
  }

  /**
   * 合并连续的文本块
   */
  mergeTextChunks(chunks: UnifiedStreamChunk[]): UnifiedStreamChunk[] {
    const result: UnifiedStreamChunk[] = [];
    let pendingText = "";

    for (const chunk of chunks) {
      if (chunk.type === "text") {
        pendingText += chunk.data.text;
      } else {
        // 遇到非文本块时，先输出累积的文本
        if (pendingText.length > 0) {
          result.push({
            type: "text",
            data: {
              text: pendingText,
              isPartial: false,
            },
          });
          pendingText = "";
        }
        result.push(chunk);
      }
    }

    // 输出最后的文本
    if (pendingText.length > 0) {
      result.push({
        type: "text",
        data: {
          text: pendingText,
          isPartial: false,
        },
      });
    }

    return result;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OutputAdapterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建统一输出适配器
 */
export function createUnifiedOutputAdapter(
  config?: OutputAdapterConfig,
): UnifiedOutputAdapter {
  return new UnifiedOutputAdapter(config);
}

/**
 * 默认统一输出适配器实例
 */
export const unifiedOutputAdapter = new UnifiedOutputAdapter();
