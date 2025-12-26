/**
 * 错误恢复处理器
 *
 * 智能处理 AI Agent 错误，尝试自动恢复
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import {
  type AgentError,
  type AgentErrorContext,
  AgentErrorType,
  createAgentError,
} from "./error-types";
import {
  type RecoveryStrategy,
  getRecoveryStrategies,
  getRetryConfig,
  getFallbackTool,
  calculateRetryDelay,
} from "./recovery-strategies";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 恢复上下文
 */
export interface RecoveryContext {
  /** 请求 ID */
  requestId: string;
  /** 用户 ID */
  userId?: string;
  /** 部分结果（如果有） */
  partialResult?: unknown;
  /** 当前重试次数 */
  currentRetryCount?: number;
}

/**
 * 恢复结果
 */
export interface RecoveryResult {
  /** 恢复是否成功 */
  success: boolean;
  /** 执行的策略 */
  action: RecoveryStrategy | "retry_exhausted" | "no_fallback";
  /** 重试信息（如果是重试策略） */
  retryWith?: {
    toolName?: string;
    params?: unknown;
  };
  /** 用户提示消息 */
  userMessage?: string;
  /** 澄清请求（如果需要用户输入） */
  clarificationNeeded?: boolean;
  /** 部分结果（如果是优雅降级） */
  partialResult?: unknown;
  /** 建议操作 */
  suggestion?: string;
}

// =============================================================================
// 错误恢复处理器类
// =============================================================================

/**
 * 错误恢复处理器
 */
export class ErrorRecoveryHandler {
  /** 重试计数器（按请求 ID + 工具名） */
  private retryCount = new Map<string, number>();

  /**
   * 处理错误并尝试恢复
   */
  async handleError(
    error: AgentError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    const strategies = getRecoveryStrategies(error.type);
    const errorKey = this.getErrorKey(error, context);

    logger.warn(
      {
        event: "agent_error",
        errorType: error.type,
        message: error.message,
        context: error.context,
        strategies,
      },
      `ErrorRecoveryHandler: 处理错误 ${error.type}`,
    );

    // 依次尝试恢复策略
    for (const strategy of strategies) {
      const result = await this.tryStrategy(strategy, error, context, errorKey);
      if (result.success) {
        logger.info(
          {
            event: "error_recovered",
            strategy,
            errorType: error.type,
          },
          `ErrorRecoveryHandler: 恢复成功 (${strategy})`,
        );
        return result;
      }
    }

    // 所有策略都失败
    logger.error(
      {
        event: "error_recovery_failed",
        errorType: error.type,
        strategies,
      },
      "ErrorRecoveryHandler: 所有恢复策略失败",
    );

    return {
      success: false,
      action: "abort",
      userMessage: this.getUserFriendlyMessage(error),
    };
  }

  /**
   * 执行具体的恢复策略
   */
  private async tryStrategy(
    strategy: RecoveryStrategy,
    error: AgentError,
    context: RecoveryContext,
    errorKey: string,
  ): Promise<RecoveryResult> {
    switch (strategy) {
      case "retry":
        return this.handleRetry(error, context, errorKey);

      case "fallback_tool":
        return this.handleFallbackTool(error);

      case "refresh_context":
        return this.handleRefreshContext(error);

      case "ask_user":
        return this.handleAskUser(error);

      case "graceful_degrade":
        return this.handleGracefulDegrade(error, context);

      case "abort":
        return { success: false, action: "abort" };
    }
  }

  /**
   * 重试策略
   */
  private async handleRetry(
    error: AgentError,
    context: RecoveryContext,
    errorKey: string,
  ): Promise<RecoveryResult> {
    const currentRetry = this.retryCount.get(errorKey) ?? 0;
    const config = getRetryConfig(error.type);

    if (currentRetry >= config.maxRetries) {
      logger.debug(
        { errorKey, currentRetry, maxRetries: config.maxRetries },
        "ErrorRecoveryHandler: 重试次数已用尽",
      );
      return { success: false, action: "retry_exhausted" };
    }

    // 计算延迟（指数退避）
    const delay = calculateRetryDelay(currentRetry, config);
    await this.sleep(delay);

    // 更新重试计数
    this.retryCount.set(errorKey, currentRetry + 1);

    logger.debug(
      { errorKey, retryCount: currentRetry + 1, delay },
      "ErrorRecoveryHandler: 准备重试",
    );

    return {
      success: true,
      action: "retry",
      retryWith: {
        toolName: error.context?.toolName,
        params: error.context?.params,
      },
    };
  }

  /**
   * 备选工具策略
   */
  private async handleFallbackTool(error: AgentError): Promise<RecoveryResult> {
    const toolName = error.context?.toolName;
    if (!toolName) {
      return { success: false, action: "no_fallback" };
    }

    const fallbackTool = getFallbackTool(toolName);
    if (!fallbackTool) {
      logger.debug({ toolName }, "ErrorRecoveryHandler: 无可用备选工具");
      return { success: false, action: "no_fallback" };
    }

    logger.debug(
      { from: toolName, to: fallbackTool },
      "ErrorRecoveryHandler: 切换到备选工具",
    );

    return {
      success: true,
      action: "fallback_tool",
      retryWith: {
        toolName: fallbackTool,
        params: this.transformParams(error.context?.params, fallbackTool),
      },
    };
  }

  /**
   * 刷新上下文策略
   */
  private async handleRefreshContext(
    error: AgentError,
  ): Promise<RecoveryResult> {
    logger.debug(
      { errorType: error.type },
      "ErrorRecoveryHandler: 请求刷新上下文",
    );

    return {
      success: true,
      action: "refresh_context",
      suggestion: "数据可能已更新，正在刷新...",
    };
  }

  /**
   * 请求用户澄清策略
   */
  private handleAskUser(error: AgentError): RecoveryResult {
    const clarificationQuestion = this.generateClarificationQuestion(error);

    logger.debug(
      { errorType: error.type, question: clarificationQuestion },
      "ErrorRecoveryHandler: 请求用户澄清",
    );

    return {
      success: true,
      action: "ask_user",
      userMessage: clarificationQuestion,
      clarificationNeeded: true,
    };
  }

  /**
   * 优雅降级策略
   */
  private handleGracefulDegrade(
    error: AgentError,
    context: RecoveryContext,
  ): RecoveryResult {
    logger.debug(
      { errorType: error.type, hasPartialResult: !!context.partialResult },
      "ErrorRecoveryHandler: 执行优雅降级",
    );

    return {
      success: true,
      action: "graceful_degrade",
      userMessage: `无法完成完整操作，但${error.suggestedAction ?? "可以尝试其他方式"}`,
      partialResult: context.partialResult,
    };
  }

  /**
   * 生成用户友好的错误信息
   */
  private getUserFriendlyMessage(error: AgentError): string {
    const messages: Record<AgentErrorType, string> = {
      [AgentErrorType.TOOL_NOT_FOUND]: "抱歉，暂时无法执行这个操作。",
      [AgentErrorType.TOOL_PARAM_INVALID]: "请求参数有误，请检查后重试。",
      [AgentErrorType.TOOL_EXECUTION_FAILED]: "操作执行失败，请稍后重试。",
      [AgentErrorType.TOOL_TIMEOUT]: "操作超时，请稍后重试。",
      [AgentErrorType.RESOURCE_NOT_FOUND]:
        "找不到指定的内容，可能已被删除或移动。",
      [AgentErrorType.PERMISSION_DENIED]: "您没有权限执行此操作。",
      [AgentErrorType.DATA_CONFLICT]: "数据发生冲突，请刷新后重试。",
      [AgentErrorType.DATA_VALIDATION_FAILED]: "数据格式不正确，请检查后重试。",
      [AgentErrorType.MODEL_RATE_LIMIT]: "请求过于频繁，请稍后再试。",
      [AgentErrorType.MODEL_CONTEXT_OVERFLOW]: "对话内容过长，请开启新对话。",
      [AgentErrorType.MODEL_RESPONSE_INVALID]: "AI 响应异常，请重试。",
      [AgentErrorType.MODEL_UNAVAILABLE]: "AI 服务暂时不可用，请稍后再试。",
      [AgentErrorType.NETWORK_TIMEOUT]: "网络超时，请检查网络连接。",
      [AgentErrorType.NETWORK_UNAVAILABLE]: "网络不可用，请检查网络连接。",
      [AgentErrorType.UNKNOWN]: "发生未知错误，请稍后重试。",
    };

    return messages[error.type] ?? "发生错误，请稍后重试。";
  }

  /**
   * 生成澄清问题
   */
  private generateClarificationQuestion(error: AgentError): string {
    if (error.type === AgentErrorType.RESOURCE_NOT_FOUND) {
      const params = error.context?.params;
      const paramStr =
        typeof params === "object"
          ? JSON.stringify(params)
          : String(params ?? "");
      return `找不到相关内容，您可以告诉我更具体的信息吗？比如标题或关键词。${paramStr ? `（查询条件：${paramStr}）` : ""}`;
    }

    if (error.type === AgentErrorType.TOOL_PARAM_INVALID) {
      return "请问您能更详细地描述一下需求吗？";
    }

    if (error.type === AgentErrorType.DATA_VALIDATION_FAILED) {
      return "输入的格式似乎不正确，请检查后重新输入。";
    }

    return error.suggestedAction ?? "请问您能提供更多信息吗？";
  }

  /**
   * 转换参数（用于备选工具）
   */
  private transformParams(params: unknown, targetTool: string): unknown {
    // 大多数情况下，备选工具不需要原始参数
    // 这里可以根据需要添加特定的转换逻辑
    if (targetTool === "list_recent") {
      return { limit: 10 };
    }
    if (targetTool === "count_total") {
      return {};
    }
    if (targetTool === "list_smart_lists") {
      return {};
    }
    return params;
  }

  /**
   * 生成错误键（用于重试计数）
   */
  private getErrorKey(error: AgentError, context: RecoveryContext): string {
    const parts: string[] = [error.type];
    if (error.context?.toolName) {
      parts.push(error.context.toolName);
    }
    parts.push(context.requestId);
    return parts.join(":");
  }

  /**
   * 清理过期的重试计数
   */
  clearRetryCount(requestId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.retryCount.keys()) {
      if (key.endsWith(`:${requestId}`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.retryCount.delete(key);
    }
  }

  /**
   * 休眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// 错误分类器
// =============================================================================

/**
 * 将原始错误分类为 AgentError
 */
export function classifyError(
  error: unknown,
  toolName?: string,
  params?: unknown,
): AgentError {
  const context: AgentErrorContext = {
    toolName,
    params,
    originalError: error instanceof Error ? error : undefined,
  };

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 资源不存在
    if (
      message.includes("not found") ||
      message.includes("不存在") ||
      message.includes("does not exist")
    ) {
      return createAgentError(
        AgentErrorType.RESOURCE_NOT_FOUND,
        error.message,
        {
          context,
          suggestedAction: "尝试使用其他关键词搜索",
        },
      );
    }

    // 超时
    if (message.includes("timeout") || message.includes("超时")) {
      return createAgentError(AgentErrorType.TOOL_TIMEOUT, error.message, {
        context,
      });
    }

    // 权限
    if (
      message.includes("permission") ||
      message.includes("权限") ||
      message.includes("unauthorized") ||
      message.includes("forbidden")
    ) {
      return createAgentError(AgentErrorType.PERMISSION_DENIED, error.message, {
        context,
        recoverable: false,
      });
    }

    // 参数错误
    if (
      message.includes("invalid") ||
      message.includes("无效") ||
      message.includes("validation")
    ) {
      return createAgentError(
        AgentErrorType.TOOL_PARAM_INVALID,
        error.message,
        { context },
      );
    }

    // 限流
    if (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    ) {
      return createAgentError(AgentErrorType.MODEL_RATE_LIMIT, error.message, {
        context,
      });
    }

    // 网络错误
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection")
    ) {
      return createAgentError(
        AgentErrorType.NETWORK_UNAVAILABLE,
        error.message,
        { context },
      );
    }

    // 上下文溢出
    if (
      message.includes("context") &&
      (message.includes("overflow") || message.includes("too long"))
    ) {
      return createAgentError(
        AgentErrorType.MODEL_CONTEXT_OVERFLOW,
        error.message,
        { context, recoverable: false },
      );
    }
  }

  // 默认归类为执行失败
  return createAgentError(
    AgentErrorType.TOOL_EXECUTION_FAILED,
    error instanceof Error ? error.message : "Unknown error",
    { context },
  );
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局错误恢复处理器实例
 */
export const errorRecoveryHandler = new ErrorRecoveryHandler();
