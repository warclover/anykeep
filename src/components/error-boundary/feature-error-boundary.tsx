/**
 * 功能模块错误边界组件
 *
 * 用于包裹特定功能模块，提供局部错误隔离
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "./error-reporter";
import { FeatureFallbackUI } from "./fallback-ui";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "./types";

interface FeatureErrorBoundaryProps extends ErrorBoundaryProps {
  /** 功能模块名称（必填） */
  feature: string;
  /** 是否使用紧凑模式 */
  compact?: boolean;
}

/**
 * 功能模块错误边界
 *
 * 用于包裹特定功能区域，实现局部错误隔离
 * 当某个功能出错时，不会影响其他功能的正常使用
 *
 * @example
 * ```tsx
 * <FeatureErrorBoundary feature="bookmark">
 *   <BookmarkList />
 * </FeatureErrorBoundary>
 * ```
 */
export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
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

    // 上报错误（带功能模块标签）
    reportError(error, errorInfo, {
      feature: this.props.feature,
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
        <FeatureFallbackUI
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          feature={this.props.feature}
          showDetails={this.props.showDetails}
          onRetry={this.handleRetry}
          compact={this.props.compact}
        />
      );
    }

    return this.props.children;
  }
}

export default FeatureErrorBoundary;
