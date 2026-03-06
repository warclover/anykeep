/**
 * AI 交付物卡片组件
 *
 * 用于显示编排模式生成的各类交付物
 * 支持：报告、列表、卡片、文档、思维导图、图表、表格
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  FileText,
  List,
  LayoutGrid,
  FileCode,
  Network,
  BarChart3,
  Table2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Volume2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SaveToNoteButton } from "@/components/shared/save-to-note";
import type { DeliverableData, DeliverableType } from "./types";
import { clientLogger } from "@/lib/client-logger";
import { deliverableToMarkdown } from "./deliverable-to-markdown";

// 内容渲染器 - 从 deliverables/ 目录导入
import { ListContent } from "./deliverables/list-content";
import { CardsContent } from "./deliverables/cards-content";
import { TableContent } from "./deliverables/table-content";
import { DocumentContent } from "./deliverables/document-content";
import { GraphContent } from "./deliverables/graph-content";
import { MindmapContent } from "./deliverables/mindmap-content";
import { SearchResultsContent } from "./deliverables/search-results-content";
import { ReportContent } from "./deliverables/report-content";
import { AudioContent } from "./deliverables/audio-content";
import { DefaultContent } from "./deliverables/default-content";

interface AIDeliverableCardProps {
  /** 交付物数据 */
  deliverable: DeliverableData;
  /** 自定义类名 */
  className?: string;
}

/**
 * 交付物类型图标映射
 */
const DELIVERABLE_ICON_MAP: Record<DeliverableType, LucideIcon> = {
  report: FileText,
  list: List,
  cards: LayoutGrid,
  document: FileCode,
  mindmap: Network,
  graph: BarChart3,
  table: Table2,
  search_results: Search,
  organize_plan: LayoutGrid,
  organize_result: FileText,
  audio: Volume2,
};

/**
 * 交付物类型名称映射
 */
const DELIVERABLE_TYPE_NAMES: Record<DeliverableType, string> = {
  report: "报告",
  list: "列表",
  cards: "卡片",
  document: "文档",
  mindmap: "思维导图",
  graph: "图表",
  table: "表格",
  search_results: "搜索结果",
  organize_plan: "整理方案",
  organize_result: "整理结果",
  audio: "语音朗读",
};

/**
 * 交付物图标组件
 */
const DeliverableIcon = memo(function DeliverableIcon({
  type,
  className,
}: {
  type: DeliverableType;
  className?: string;
}) {
  const IconComponent = DELIVERABLE_ICON_MAP[type] || FileText;
  return <IconComponent className={className} />;
});

/**
 * AI 交付物卡片
 */
export const AIDeliverableCard = memo(function AIDeliverableCard({
  deliverable,
  className,
}: AIDeliverableCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const typeName = useMemo(
    () => DELIVERABLE_TYPE_NAMES[deliverable.type] || "内容",
    [deliverable.type],
  );

  // 获取内容字符串（用于复制和保存）
  // 将结构化 JSON 转为可读 Markdown，而非直接 JSON.stringify
  const contentString = useMemo(
    () =>
      deliverableToMarkdown(
        deliverable.content,
        deliverable.type,
        deliverable.metadata,
      ),
    [deliverable.content, deliverable.type, deliverable.metadata],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contentString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      clientLogger.error({ error }, "Failed to copy");
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/50 shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-7 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-400 shadow-sm">
            <DeliverableIcon
              type={deliverable.type}
              className="size-4 text-white"
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800">
              {deliverable.title}
            </h4>
            <span className="text-xs text-gray-500">{typeName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* 复制按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 hover:bg-purple-100"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5 text-gray-500" />
            )}
          </Button>

          {/* 保存到笔记按钮 */}
          <div onClick={(e) => e.stopPropagation()}>
            <SaveToNoteButton
              content={contentString}
              sourceType="deliverable"
              suggestedTitle={deliverable.title}
              variant="icon"
              className="size-7 p-0 hover:bg-purple-100"
            />
          </div>

          {isExpanded ? (
            <ChevronUp className="size-4 text-gray-500" />
          ) : (
            <ChevronDown className="size-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* 内容 */}
      {isExpanded && (
        <div className="p-4">
          <DeliverableContent deliverable={deliverable} />
        </div>
      )}
    </div>
  );
});

/**
 * 交付物内容渲染 - 路由分发
 */
const DeliverableContent = memo(function DeliverableContent({
  deliverable,
}: {
  deliverable: DeliverableData;
}) {
  const { type, content, metadata } = deliverable;

  // 根据类型渲染不同内容
  switch (type) {
    case "list":
      return <ListContent content={content} />;
    case "cards":
      return <CardsContent content={content} />;
    case "table":
      return <TableContent content={content} />;
    case "report":
      return <ReportContent content={content} metadata={metadata} />;
    case "document":
      return <DocumentContent content={content} metadata={metadata} />;
    case "graph":
      return <GraphContent content={content} metadata={metadata} />;
    case "mindmap":
      return <MindmapContent content={content} />;
    case "search_results":
      return <SearchResultsContent content={content} metadata={metadata} />;
    case "audio":
      return <AudioContent content={content} title={deliverable.title} />;
    default:
      return <DefaultContent content={content} />;
  }
});
