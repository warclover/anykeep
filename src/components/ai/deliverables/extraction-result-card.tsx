/**
 * ExtractionResultCard - 知识萃取结果卡片组件
 *
 * 用于显示 KnowledgeExtractSkill 生成的萃取内容，
 * 支持 Perplexity 风格的来源标注和多种格式展示。
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  BookOpen,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Tag,
  FileText,
  List,
  Star,
  Calendar,
  Clock,
  Download,
  Link2,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  KnowledgeExtraction,
  KeyPoint,
  ConceptDefinition,
  SourceInfo,
  ExtractionFormat,
} from "@/lib/ai-skills/skills/knowledge-extract";

// ============================================
// 类型定义
// ============================================

interface ExtractionResultCardProps {
  /** 萃取数据 */
  data: KnowledgeExtraction;
  /** 格式化后的内容（可选） */
  formattedContent?: string;
  /** 输出格式 */
  format?: ExtractionFormat;
  /** 打开来源链接回调 */
  onOpenSource?: (sourceId: number, url: string) => void;
  /** 复制内容回调 */
  onCopyContent?: (content: string) => void;
  /** 下载回调 */
  onDownload?: (content: string, filename: string) => void;
  /** 自定义类名 */
  className?: string;
}

interface KeyPointCardProps {
  /** 要点数据 */
  keyPoint: KeyPoint;
  /** 来源列表 */
  sources: SourceInfo[];
  /** 索引 */
  index: number;
  /** 打开来源链接回调 */
  onOpenSource?: (sourceId: number, url: string) => void;
}

// ============================================
// 常量配置
// ============================================

const FORMAT_LABELS: Record<ExtractionFormat, { name: string; icon: string }> =
  {
    summary: { name: "快速摘要", icon: "📝" },
    memo: { name: "学习纪要", icon: "📋" },
    outline: { name: "大纲结构", icon: "🗂️" },
  };

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * 格式化处理时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================
// 子组件
// ============================================

/**
 * 萃取统计卡片
 */
const ExtractionStats = memo(function ExtractionStats({
  keyPointCount,
  conceptCount,
  sourceCount,
  processingTimeMs,
}: {
  keyPointCount: number;
  conceptCount: number;
  sourceCount: number;
  processingTimeMs: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {keyPointCount}
        </div>
        <div className="text-xs text-gray-500">核心要点</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-500">{conceptCount}</div>
        <div className="text-xs text-gray-500">概念定义</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-500">{sourceCount}</div>
        <div className="text-xs text-gray-500">来源文档</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-medium text-gray-600">
          {formatDuration(processingTimeMs)}
        </div>
        <div className="text-xs text-gray-500">处理耗时</div>
      </div>
    </div>
  );
});

/**
 * 来源引用标签
 */
const CitationTag = memo(function CitationTag({
  citationId,
  sourceTitle,
  onClick,
}: {
  citationId: number;
  sourceTitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
      onClick={onClick}
      title={sourceTitle}
    >
      <span>[{citationId}]</span>
    </button>
  );
});

/**
 * 单个要点卡片
 */
const KeyPointCard = memo(function KeyPointCard({
  keyPoint,
  sources,
  index,
  onOpenSource,
}: KeyPointCardProps) {
  const isHighImportance = keyPoint.importance === "high";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all hover:shadow-md",
        isHighImportance
          ? "border-amber-200 bg-amber-50/50"
          : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        {/* 序号标识 */}
        <div
          className={cn(
            "flex-shrink-0 size-7 rounded-lg flex items-center justify-center font-medium text-sm",
            isHighImportance
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-600",
          )}
        >
          {isHighImportance && (
            <Star className="size-3.5 fill-amber-500 text-amber-500" />
          )}
          {!isHighImportance && index + 1}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 leading-relaxed">
            {keyPoint.content}
          </p>

          {/* 引用标注 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {keyPoint.synthesized && (
              <Badge
                variant="outline"
                className="text-[10px] text-purple-600 border-purple-200"
              >
                综合推断
              </Badge>
            )}
            {keyPoint.citations.map((citation) => {
              const source = sources.find((s) => s.index === citation.id);
              return (
                <CitationTag
                  key={citation.id}
                  citationId={citation.id}
                  sourceTitle={citation.sourceTitle}
                  onClick={() =>
                    source && onOpenSource?.(source.id, source.url)
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * 概念定义表格
 */
const ConceptsTable = memo(function ConceptsTable({
  concepts,
  sources,
  onOpenSource,
}: {
  concepts: ConceptDefinition[];
  sources: SourceInfo[];
  onOpenSource?: (sourceId: number, url: string) => void;
}) {
  if (concepts.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-700 w-1/4">
              概念
            </th>
            <th className="text-left py-2 px-3 font-medium text-gray-700">
              定义
            </th>
            <th className="text-left py-2 px-3 font-medium text-gray-700 w-20">
              来源
            </th>
          </tr>
        </thead>
        <tbody>
          {concepts.map((concept, index) => (
            <tr
              key={concept.term}
              className={cn(
                "border-b border-gray-100",
                index % 2 === 0 ? "bg-gray-50/50" : "bg-white",
              )}
            >
              <td className="py-2 px-3">
                <span className="font-medium text-indigo-600">
                  {concept.term}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-600">{concept.definition}</td>
              <td className="py-2 px-3">
                <div className="flex flex-wrap gap-1">
                  {concept.sourceIds.map((sourceId) => {
                    const source = sources.find((s) => s.id === sourceId);
                    const sourceIndex = sources.findIndex(
                      (s) => s.id === sourceId,
                    );
                    return (
                      <CitationTag
                        key={sourceId}
                        citationId={sourceIndex + 1}
                        sourceTitle={source?.title || `来源 ${sourceId}`}
                        onClick={() =>
                          source && onOpenSource?.(source.id, source.url)
                        }
                      />
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * 来源列表
 */
const SourcesList = memo(function SourcesList({
  sources,
  onOpenSource,
  defaultExpanded = false,
}: {
  sources: SourceInfo[];
  onOpenSource?: (sourceId: number, url: string) => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-gray-500" />
          <span className="font-medium text-gray-700">
            来源文档 ({sources.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="size-4 text-gray-400" />
        ) : (
          <ChevronDown className="size-4 text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-shrink-0 size-6 rounded bg-indigo-100 text-indigo-600 text-xs font-medium flex items-center justify-center">
                {source.index}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 text-sm truncate">
                    {source.title}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] flex-shrink-0"
                  >
                    {source.platform}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <Calendar className="size-3" />
                  <span>{formatDate(source.savedAt)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onOpenSource?.(source.id, source.url)}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * 行动建议列表
 */
const ActionItemsList = memo(function ActionItemsList({
  items,
}: {
  items: string[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-start gap-2 p-2 rounded-lg bg-green-50 border border-green-100"
        >
          <div className="flex-shrink-0 size-5 rounded bg-green-100 text-green-600 text-xs font-medium flex items-center justify-center mt-0.5">
            {index + 1}
          </div>
          <p className="text-sm text-gray-700">{item}</p>
        </div>
      ))}
    </div>
  );
});

/**
 * 格式化内容预览
 */
const FormattedContentPreview = memo(function FormattedContentPreview({
  content,
  onCopy,
  onDownload,
}: {
  content: string;
  onCopy?: (content: string) => void;
  onDownload?: (content: string, filename: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    onCopy?.(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    onDownload?.(content, `knowledge-extraction-${Date.now()}.md`);
  };

  const previewContent = useMemo(() => {
    if (content.length <= 500 || isExpanded) return content;
    return content.slice(0, 500) + "...";
  }, [content, isExpanded]);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">格式化输出</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleDownload}
          >
            <Download className="size-3.5" />
          </Button>
          {content.length > 500 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="p-4 max-h-80 overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-gray-600 font-sans leading-relaxed">
          {previewContent}
        </pre>
      </div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 知识萃取结果卡片组件
 */
export const ExtractionResultCard = memo(function ExtractionResultCard({
  data,
  formattedContent,
  format = "memo",
  onOpenSource,
  onCopyContent,
  onDownload,
  className,
}: ExtractionResultCardProps) {
  const formatConfig = FORMAT_LABELS[format];

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-100 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5" />
            <h2 className="font-semibold">知识萃取</h2>
          </div>
          <Badge className="bg-white/20 text-white border-0 text-xs">
            {formatConfig.icon} {formatConfig.name}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-indigo-100">{data.title}</p>
        <div className="mt-2 flex items-center gap-2">
          <Tag className="size-3.5" />
          <span className="text-sm">主题: {data.topic}</span>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="p-4 border-b border-gray-100">
        <ExtractionStats
          keyPointCount={data.keyPoints.length}
          conceptCount={data.concepts.length}
          sourceCount={data.sources.length}
          processingTimeMs={data.metadata.processingTimeMs}
        />
      </div>

      {/* 综合结论 */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <Quote className="size-4 text-indigo-500" />
          <h3 className="font-medium text-gray-700">综合结论</h3>
        </div>
        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-sm text-gray-700 leading-relaxed">
            {data.conclusion}
          </p>
        </div>
      </div>

      {/* 核心要点 */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <List className="size-4 text-indigo-500" />
          <h3 className="font-medium text-gray-700">
            核心要点 ({data.keyPoints.length})
          </h3>
        </div>
        <div className="space-y-2">
          {data.keyPoints.map((keyPoint, index) => (
            <KeyPointCard
              key={keyPoint.id}
              keyPoint={keyPoint}
              sources={data.sources}
              index={index}
              onOpenSource={onOpenSource}
            />
          ))}
        </div>
      </div>

      {/* 核心概念 */}
      {data.concepts.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-amber-500" />
            <h3 className="font-medium text-gray-700">
              核心概念 ({data.concepts.length})
            </h3>
          </div>
          <ConceptsTable
            concepts={data.concepts}
            sources={data.sources}
            onOpenSource={onOpenSource}
          />
        </div>
      )}

      {/* 行动建议 */}
      {data.actionItems && data.actionItems.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Star className="size-4 text-green-500" />
            <h3 className="font-medium text-gray-700">
              行动建议 ({data.actionItems.length})
            </h3>
          </div>
          <ActionItemsList items={data.actionItems} />
        </div>
      )}

      {/* 格式化输出预览 */}
      {formattedContent && (
        <div className="p-4 border-b border-gray-100">
          <FormattedContentPreview
            content={formattedContent}
            onCopy={onCopyContent}
            onDownload={onDownload}
          />
        </div>
      )}

      {/* 来源列表 */}
      <div className="p-4 border-b border-gray-100">
        <SourcesList
          sources={data.sources}
          onOpenSource={onOpenSource}
          defaultExpanded={false}
        />
      </div>

      {/* 页脚 */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          生成于 {formatDate(data.metadata.extractedAt)}
        </span>
        <span>模型: {data.metadata.llmModel}</span>
      </div>
    </div>
  );
});

export default ExtractionResultCard;
