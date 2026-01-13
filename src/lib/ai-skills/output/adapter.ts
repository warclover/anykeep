/**
 * UnifiedOutputAdapter - 统一输出适配器
 *
 * 职责：
 * - 将原子模式（KnowledgeAgent）的输出转换为统一格式
 * - 将编排模式的输出转换为统一格式
 * - 提供一致的输出接口给前端
 * - 集成响应风格化（Phase 1.3）
 *
 * @version 1.1.0
 * @since 2025-12-24
 */

import type { AgentStreamChunk } from "../../ai-agent/core/types";
import type { PendingConfirmation } from "../../ai-agent/tools/types";
import type { IntentType } from "../router/types";
import type {
  UnifiedStreamChunk,
  OrchestrationStreamChunk,
  ConfirmOption,
} from "./types";
import {
  ResponseStyler,
  type ResponseStylerConfig,
  type StyledResponse,
  type FollowUpSuggestion,
} from "../response";

/**
 * 适配器配置
 */
interface OutputAdapterConfig {
  /** 是否包含调试信息 */
  includeDebugInfo?: boolean;
  /** 是否显示工具调用详情 */
  showToolCallDetails?: boolean;
  /** 是否启用响应风格化 */
  enableResponseStyling?: boolean;
  /** 响应风格化配置 */
  responseStylerConfig?: ResponseStylerConfig;
}

/**
 * 统一输出适配器
 */
export class UnifiedOutputAdapter {
  private config: Required<
    Omit<OutputAdapterConfig, "responseStylerConfig">
  > & {
    responseStylerConfig?: ResponseStylerConfig;
  };
  private responseStyler: ResponseStyler;

  constructor(config: OutputAdapterConfig = {}) {
    this.config = {
      includeDebugInfo: config.includeDebugInfo ?? false,
      showToolCallDetails: config.showToolCallDetails ?? true,
      enableResponseStyling: config.enableResponseStyling ?? true,
      responseStylerConfig: config.responseStylerConfig,
    };
    this.responseStyler = new ResponseStyler(config.responseStylerConfig);
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
        // confirmation 在此 case 中必定存在，但 TypeScript 无法推断
        if (!chunk.confirmation) {
          throw new Error("Confirmation data missing in confirmation chunk");
        }
        return {
          type: "confirmation",
          data: this.adaptConfirmation(chunk.confirmation),
        };

      case "error":
        return {
          type: "error",
          data: {
            message: chunk.error || "Unknown error",
            code: "ATOMIC_ERROR",
            retryable: this.isRetryableError(chunk.error),
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
   * [P1-8 扩展支持 workflow 模式]
   */
  createRoutingChunk(
    mode: "atomic" | "orchestration" | "workflow",
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
   * 创建思考过程块
   *
   * 用于展示 AI 的深度思考过程（慢思考层）
   *
   * @param phase - 思考阶段
   * @param content - 思考内容
   * @param options - 可选参数
   */
  createThinkingChunk(
    phase:
      | "understanding"
      | "planning"
      | "deciding"
      | "executing"
      | "slow_thinking"
      | "react_think"
      | "react_act"
      | "react_observe"
      | "react_complete",
    content: string,
    options?: {
      round?: number;
      isFinal?: boolean;
    },
  ): UnifiedStreamChunk {
    return {
      type: "thinking",
      data: {
        phase,
        content,
        timestamp: Date.now(),
        round: options?.round,
        isFinal: options?.isFinal,
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
    if (config.responseStylerConfig) {
      this.responseStyler.updateConfig(config.responseStylerConfig);
    }
  }

  // ============================================
  // 响应风格化方法 (Phase 1.3)
  // ============================================

  /**
   * 风格化文本响应
   *
   * 移除机械化表达，应用模板，添加跟进建议
   *
   * @param text - 原始响应文本
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @param variables - 模板变量（可选）
   * @returns 风格化响应结果
   */
  styleResponse(
    text: string,
    intentType: IntentType,
    subType?: string,
    variables?: Record<string, string | number>,
  ): StyledResponse {
    if (!this.config.enableResponseStyling) {
      return {
        originalText: text,
        styledText: text,
        followUpSuggestions: [],
        templateApplied: false,
        detectedBannedPhrases: [],
        bannedPhrasesRemoved: false,
      };
    }

    return this.responseStyler.format(text, intentType, subType, variables);
  }

  /**
   * 创建带风格化的文本块
   *
   * @param text - 原始文本
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @param variables - 模板变量
   * @returns 风格化后的 UnifiedStreamChunk
   */
  createStyledTextChunk(
    text: string,
    intentType: IntentType,
    subType?: string,
    variables?: Record<string, string | number>,
  ): UnifiedStreamChunk {
    const styled = this.styleResponse(text, intentType, subType, variables);

    return {
      type: "text",
      data: {
        text: styled.styledText,
        isPartial: false,
      },
    };
  }

  /**
   * 创建跟进建议块
   *
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @returns 跟进建议 UnifiedStreamChunk
   */
  createSuggestionsChunk(
    intentType: IntentType,
    subType?: string,
  ): UnifiedStreamChunk {
    const suggestions = this.responseStyler.getSuggestions(intentType, subType);

    return {
      type: "suggestions",
      data: {
        suggestions: suggestions.map((s) => ({
          text: s.text,
          action: s.action,
          icon: s.icon,
        })),
      },
    };
  }

  /**
   * 快速风格化文本（仅移除禁用短语）
   *
   * @param text - 原始文本
   * @returns 风格化后的文本
   */
  quickStyleText(text: string): string {
    if (!this.config.enableResponseStyling) {
      return text;
    }
    return this.responseStyler.quickFormat(text);
  }

  /**
   * 获取跟进建议
   *
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @returns 跟进建议列表
   */
  getFollowUpSuggestions(
    intentType: IntentType,
    subType?: string,
  ): FollowUpSuggestion[] {
    return this.responseStyler.getSuggestions(intentType, subType);
  }

  /**
   * 验证响应质量
   *
   * @param text - 响应文本
   * @returns 验证结果
   */
  validateResponse(text: string): {
    isValid: boolean;
    issues: string[];
  } {
    return this.responseStyler.validate(text);
  }

  /**
   * 获取 ResponseStyler 实例
   *
   * @returns ResponseStyler 实例
   */
  getResponseStyler(): ResponseStyler {
    return this.responseStyler;
  }

  /**
   * 判断错误是否可重试
   *
   * 可重试错误：网络超时、限流、服务暂时不可用
   * 不可重试错误：认证失败、参数验证失败、权限不足
   *
   * @param errorMessage - 错误信息
   * @returns 是否可重试
   */
  private isRetryableError(errorMessage?: string): boolean {
    if (!errorMessage) return false;

    const lowerMessage = errorMessage.toLowerCase();

    // 可重试的错误模式
    const retryablePatterns = [
      "timeout",
      "timed out",
      "rate limit",
      "429",
      "502",
      "503",
      "504",
      "network",
      "connection",
      "temporarily",
      "overloaded",
      "retry",
    ];

    // 不可重试的错误模式
    const nonRetryablePatterns = [
      "unauthorized",
      "401",
      "403",
      "forbidden",
      "invalid",
      "not found",
      "404",
      "validation",
      "permission",
    ];

    // 检查不可重试模式
    for (const pattern of nonRetryablePatterns) {
      if (lowerMessage.includes(pattern)) {
        return false;
      }
    }

    // 检查可重试模式
    for (const pattern of retryablePatterns) {
      if (lowerMessage.includes(pattern)) {
        return true;
      }
    }

    // 默认不可重试（保守策略）
    return false;
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
