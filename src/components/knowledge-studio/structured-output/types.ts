/**
 * 结构化输出渲染器类型定义 (Story 3.2)
 * @module knowledge-studio/structured-output
 */

import type {
  StructuredOutputType,
  FeatureMatrixOutput,
  SwotOutput,
  ScriptTimelineOutput,
  SectionsOutput,
  ChecklistOutput,
  MarkdownOutput,
  AnyStructuredOutput,
} from "@/lib/knowledge-studio/blueprint/structured-output";

// ============================================================
// Renderer Props Types
// ============================================================

/**
 * 通用渲染器 Props
 */
export interface BaseRendererProps {
  /** 自定义类名 */
  className?: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大高度 */
  maxHeight?: string;
}

/**
 * FeatureMatrix 渲染器 Props
 */
export interface FeatureMatrixRendererProps extends BaseRendererProps {
  data: FeatureMatrixOutput;
}

/**
 * SWOT 渲染器 Props
 */
export interface SwotRendererProps extends BaseRendererProps {
  data: SwotOutput;
}

/**
 * ScriptTimeline 渲染器 Props
 */
export interface ScriptTimelineRendererProps extends BaseRendererProps {
  data: ScriptTimelineOutput;
}

/**
 * Sections 渲染器 Props
 */
export interface SectionsRendererProps extends BaseRendererProps {
  data: SectionsOutput;
}

/**
 * Checklist 渲染器 Props
 */
export interface ChecklistRendererProps extends BaseRendererProps {
  data: ChecklistOutput;
  /** 勾选回调 */
  onToggle?: (itemId: string, checked: boolean) => void;
}

/**
 * Markdown 渲染器 Props
 */
export interface MarkdownRendererProps extends BaseRendererProps {
  data: MarkdownOutput;
}

// ============================================================
// Unified Renderer Props
// ============================================================

/**
 * 统一结构化输出渲染器 Props
 */
export interface StructuredOutputRendererProps extends BaseRendererProps {
  /** 结构化输出数据 */
  data: AnyStructuredOutput;
  /** 输出类型（可选，自动从 data.meta.type 推断） */
  outputType?: StructuredOutputType;
  /** 渲染错误回调 */
  onError?: (error: Error) => void;
}

// ============================================================
// Renderer Registry Types
// ============================================================

/**
 * 渲染器组件类型
 */
export type RendererComponent<T extends AnyStructuredOutput> =
  React.ComponentType<{
    data: T;
    className?: string;
    readOnly?: boolean;
    maxHeight?: string;
  }>;

/**
 * 渲染器注册表
 */
export type RendererRegistry = {
  [K in StructuredOutputType]?: RendererComponent<AnyStructuredOutput>;
};

// ============================================================
// Re-exports for convenience
// ============================================================

export type {
  StructuredOutputType,
  FeatureMatrixOutput,
  SwotOutput,
  ScriptTimelineOutput,
  SectionsOutput,
  ChecklistOutput,
  MarkdownOutput,
  AnyStructuredOutput,
};
