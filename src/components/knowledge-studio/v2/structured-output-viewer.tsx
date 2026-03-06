/**
 * Structured Output Viewer v2 - 结构化输出查看器
 * @module knowledge-studio/v2
 *
 * 功能:
 * - 根据输出类型渲染：
 *   - feature_matrix: 表格组件
 *   - swot: 四象限布局
 *   - script_timeline: 时间线组件
 *   - sections: 折叠面板
 *   - checklist: 任务列表
 *   - markdown: Markdown 渲染
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// 类型、工具函数、渲染器 - 从拆分文件导入
export type { OutputType, StructuredOutputViewerProps } from "./viewer-types";
import type { StructuredOutputViewerProps } from "./viewer-types";
import {
  isFeatureMatrixData,
  isSwotData,
  isScriptTimelineData,
  isSectionsData,
  isChecklistData,
  TYPE_ICONS,
  TYPE_LABELS,
  dataToText,
} from "./viewer-utils";
import {
  CopyButton,
  FeatureMatrixRenderer,
  SwotRenderer,
  ScriptTimelineRenderer,
  SectionsRenderer,
  ChecklistRenderer,
  MarkdownRenderer,
  JsonRenderer,
} from "./viewer-renderers";

// ============================================================
// Main Component
// ============================================================

export function StructuredOutputViewer({
  type,
  data,
  title,
  maxHeight = "600px",
  className,
}: StructuredOutputViewerProps) {
  /** 获取可复制的完整文本 */
  const fullText = useMemo(() => dataToText(type, data), [type, data]);

  const renderContent = () => {
    switch (type) {
      case "feature_matrix":
        if (!isFeatureMatrixData(data)) {
          return <JsonRenderer data={data} />;
        }
        return <FeatureMatrixRenderer data={data} />;
      case "swot":
        if (!isSwotData(data)) {
          return <JsonRenderer data={data} />;
        }
        return <SwotRenderer data={data} />;
      case "script_timeline":
        if (!isScriptTimelineData(data)) {
          return <JsonRenderer data={data} />;
        }
        return <ScriptTimelineRenderer data={data} />;
      case "sections":
        if (!isSectionsData(data)) {
          return <JsonRenderer data={data} />;
        }
        return <SectionsRenderer data={data} />;
      case "checklist":
        if (!isChecklistData(data)) {
          return <JsonRenderer data={data} />;
        }
        return <ChecklistRenderer data={data} />;
      case "markdown":
        if (typeof data !== "string") {
          return <JsonRenderer data={data} />;
        }
        return <MarkdownRenderer content={data} />;
      case "json":
        return <JsonRenderer data={data} />;
      default:
        // Try to render as JSON if unknown
        return <JsonRenderer data={data} />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {TYPE_ICONS[type]}
          <CardTitle className="text-lg">
            {title || TYPE_LABELS[type]}
          </CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {TYPE_LABELS[type]}
          </Badge>
          {/* Phase 2: 复制全部按钮 */}
          <CopyButton text={fullText} label="复制全部" variant="button" />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ maxHeight }}>{renderContent()}</ScrollArea>
      </CardContent>
    </Card>
  );
}

export default StructuredOutputViewer;
