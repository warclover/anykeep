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
  ExternalLink,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DeliverableData, DeliverableType } from "./types";
import { clientLogger } from "@/lib/client-logger";
import { SearchResultsList } from "./search-results-list";
import type {
  FormattedSearchResponse,
  ParsedQuery,
  SearchResultItem,
} from "@/lib/ai-skills/search/types";

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

  const handleCopy = async () => {
    try {
      const textContent =
        typeof deliverable.content === "string"
          ? deliverable.content
          : JSON.stringify(deliverable.content, null, 2);
      await navigator.clipboard.writeText(textContent);
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
 * 交付物内容渲染
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
    case "document":
      return <DocumentContent content={content} metadata={metadata} />;
    case "graph":
      return <GraphContent content={content} metadata={metadata} />;
    case "mindmap":
      return <MindmapContent content={content} />;
    case "search_results":
      return <SearchResultsContent content={content} metadata={metadata} />;
    default:
      return <DefaultContent content={content} />;
  }
});

/**
 * 列表类型内容
 */
const ListContent = memo(function ListContent({
  content,
}: {
  content: unknown;
}) {
  if (!Array.isArray(content)) {
    return <DefaultContent content={content} />;
  }

  return (
    <ul className="space-y-2">
      {content.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="flex-shrink-0 size-5 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-medium">
            {index + 1}
          </span>
          <span className="text-sm text-gray-700">
            {typeof item === "string" ? item : JSON.stringify(item)}
          </span>
        </li>
      ))}
    </ul>
  );
});

/**
 * 卡片类型内容
 */
const CardsContent = memo(function CardsContent({
  content,
}: {
  content: unknown;
}) {
  if (!Array.isArray(content)) {
    return <DefaultContent content={content} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {content.map((card, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          {typeof card === "object" && card !== null ? (
            <>
              {(card as Record<string, unknown>).title && (
                <h5 className="font-medium text-gray-800 mb-1">
                  {String((card as Record<string, unknown>).title)}
                </h5>
              )}
              {(card as Record<string, unknown>).description && (
                <p className="text-sm text-gray-600">
                  {String((card as Record<string, unknown>).description)}
                </p>
              )}
              {(card as Record<string, unknown>).url && (
                <a
                  href={String((card as Record<string, unknown>).url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-purple-600 hover:text-purple-700"
                >
                  <ExternalLink className="size-3" />
                  <span>查看</span>
                </a>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-700">{String(card)}</span>
          )}
        </div>
      ))}
    </div>
  );
});

/**
 * 表格类型内容
 */
const TableContent = memo(function TableContent({
  content,
}: {
  content: unknown;
}) {
  if (!Array.isArray(content) || content.length === 0) {
    return <DefaultContent content={content} />;
  }

  const firstRow = content[0];
  if (typeof firstRow !== "object" || firstRow === null) {
    return <DefaultContent content={content} />;
  }

  const headers = Object.keys(firstRow as Record<string, unknown>);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-purple-100">
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-left font-medium text-gray-700 bg-purple-50/50"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-100 hover:bg-purple-50/30"
            >
              {headers.map((header) => (
                <td key={header} className="px-3 py-2 text-gray-600">
                  {String((row as Record<string, unknown>)[header] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * 文档/报告类型内容
 */
const DocumentContent = memo(function DocumentContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  const textContent =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <div className="space-y-3">
      {/* 元数据摘要 */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
          {Object.entries(metadata).map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
            >
              <span className="font-medium">{key}:</span>
              <span className="ml-1">{String(value)}</span>
            </span>
          ))}
        </div>
      )}

      {/* 文档内容 */}
      <div className="prose prose-sm prose-purple max-w-none">
        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
          {textContent}
        </div>
      </div>
    </div>
  );
});

/**
 * 图表类型内容（简化展示）
 */
const GraphContent = memo(function GraphContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 简化实现：显示数据摘要
  // 实际可集成 recharts 等图表库
  if (!Array.isArray(content)) {
    return <DefaultContent content={content} />;
  }

  return (
    <div className="space-y-3">
      {metadata?.chartType !== undefined && (
        <div className="text-xs text-gray-500">
          图表类型: {String(metadata.chartType)}
        </div>
      )}

      {/* 简化的数据条形图 */}
      <div className="space-y-2">
        {content.slice(0, 10).map((item, index) => {
          const dataItem = item as Record<string, unknown>;
          const label = String(
            dataItem.label || dataItem.name || `项目 ${index + 1}`,
          );
          const value = Number(dataItem.value || dataItem.count || 0);
          const maxValue = Math.max(
            ...content.map((i) =>
              Number(
                (i as Record<string, unknown>).value ||
                  (i as Record<string, unknown>).count ||
                  0,
              ),
            ),
          );
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div key={index} className="flex items-center gap-3">
              <span className="w-24 text-xs text-gray-600 truncate">
                {label}
              </span>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-xs text-gray-500 text-right">
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {content.length > 10 && (
        <p className="text-xs text-gray-400">
          还有 {content.length - 10} 项数据...
        </p>
      )}
    </div>
  );
});

/**
 * 思维导图内容（简化展示）
 */
const MindmapContent = memo(function MindmapContent({
  content,
}: {
  content: unknown;
}) {
  // 简化实现：树形结构展示
  // 实际可集成 mind-map 组件库

  interface MindmapNode {
    label: string;
    children?: MindmapNode[];
  }

  const renderNode = (
    node: MindmapNode,
    depth: number = 0,
  ): React.ReactNode => {
    return (
      <div key={node.label} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 py-1">
          <span
            className={cn(
              "size-2 rounded-full",
              depth === 0
                ? "bg-purple-500"
                : depth === 1
                  ? "bg-indigo-400"
                  : "bg-gray-400",
            )}
          />
          <span
            className={cn(
              "text-sm",
              depth === 0 ? "font-medium text-gray-800" : "text-gray-600",
            )}
          >
            {node.label}
          </span>
        </div>
        {node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (typeof content === "object" && content !== null && "label" in content) {
    return <div className="py-2">{renderNode(content as MindmapNode)}</div>;
  }

  return <DefaultContent content={content} />;
});

/**
 * 搜索结果内容
 *
 * 使用 SearchResultsList 渲染格式化搜索响应
 */
const SearchResultsContent = memo(function SearchResultsContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 验证 content 是否为有效的搜索响应
  if (
    typeof content !== "object" ||
    content === null ||
    !("results" in content) ||
    !("meta" in content)
  ) {
    return <DefaultContent content={content} />;
  }

  const searchResponse = content as FormattedSearchResponse;

  // 从 metadata 中提取 parsedQuery（如果有）
  const parsedQuery = metadata?.parsedQuery as ParsedQuery | undefined;

  // 处理结果点击
  const handleResultClick = (result: SearchResultItem) => {
    // 打开书签链接
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  // 处理建议点击
  const handleSuggestionClick = (suggestion: string) => {
    // TODO: 触发新的搜索
    clientLogger.info({ suggestion }, "Search suggestion clicked");
  };

  return (
    <SearchResultsList
      response={searchResponse}
      parsedQuery={parsedQuery}
      onResultClick={handleResultClick}
      onSuggestionClick={handleSuggestionClick}
      showQueryFeedback={!!parsedQuery}
      initialShowCount={5}
    />
  );
});

/**
 * 默认内容渲染
 */
const DefaultContent = memo(function DefaultContent({
  content,
}: {
  content: unknown;
}) {
  const textContent =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
      {textContent}
    </div>
  );
});
