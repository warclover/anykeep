/**
 * 结构化输出组件模块 (Story 3.2)
 * @module knowledge-studio/structured-output
 *
 * 提供结构化输出的可视化渲染组件。
 */

// ============================================================
// Main Renderer
// ============================================================

export { StructuredOutputRenderer } from "./structured-output-renderer";

// ============================================================
// Individual Renderers
// ============================================================

export { MarkdownRenderer } from "./markdown-renderer";
export { FeatureMatrixRenderer } from "./feature-matrix-renderer";
export { SwotRenderer } from "./swot-renderer";
export { ScriptTimelineRenderer } from "./script-timeline-renderer";
export { SectionsRenderer } from "./sections-renderer";
export { ChecklistRenderer } from "./checklist-renderer";

// ============================================================
// Types
// ============================================================

export type {
  // Renderer Props
  BaseRendererProps,
  StructuredOutputRendererProps,
  FeatureMatrixRendererProps,
  SwotRendererProps,
  ScriptTimelineRendererProps,
  SectionsRendererProps,
  ChecklistRendererProps,
  MarkdownRendererProps,
  // Registry Types
  RendererComponent,
  RendererRegistry,
  // Re-exported Types
  StructuredOutputType,
  FeatureMatrixOutput,
  SwotOutput,
  ScriptTimelineOutput,
  SectionsOutput,
  ChecklistOutput,
  MarkdownOutput,
  AnyStructuredOutput,
} from "./types";
