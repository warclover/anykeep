/**
 * Source Badge 和 Source List 组件
 *
 * 可点击的来源标签，支持跳转和悬停预览
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { SourceReference } from "@/lib/synthesis";

/**
 * 可点击的来源标签
 */
export const SourceBadge = memo(function SourceBadge({
  source,
  maxLength = 20,
}: {
  source: SourceReference;
  maxLength?: number;
}) {
  const displayTitle =
    source.title.length > maxLength
      ? `${source.title.slice(0, maxLength)}...`
      : source.title;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link href={`/bookmarks/${source.id}`} className="inline-block">
          <Badge
            variant="outline"
            className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors group"
          >
            {displayTitle}
            <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Badge>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-80 p-4"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium leading-tight">{source.title}</p>
          </div>

          {source.quote && (
            <blockquote className="border-l-2 border-primary/30 pl-3 italic text-xs text-muted-foreground">
              &ldquo;{source.quote}&rdquo;
            </blockquote>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              ID: {source.id}
            </span>
            <span className="text-xs text-primary flex items-center gap-1">
              点击查看详情
              <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

/**
 * 来源列表组件
 */
export const SourceList = memo(function SourceList({
  sources,
  maxVisible = 3,
  maxLength = 20,
}: {
  sources: SourceReference[];
  maxVisible?: number;
  maxLength?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleSources = showAll ? sources : sources.slice(0, maxVisible);
  const hiddenCount = sources.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibleSources.map((source, i) => (
        <SourceBadge
          key={source.id || i}
          source={source}
          maxLength={maxLength}
        />
      ))}
      {!showAll && hiddenCount > 0 && (
        <Badge
          variant="secondary"
          className="text-xs cursor-pointer hover:bg-secondary/80"
          onClick={() => setShowAll(true)}
        >
          +{hiddenCount}
        </Badge>
      )}
      {showAll && sources.length > maxVisible && (
        <Badge
          variant="outline"
          className="text-xs cursor-pointer hover:bg-muted"
          onClick={() => setShowAll(false)}
        >
          收起
        </Badge>
      )}
    </div>
  );
});
