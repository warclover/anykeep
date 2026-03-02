/**
 * 全局错误边界组件
 *
 * 捕获整个应用的未处理错误，提供统一的错误处理和降级显示
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "./error-reporter";
import { GlobalFallbackUI } from "./fallback-ui";
import { FeedbackProvider } from "@/components/feedback";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "./types";

/**
 * 全局错误边界
 *
 * 用于包裹整个应用，捕获所有未处理的 React 渲染错误
 *
 * @example
 * ```tsx
 * <GlobalErrorBoundary>
 *   <App />
 * </GlobalErrorBoundary>
 * ```
 */
export class GlobalErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
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
    // 更新 state 保存错误信息
    this.setState({ errorInfo });

    // 上报错误
    reportError(error, errorInfo, {
      feature: this.props.feature || "global",
    });

    // 调用自定义错误处理回调
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
      // 使用自定义降级 UI 或默认 UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <FeedbackProvider>
          <GlobalFallbackUI
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            feature={this.props.feature}
            showDetails={this.props.showDetails}
            onRetry={this.handleRetry}
          />
        </FeedbackProvider>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
