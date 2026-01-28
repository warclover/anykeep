/**
 * 错误边界降级 UI 组件
 *
 * 提供用户友好的错误显示界面
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useFeedback } from "@/components/feedback"; // Import Feedback Hook
import type { FallbackUIProps } from "./types";

/**
 * 功能模块名称映射
 */
const FEATURE_LABELS: Record<string, string> = {
  main: "主页面",
  ai: "AI 助手",
  bookmark: "书签管理",
  import: "导入功能",
  export: "导出功能",
  batch: "批量操作",
  search: "搜索功能",
};

/**
 * 全局降级 UI
 *
 * 用于整页错误显示
 */
export function GlobalFallbackUI({
  error,
  errorInfo,
  feature,
  showDetails = process.env.NODE_ENV === "development",
  onRetry,
}: FallbackUIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { open: openFeedback } = useFeedback(); // Use Feedback Hook
  const featureLabel = feature ? FEATURE_LABELS[feature] || feature : undefined;

  const handleReportError = () => {
    openFeedback({
      type: "bug",
      title: `[自动报告] ${featureLabel || "应用"}发生错误: ${error.name}`,
      description: `我在使用 ${featureLabel || "应用"} 时遇到了错误。\n\n错误信息: ${error.message}`,
      context: {
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack,
        component_stack: errorInfo?.componentStack,
        feature,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl">出了点问题</CardTitle>
          <CardDescription>
            {featureLabel
              ? `${featureLabel}遇到了意外错误`
              : "应用遇到了意外错误"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 text-center">
            请尝试刷新页面。如果问题持续存在，请反馈给我们。
          </p>

          {/* 错误详情（仅开发环境） */}
          {showDetails && error && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-gray-500"
                >
                  <span className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    错误详情
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-lg bg-gray-900 p-4 text-xs font-mono text-gray-100 overflow-auto max-h-48">
                  <div className="text-red-400 font-semibold mb-2">
                    {error.name}: {error.message}
                  </div>
                  {error.stack && (
                    <pre className="whitespace-pre-wrap text-gray-400">
                      {error.stack}
                    </pre>
                  )}
                  {errorInfo?.componentStack && (
                    <>
                      <div className="text-amber-400 font-semibold mt-4 mb-2">
                        Component Stack:
                      </div>
                      <pre className="whitespace-pre-wrap text-gray-400">
                        {errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Button
              className="flex-1"
              onClick={onRetry || (() => window.location.reload())}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新页面
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleReportError}
            >
              <Bug className="h-4 w-4 mr-2" />
              反馈问题
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => (window.location.href = "/")}
          >
            <Home className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * 功能模块降级 UI
 *
 * 用于局部区域错误显示
 */
export function FeatureFallbackUI({
  error,
  feature,
  showDetails = process.env.NODE_ENV === "development",
  onRetry,
  compact = false,
}: FallbackUIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { open: openFeedback } = useFeedback(); // Use Feedback Hook
  const featureLabel = feature ? FEATURE_LABELS[feature] || feature : "此功能";

  const handleReportError = () => {
    openFeedback({
      type: "bug",
      title: `[自动报告] ${featureLabel}加载失败`,
      description: `功能: ${featureLabel}\n错误: ${error.message}`,
      context: {
        error_name: error.name,
        error_message: error.message,
        feature,
      },
    });
  };

  if (compact) {
    return (
      <div className="flex items-center justify-center p-4 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{featureLabel}加载失败</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            onClick={onRetry || (() => window.location.reload())}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            重试
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            onClick={handleReportError}
          >
            <Bug className="h-4 w-4 mr-1" />
            报错
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Card
        className={cn("w-full max-w-sm", "border-amber-200 bg-amber-50/50")}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">{featureLabel}出错了</CardTitle>
              <CardDescription className="text-xs">
                请尝试刷新或反馈问题
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {showDetails && error && (
          <CardContent className="pt-0">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-xs text-gray-500 h-7"
                >
                  <span>查看详情</span>
                  {isOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 p-2 rounded bg-gray-900 text-xs text-gray-300 overflow-auto max-h-32">
                  {error.message}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        )}

        <CardFooter className="pt-0 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={onRetry || (() => window.location.reload())}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={handleReportError}
          >
            <Bug className="h-4 w-4 mr-2" />
            报错
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * AI 助手专用降级 UI
 */
export function AIFallbackUI({
  error,
  showDetails = process.env.NODE_ENV === "development",
  onRetry,
}: FallbackUIProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 mb-4">
        <AlertTriangle className="h-6 w-6 text-purple-600" />
      </div>
      <h3 className="text-base font-medium text-gray-900 mb-1">
        AI 助手暂时不可用
      </h3>
      <p className="text-sm text-gray-500 mb-4">遇到了技术问题，请稍后重试</p>

      {showDetails && error && (
        <pre className="mb-4 p-2 rounded bg-gray-100 text-xs text-gray-600 max-w-full overflow-auto">
          {error.message}
        </pre>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onRetry || (() => window.location.reload())}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        重试
      </Button>
    </div>
  );
}
