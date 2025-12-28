/**
 * AI 助手专用错误边界组件
 *
 * 为 AI 功能提供特殊的错误处理和降级显示
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "./error-reporter";
import { AIFallbackUI } from "./fallback-ui";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "./types";

interface AIErrorBoundaryProps extends ErrorBoundaryProps {
  /** 会话 ID */
  conversationId?: string;
  /** 用户 ID */
  userId?: string;
}

/**
 * AI 助手错误边界
 *
 * 专门用于 AI 相关组件，提供针对性的错误处理
 * 记录额外的 AI 上下文信息便于问题排查
 *
 * @example
 * ```tsx
 * <AIErrorBoundary conversationId={id} userId={userId}>
 *   <AIPanelContent />
 * </AIErrorBoundary>
 * ```
 */
export class AIErrorBoundary extends Component<
  AIErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: AIErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 上报错误（带 AI 上下文）
    reportError(error, errorInfo, {
      feature: "ai",
      userId: this.props.userId,
      extra: {
        conversationId: this.props.conversationId,
      },
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <AIFallbackUI
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          feature="ai"
          showDetails={this.props.showDetails}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default AIErrorBoundary;
