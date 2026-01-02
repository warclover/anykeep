/**
 * 搜索元数据展示面板
 *
 * 展示增强搜索的元数据信息：
 * - 查询改写（同义词扩展）
 * - 切片搜索状态（Parent-Child 精准匹配）
 * - RRF 融合指标
 * - 执行时间
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { useState } from "react";
import {
  Sparkles,
  FileText,
  Zap,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * 查询改写信息
 */
export interface QueryRewriteInfo {
  enabled: boolean;
  original: string;
  rewritten: string;
  synonyms: string[];
  latencyMs?: number;
}

/**
 * 切片搜索信息
 */
export interface ChunkSearchInfo {
  enabled: boolean;
  chunkCount: number;
  bookmarkCount: number;
  latencyMs?: number;
}

/**
 * RRF 融合信息
 */
export interface RRFFusionInfo {
  enabled: boolean;
  sources: string[];
  bookmarkWeight?: number;
  chunkWeight?: number;
}

interface SearchMetadataPanelProps {
  queryRewrite?: QueryRewriteInfo;
  chunkSearch?: ChunkSearchInfo;
  rrfFusion?: RRFFusionInfo;
  executionTimeMs?: number;
  className?: string;
}

export function SearchMetadataPanel({
  queryRewrite,
  chunkSearch,
  rrfFusion,
  executionTimeMs,
  className,
}: SearchMetadataPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // 计算有哪些元数据需要展示
  const hasQueryRewrite =
    queryRewrite?.enabled &&
    queryRewrite.synonyms &&
    queryRewrite.synonyms.length > 0;
  const hasChunkSearch = chunkSearch?.enabled && chunkSearch.chunkCount > 0;
  const hasRRFFusion = rrfFusion?.enabled && rrfFusion.sources?.length > 1;
  const hasExecutionTime = typeof executionTimeMs === "number";

  // 如果没有任何元数据，不渲染
  if (
    !hasQueryRewrite &&
    !hasChunkSearch &&
    !hasRRFFusion &&
    !hasExecutionTime
  ) {
    return null;
  }

  // 生成简短的摘要指标
  const summaryItems: { icon: typeof Sparkles; text: string; color: string }[] =
    [];

  if (hasQueryRewrite && queryRewrite?.synonyms) {
    summaryItems.push({
      icon: Sparkles,
      text: `扩展 ${queryRewrite.synonyms.length} 个同义词`,
      color: "text-purple-500",
    });
  }

  if (hasChunkSearch && chunkSearch) {
    summaryItems.push({
      icon: FileText,
      text: `${chunkSearch.chunkCount} 个段落命中`,
      color: "text-blue-500",
    });
  }

  if (hasRRFFusion) {
    summaryItems.push({
      icon: Layers,
      text: "融合搜索",
      color: "text-cyan-500",
    });
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "rounded-lg border bg-gradient-to-r from-slate-50/80 to-blue-50/50 dark:from-slate-900/30 dark:to-blue-900/20",
          "border-slate-200 dark:border-slate-700/50",
          "p-3",
          className,
        )}
      >
        {/* 标题行 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap">
            {/* 搜索增强标签 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Zap className="size-4 text-amber-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                增强搜索
              </span>
            </div>

            {/* 简要指标 */}
            <div className="flex items-center gap-2 flex-wrap">
              {summaryItems
                .slice(0, expanded ? undefined : 2)
                .map((item, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="gap-1 text-xs font-normal bg-white/60 dark:bg-slate-800/60 border-0"
                      >
                        <item.icon className={cn("size-3", item.color)} />
                        <span className="text-slate-600 dark:text-slate-300">
                          {item.text}
                        </span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.text}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              {!expanded && summaryItems.length > 2 && (
                <span className="text-xs text-slate-500">
                  +{summaryItems.length - 2}
                </span>
              )}
            </div>

            {/* 执行时间 */}
            {hasExecutionTime && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    <Clock className="size-3" />
                    {executionTimeMs}ms
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>搜索执行耗时 {executionTimeMs}ms</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 展开/收起按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 h-7 px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </div>

        {/* 展开后的详细信息 */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 space-y-3">
            {/* 查询改写详情 */}
            {hasQueryRewrite && queryRewrite && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-3.5" />
                  <span>查询改写</span>
                </div>
                <div className="pl-5 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400">原始：</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      「{queryRewrite.original}」
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-slate-400">扩展：</span>
                    {queryRewrite.synonyms.map((syn, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs py-0 h-5 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300"
                      >
                        {syn}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 切片搜索详情 */}
            {hasChunkSearch && chunkSearch && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                  <FileText className="size-3.5" />
                  <span>精准段落匹配</span>
                </div>
                <div className="pl-5 text-xs text-slate-500 dark:text-slate-400">
                  在{" "}
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {chunkSearch.bookmarkCount}
                  </span>{" "}
                  篇长文档的{" "}
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {chunkSearch.chunkCount}
                  </span>{" "}
                  个段落中找到精准匹配
                </div>
              </div>
            )}

            {/* RRF 融合详情 */}
            {hasRRFFusion && rrfFusion && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400">
                  <Layers className="size-3.5" />
                  <span>RRF 融合排序</span>
                </div>
                <div className="pl-5 text-xs text-slate-500 dark:text-slate-400">
                  融合来源：
                  {rrfFusion.sources.map((source, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="ml-1 text-xs py-0 h-5 bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700 text-cyan-600 dark:text-cyan-300"
                    >
                      {source === "bookmark"
                        ? "书签"
                        : source === "chunk"
                          ? "段落"
                          : source}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
