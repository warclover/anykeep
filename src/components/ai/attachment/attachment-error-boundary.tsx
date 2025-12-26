/**
 * 附件预览错误边界组件
 *
 * 捕获子组件中的 JavaScript 错误，显示友好的回退 UI
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 自定义回退 UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 自定义类名 */
  className?: string;
}

interface AttachmentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// =============================================================================
// 常量
// =============================================================================

const ERROR_TEXT = {
  TITLE: "预览加载失败",
  DESCRIPTION: "无法加载附件预览内容，请重试。",
  RETRY: "重试",
} as const;

// =============================================================================
// 错误边界组件
// =============================================================================

/**
 * 附件预览错误边界
 *
 * 用于包裹附件预览相关组件，捕获渲染错误
 */
export class AttachmentErrorBoundary extends Component<
  AttachmentErrorBoundaryProps,
  AttachmentErrorBoundaryState
> {
  constructor(props: AttachmentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AttachmentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误日志
    console.error("AttachmentErrorBoundary caught an error:", error, errorInfo);

    // 调用外部错误处理回调
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback, className } = this.props;

    if (hasError) {
      // 如果提供了自定义 fallback，使用它
      if (fallback) {
        return fallback;
      }

      // 默认回退 UI
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center p-6 rounded-lg bg-muted/50",
            className,
          )}
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle
            className="size-10 text-amber-500 mb-3"
            aria-hidden="true"
          />
          <h3 className="text-base font-medium text-foreground mb-1">
            {ERROR_TEXT.TITLE}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            {ERROR_TEXT.DESCRIPTION}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {ERROR_TEXT.RETRY}
          </Button>
        </div>
      );
    }

    return children;
  }
}

// =============================================================================
// 函数式包装器（用于 Hooks 场景）
// =============================================================================

export interface WithErrorBoundaryOptions {
  /** 自定义回退 UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * 高阶组件：为组件添加错误边界
 *
 * @example
 * const SafePreview = withAttachmentErrorBoundary(AttachmentPreviewModal);
 */
export function withAttachmentErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {},
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithErrorBoundary: React.FC<P> = (props) => (
    <AttachmentErrorBoundary
      fallback={options.fallback}
      onError={options.onError}
    >
      <WrappedComponent {...props} />
    </AttachmentErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithAttachmentErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}

export default AttachmentErrorBoundary;
