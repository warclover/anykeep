/**
 * 主布局错误边界
 *
 * 包装 FeatureErrorBoundary 用于主内容区域
 * 实现局部错误隔离，避免整页崩溃
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { FeatureErrorBoundary } from "@/components/error-boundary";

interface MainLayoutErrorBoundaryProps {
  children: React.ReactNode;
}

export function MainLayoutErrorBoundary({
  children,
}: MainLayoutErrorBoundaryProps) {
  return <FeatureErrorBoundary feature="main">{children}</FeatureErrorBoundary>;
}
