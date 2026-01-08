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
  Volume2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIMarkdown } from "./ai-markdown";
import { AIReportContent } from "./ai-report-content";
import { AIPeriodicReportContent } from "./ai-periodic-report-content";
import { AIGenericReportContent } from "./ai-generic-report-content";
import { Button } from "@/components/ui/button";
import { SaveToNoteButton } from "@/components/shared/save-to-note";
import type { DeliverableData, DeliverableType } from "./types";
import { clientLogger } from "@/lib/client-logger";
import { SearchResultsList } from "./search-results-list";
import { ExtractionResultCard } from "./deliverables/extraction-result-card";
import type {
  FormattedSearchResponse,
  ParsedQuery,
  SearchResultItem,
} from "@/lib/ai-skills/search/types";
import type {
  KnowledgeExtraction,
  ExtractionFormat,
} from "@/lib/ai-skills/skills/knowledge-extract";
import {
  KnowledgeReviewCard,
  isKnowledgeReviewOutput,
} from "./deliverables/knowledge-review-card";
import { AudioPlayerCard } from "@/components/tts";
import {
  WechatDigestView,
  isWechatDigestOutput,
} from "./deliverables/wechat-digest-view";
import {
  BilibiliTranscriptView,
  isBilibiliTranscriptOutput,
} from "./deliverables/bilibili-transcript-view";

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
  const contentString = useMemo(
    () =>
      typeof deliverable.content === "string"
        ? deliverable.content
        : JSON.stringify(deliverable.content, null, 2),
    [deliverable.content],
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
          <span className="text-sm text-gray-700 flex-1">
            {typeof item === "string" ? (
              <AIMarkdown content={item} />
            ) : (
              JSON.stringify(item)
            )}
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
                <AIMarkdown
                  content={String(
                    (card as Record<string, unknown>).description,
                  )}
                  className="text-sm text-gray-600"
                />
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
  // 检测是否为 knowledge_review skill 的交付物
  const isKnowledgeReview = metadata?.skillId === "knowledge_review";

  // Debug: 记录 content 类型和验证结果
  if (isKnowledgeReview && process.env.NODE_ENV === "development") {
    clientLogger.info(
      {
        contentType: typeof content,
        isString: typeof content === "string",
        isObject: typeof content === "object",
        isNull: content === null,
        typeGuardResult: isKnowledgeReviewOutput(content),
        contentPreview:
          typeof content === "string"
            ? content.slice(0, 100)
            : JSON.stringify(content)?.slice(0, 100),
      },
      "DocumentContent: Knowledge Review content debug",
    );
  }

  // 如果是知识复习计划，使用专门的组件渲染
  if (isKnowledgeReview && isKnowledgeReviewOutput(content)) {
    return <KnowledgeReviewCard data={content} />;
  }

  // 检测是否为 knowledge_extract skill 的交付物
  const isKnowledgeExtract = metadata?.skillId === "knowledge_extract";

  // 如果是知识萃取结果，使用专门的组件渲染
  if (isKnowledgeExtract && isKnowledgeExtractionData(content)) {
    const extractionFormat = (metadata?.format as ExtractionFormat) || "memo";
    const formattedContent = metadata?.formattedContent as string | undefined;

    const handleOpenSource = (sourceId: number, url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleCopyContent = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        clientLogger.error({ error }, "Failed to copy content");
      }
    };

    const handleDownload = (text: string, filename: string) => {
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <ExtractionResultCard
        data={content}
        format={extractionFormat}
        formattedContent={formattedContent}
        onOpenSource={handleOpenSource}
        onCopyContent={handleCopyContent}
        onDownload={handleDownload}
      />
    );
  }

  // 检测是否为 wechat_digest skill 的交付物
  const isWechatDigest = metadata?.skillId === "wechat_digest";

  // 如果是微信阅读摘要，使用专门的组件渲染
  if (isWechatDigest && isWechatDigestOutput(content)) {
    return <WechatDigestView data={content} />;
  }

  // 检测是否为 bilibili_transcript skill 的交付物
  const isBilibiliTranscript = metadata?.skillId === "bilibili_transcript";

  // 如果是B站字幕提取，使用专门的组件渲染
  if (isBilibiliTranscript && isBilibiliTranscriptOutput(content)) {
    return <BilibiliTranscriptView data={content} />;
  }

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

      {/* 文档内容 - 使用 Markdown 渲染 */}
      <div className="prose prose-sm prose-purple max-w-none">
        <AIMarkdown content={textContent} />
      </div>
    </div>
  );
});

/**
 * 类型守卫：检查内容是否为 KnowledgeExtraction 数据
 */
function isKnowledgeExtractionData(
  content: unknown,
): content is KnowledgeExtraction {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.topic === "string" &&
    Array.isArray(obj.keyPoints) &&
    Array.isArray(obj.concepts) &&
    Array.isArray(obj.sources) &&
    typeof obj.conclusion === "string" &&
    typeof obj.metadata === "object"
  );
}

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
 * 报告内容渲染 - 智能选择报告组件
 *
 * 路由优先级：
 * 1. periodic_report skill → AIPeriodicReportContent
 * 2. insight_report skill → AIReportContent
 * 3. 检测周期报告结构 (stats + highlights + insights) → AIPeriodicReportContent
 * 4. 检测洞察报告结构 (activity + content + reportType) → AIReportContent
 * 5. 其他报告类型 → AIGenericReportContent (fallback)
 */
const ReportContent = memo(function ReportContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 根据 skillId 或内容结构判断报告类型
  const skillId = metadata?.skillId as string | undefined;

  // 周期报告：periodic_report skill
  if (skillId === "periodic_report") {
    return <AIPeriodicReportContent content={content} />;
  }

  // 洞察报告：insight_report skill
  if (skillId === "insight_report") {
    return <AIReportContent content={content} />;
  }

  // 检测数据结构
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>;

    // 周期报告结构: stats + highlights + insights
    if (
      typeof obj.stats === "object" &&
      Array.isArray(obj.highlights) &&
      Array.isArray(obj.insights)
    ) {
      return <AIPeriodicReportContent content={content} />;
    }

    // 洞察报告结构: activity + content + reportType
    if (
      typeof obj.activity === "object" &&
      typeof obj.content === "object" &&
      typeof obj.reportType === "string"
    ) {
      return <AIReportContent content={content} />;
    }
  }

  // 其他所有报告类型使用通用报告渲染器
  // 包括：batch_organize, duplicate_cleanup, smart_tagging,
  // learning_path, quick_digest, reading_planner 等
  return <AIGenericReportContent content={content} />;
});

/**
 * 音频类型内容
 *
 * 用于渲染 TTS 语音朗读交付物
 */
const AudioContent = memo(function AudioContent({
  content,
  title,
}: {
  content: unknown;
  title: string;
}) {
  // 验证 content 是否为有效的音频数据
  if (
    typeof content !== "object" ||
    content === null ||
    !("audioBase64" in content) ||
    !("format" in content)
  ) {
    return <DefaultContent content={content} />;
  }

  const audioData = content as {
    audioBase64: string;
    format: string;
    durationSec: number;
    charCount?: number;
  };

  return (
    <AudioPlayerCard
      audioBase64={audioData.audioBase64}
      format={audioData.format}
      duration={audioData.durationSec}
      title={title}
      charCount={audioData.charCount}
    />
  );
});

/**
 * 默认内容渲染 - 支持 Markdown
 */
const DefaultContent = memo(function DefaultContent({
  content,
}: {
  content: unknown;
}) {
  // JSON 对象保持格式化显示
  if (typeof content !== "string") {
    return (
      <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  }

  // 纯文本使用 Markdown 渲染
  return <AIMarkdown content={content} className="text-sm" />;
});
