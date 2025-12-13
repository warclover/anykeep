/**
 * 错误边界组件
 * V5.0: 捕获 React 渲染错误，显示友好的错误界面
 *
 * 特点：
 * - 捕获子组件的 JavaScript 错误
 * - 显示友好的错误提示
 * - 提供重试机制
 * - 支持自定义降级 UI
 */

"use client";

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 错误边界 Props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义降级 UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 重试时的回调 */
  onRetry?: () => void;
  /** 是否显示返回首页按钮 */
  showHomeButton?: boolean;
}

/**
 * 错误边界 State
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React 错误边界组件
 * 注意：错误边界只能是 class component
 */
export class ErrorBoundary extends Component<
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

  /**
   * 静态方法：从错误派生状态
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * 错误捕获时调用
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 调用外部错误回调
    this.props.onError?.(error, errorInfo);

    // 开发环境下输出详细错误信息
    if (process.env.NODE_ENV === "development") {
      /* eslint-disable no-console -- 开发环境错误调试日志 */
      console.group("🔴 ErrorBoundary 捕获到错误");
      console.error("Error:", error);
      console.error("Component Stack:", errorInfo.componentStack);
      console.groupEnd();
      /* eslint-enable no-console */
    }
  }

  /**
   * 重试：重置错误状态
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // 调用外部重试回调
    this.props.onRetry?.();
  };

  /**
   * 返回首页
   */
  handleGoHome = (): void => {
    if (typeof window !== "undefined") {
      window.location.href = "/home";
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, showHomeButton = true } = this.props;

    if (hasError) {
      // 使用自定义降级 UI
      if (fallback) {
        return fallback;
      }

      // 默认错误 UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
          <div className="flex flex-col items-center text-center">
            {/* 错误图标 */}
            <div className="mb-4 rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>

            {/* 错误标题 */}
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              页面出现了问题
            </h2>

            {/* 错误描述 */}
            <p className="mb-6 max-w-md text-muted-foreground">
              {error?.message || "发生了意外错误，请刷新页面重试"}
            </p>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                variant="default"
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>

              {showHomeButton && (
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  返回首页
                </Button>
              )}
            </div>

            {/* 开发环境显示详细错误 */}
            {process.env.NODE_ENV === "development" && error && (
              <details className="mt-8 w-full max-w-2xl text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  查看错误详情（仅开发环境显示）
                </summary>
                <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * 数据加载错误边界属性
 * 专为数据加载场景优化（预留用于未来 DataErrorBoundary 组件）
 */
interface _DataErrorBoundaryProps {
  children: ReactNode;
  /** 错误时显示的消息 */
  errorMessage?: string;
  /** 重试回调 */
  onRetry?: () => void;
}

/**
 * 数据加载错误组件
 * 用于 API 请求失败等场景
 */
export function DataErrorFallback({
  error,
  onRetry,
  message = "加载数据时出现问题",
}: {
  error?: Error | null;
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground" />
      <p className="mb-4 text-muted-foreground">
        {message}
        {error?.message && process.env.NODE_ENV === "development" && (
          <span className="block text-xs text-destructive">
            {error.message}
          </span>
        )}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      )}
    </div>
  );
}

/**
 * 简化版错误边界 Hook
 * 用于函数组件中处理渲染错误（需要配合 ErrorBoundary 使用）
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  // 如果有错误，抛出以便 ErrorBoundary 捕获
  if (error) {
    throw error;
  }

  const handleError = React.useCallback((err: Error) => {
    setError(err);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { handleError, clearError };
}
