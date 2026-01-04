/**
 * 结构化输出渲染器 (Story 3.2)
 * @module knowledge-studio/structured-output
 *
 * 统一渲染入口，根据 outputType 路由到对应渲染器。
 */

"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  inferOutputType,
  validateOutput,
} from "@/lib/knowledge-studio/blueprint/structured-output";
import { MarkdownRenderer } from "./markdown-renderer";
import { FeatureMatrixRenderer } from "./feature-matrix-renderer";
import { SwotRenderer } from "./swot-renderer";
import { ScriptTimelineRenderer } from "./script-timeline-renderer";
import { SectionsRenderer } from "./sections-renderer";
import { ChecklistRenderer } from "./checklist-renderer";
import type {
  StructuredOutputRendererProps,
  StructuredOutputType,
  RendererRegistry,
  AnyStructuredOutput,
  MarkdownOutput,
} from "./types";

// ============================================================
// Renderer Registry
// ============================================================

/**
 * 渲染器注册表
 * 将输出类型映射到对应的渲染器组件
 */
const rendererRegistry: RendererRegistry = {
  feature_matrix: FeatureMatrixRenderer as RendererRegistry["feature_matrix"],
  swot: SwotRenderer as RendererRegistry["swot"],
  script_timeline:
    ScriptTimelineRenderer as RendererRegistry["script_timeline"],
  sections: SectionsRenderer as RendererRegistry["sections"],
  checklist: ChecklistRenderer as RendererRegistry["checklist"],
  markdown: MarkdownRenderer as RendererRegistry["markdown"],
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 获取渲染器组件
 */
function getRenderer(outputType: StructuredOutputType): React.ComponentType<{
  data: AnyStructuredOutput;
  className?: string;
  readOnly?: boolean;
  maxHeight?: string;
}> | null {
  return rendererRegistry[outputType] ?? null;
}

/**
 * 创建 Markdown 降级输出
 */
function createMarkdownFallback(
  data: AnyStructuredOutput,
  reason: string,
): MarkdownOutput {
  // 尝试将数据转换为可读的 Markdown
  let content: string;

  if ("content" in data && typeof data.content === "string") {
    content = data.content;
  } else {
    // 格式化 JSON 数据
    content = "```json\n" + JSON.stringify(data, null, 2) + "\n```";
  }

  return {
    meta: {
      ...data.meta,
      type: "markdown",
      isFallback: true,
    },
    content,
    fallbackReason: reason,
  };
}

// ============================================================
// Component
// ============================================================

/**
 * 结构化输出渲染器
 *
 * 根据输出类型自动选择对应渲染器：
 * - feature_matrix → FeatureMatrixRenderer
 * - swot → SwotRenderer
 * - script_timeline → ScriptTimelineRenderer
 * - sections → SectionsRenderer
 * - checklist → ChecklistRenderer
 * - markdown → MarkdownRenderer（默认/降级）
 *
 * 如果没有对应渲染器或验证失败，降级到 Markdown 渲染。
 */
export const StructuredOutputRenderer = memo(function StructuredOutputRenderer({
  data,
  outputType: explicitType,
  className,
  readOnly,
  maxHeight,
}: StructuredOutputRendererProps) {
  // 推断输出类型
  const inferredType = useMemo(() => {
    if (explicitType) return explicitType;
    return inferOutputType(data) ?? "markdown";
  }, [data, explicitType]);

  // 验证并选择渲染器
  const renderResult = useMemo(() => {
    // 验证数据
    const validation = validateOutput(data, inferredType);

    if (!validation.valid) {
      // 验证失败，降级到 Markdown
      const errorMessages = validation.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");

      return {
        type: "markdown" as const,
        data: createMarkdownFallback(
          data,
          errorMessages,
        ) as AnyStructuredOutput,
        Renderer: MarkdownRenderer,
      };
    }

    // 获取对应渲染器
    const Renderer = getRenderer(inferredType);

    if (!Renderer) {
      // 没有对应渲染器，降级到 Markdown
      return {
        type: "markdown" as const,
        data: createMarkdownFallback(
          data,
          `未实现 ${inferredType} 渲染器`,
        ) as AnyStructuredOutput,
        Renderer: MarkdownRenderer,
      };
    }

    return {
      type: inferredType,
      data: (validation.data ?? data) as AnyStructuredOutput,
      Renderer,
    };
  }, [data, inferredType]);

  // 渲染 - 错误在 useMemo 中已处理，此处直接渲染
  const { Renderer, data: renderData } = renderResult;

  // 使用类型断言确保组件接受正确的 props
  const RendererComponent = Renderer as React.ComponentType<{
    data: AnyStructuredOutput;
    className?: string;
    readOnly?: boolean;
    maxHeight?: string;
  }>;

  return (
    <div className={cn("structured-output-renderer", className)}>
      <RendererComponent
        data={renderData}
        className=""
        readOnly={readOnly}
        maxHeight={maxHeight}
      />
    </div>
  );
});

StructuredOutputRenderer.displayName = "StructuredOutputRenderer";
