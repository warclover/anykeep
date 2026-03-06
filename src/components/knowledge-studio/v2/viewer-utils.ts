/**
 * Structured Output Viewer - 类型守卫、常量、工具函数
 */

import { Clock, FileText, List, Table2, Grid3X3 } from "lucide-react";
import { createElement } from "react";
import type {
  OutputType,
  FeatureMatrixData,
  SwotData,
  ScriptTimelineData,
  SectionsData,
  ChecklistData,
} from "./viewer-types";

// ============================================================
// Type Guards
// ============================================================

export function isFeatureMatrixData(data: unknown): data is FeatureMatrixData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.headers) &&
    Array.isArray(obj.rows) &&
    obj.rows.every(
      (row: unknown) =>
        typeof row === "object" &&
        row !== null &&
        "feature" in row &&
        "values" in row,
    )
  );
}

export function isSwotData(data: unknown): data is SwotData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.strengths) &&
    Array.isArray(obj.weaknesses) &&
    Array.isArray(obj.opportunities) &&
    Array.isArray(obj.threats)
  );
}

export function isScriptTimelineData(
  data: unknown,
): data is ScriptTimelineData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.scenes) &&
    obj.scenes.every(
      (scene: unknown) =>
        typeof scene === "object" &&
        scene !== null &&
        "id" in scene &&
        "title" in scene,
    )
  );
}

export function isSectionsData(data: unknown): data is SectionsData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.sections) &&
    obj.sections.every(
      (section: unknown) =>
        typeof section === "object" &&
        section !== null &&
        "id" in section &&
        "title" in section &&
        "content" in section,
    )
  );
}

export function isChecklistData(data: unknown): data is ChecklistData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.items) &&
    obj.items.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "text" in item,
    )
  );
}

// ============================================================
// Constants
// ============================================================

export const TYPE_ICONS: Record<OutputType, React.ReactNode> = {
  feature_matrix: createElement(Table2, { className: "h-5 w-5" }),
  swot: createElement(Grid3X3, { className: "h-5 w-5" }),
  script_timeline: createElement(Clock, { className: "h-5 w-5" }),
  sections: createElement(FileText, { className: "h-5 w-5" }),
  checklist: createElement(List, { className: "h-5 w-5" }),
  markdown: createElement(FileText, { className: "h-5 w-5" }),
  json: createElement(FileText, { className: "h-5 w-5" }),
  unknown: createElement(FileText, { className: "h-5 w-5" }),
};

export const TYPE_LABELS: Record<OutputType, string> = {
  feature_matrix: "功能矩阵",
  swot: "SWOT 分析",
  script_timeline: "脚本时间线",
  sections: "章节内容",
  checklist: "检查清单",
  markdown: "Markdown",
  json: "JSON 数据",
  unknown: "原始输出",
};

// ============================================================
// Utility Functions
// ============================================================

/** 将数据转换为可复制的文本格式 */
export function dataToText(type: OutputType, data: unknown): string {
  switch (type) {
    case "sections":
      if (isSectionsData(data)) {
        return data.sections
          .map((section) => {
            let text = `## ${section.title}\n\n${section.content}`;
            if (section.subsections && section.subsections.length > 0) {
              text += "\n\n";
              text += section.subsections
                .map((sub) => `### ${sub.title}\n\n${sub.content}`)
                .join("\n\n");
            }
            return text;
          })
          .join("\n\n---\n\n");
      }
      break;
    case "swot":
      if (isSwotData(data)) {
        return [
          "## SWOT 分析\n",
          "### 优势 (Strengths)",
          data.strengths.map((s) => `- ${s}`).join("\n"),
          "\n### 劣势 (Weaknesses)",
          data.weaknesses.map((s) => `- ${s}`).join("\n"),
          "\n### 机会 (Opportunities)",
          data.opportunities.map((s) => `- ${s}`).join("\n"),
          "\n### 威胁 (Threats)",
          data.threats.map((s) => `- ${s}`).join("\n"),
        ].join("\n");
      }
      break;
    case "checklist":
      if (isChecklistData(data)) {
        return data.items.map((item) => `- [ ] ${item.text}`).join("\n");
      }
      break;
    case "script_timeline":
      if (isScriptTimelineData(data)) {
        return data.scenes
          .map(
            (scene, idx) =>
              `## 场景 ${idx + 1}: ${scene.title}\n\n` +
              `**时间**: ${scene.timestamp}${scene.duration ? ` (${scene.duration})` : ""}\n\n` +
              `${scene.description}` +
              (scene.visualNotes ? `\n\n**画面**: ${scene.visualNotes}` : "") +
              (scene.audioNotes ? `\n\n**音效**: ${scene.audioNotes}` : ""),
          )
          .join("\n\n---\n\n");
      }
      break;
    case "feature_matrix":
      if (isFeatureMatrixData(data)) {
        const header = `| 功能 | ${data.headers.join(" | ")} |`;
        const separator = `| --- | ${data.headers.map(() => "---").join(" | ")} |`;
        const rows = data.rows.map(
          (row) =>
            `| ${row.feature} | ${row.values.map((v) => (typeof v === "boolean" ? (v ? "✓" : "✗") : String(v))).join(" | ")} |`,
        );
        return [header, separator, ...rows].join("\n");
      }
      break;
    case "markdown":
      if (typeof data === "string") {
        return data;
      }
      break;
  }
  // Default: JSON
  return JSON.stringify(data, null, 2);
}
