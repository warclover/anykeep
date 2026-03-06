/**
 * Structured Output Viewer - 类型定义
 */

export type OutputType =
  | "feature_matrix"
  | "swot"
  | "script_timeline"
  | "sections"
  | "checklist"
  | "markdown"
  | "json"
  | "unknown";

export interface StructuredOutputViewerProps {
  /** 输出类型 */
  type: OutputType;
  /** 输出数据 */
  data: unknown;
  /** 标题 */
  title?: string;
  /** 最大高度 */
  maxHeight?: string;
  /** 类名 */
  className?: string;
}

export interface FeatureMatrixData {
  title?: string;
  headers: string[];
  rows: Array<{
    feature: string;
    values: Array<string | boolean | number>;
  }>;
}

export interface SwotData {
  title?: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface ScriptTimelineData {
  title?: string;
  scenes: Array<{
    id: string;
    timestamp: string;
    duration?: string;
    title: string;
    description: string;
    visualNotes?: string;
    audioNotes?: string;
  }>;
}

export interface SectionsData {
  title?: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    subsections?: Array<{
      id: string;
      title: string;
      content: string;
    }>;
  }>;
}

export interface ChecklistData {
  title?: string;
  items: Array<{
    id: string;
    text: string;
    checked?: boolean;
    priority?: "high" | "medium" | "low";
    category?: string;
  }>;
}
