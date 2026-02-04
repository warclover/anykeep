/**
 * Lazy Loading Error Boundary
 *
 * 用于捕获 React.lazy() 动态导入时的加载错误
 * 防止 Webpack chunk 加载失败导致页面崩溃
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/client-logger";

interface LazyErrorBoundaryProps {
  children: ReactNode;
  /** 自定义错误回退 UI */
  fallback?: ReactNode;
  /** 是否显示重试按钮 */
  showRetry?: boolean;
  /** 重试回调 */
  onRetry?: () => void;
  /** 错误消息 */
  errorMessage?: string;
}

interface LazyErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 懒加载错误边界组件
 *
 * 捕获动态导入时的 chunk 加载错误，提供友好的错误提示和重试机制
 *
 * @example
 * ```tsx
 * <LazyErrorBoundary>
 *   <Suspense fallback={<Loading />}>
 *     <LazyComponent />
 *   </Suspense>
 * </LazyErrorBoundary>
 * ```
 */
export class LazyErrorBoundary extends Component<
  LazyErrorBoundaryProps,
  LazyErrorBoundaryState
> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误日志（可接入监控系统）
    clientLogger.error(
      {
        ...{
          error: error.message,
          componentStack: errorInfo.componentStack,
        },
      },
      "[LazyErrorBoundary] Component loading failed:",
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      // 使用自定义 fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center gap-3">
          <AlertCircle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {this.props.errorMessage ?? "组件加载失败"}
          </p>
          {this.props.showRetry !== false && (
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              重试
            </Button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 简化版错误边界 - 静默处理错误
 * 适用于非关键组件，错误时返回 null
 */
export class SilentErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
