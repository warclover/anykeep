/**
 * Overview Section 组件
 *
 * 概述区块（带折叠功能 + Markdown 结构化排版）
 *
 * @version 2.0.0
 * @since 2026-02-07
 */

"use client";

import { memo, useState, useMemo, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HighlightableText } from "../highlightable-text";
import type { HighlightHandlers } from "./types";

// ============================================================================
// 内联文本格式化（处理 **加粗** 等行内标记）
// ============================================================================

function formatInlineText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="font-semibold">
        {match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// ============================================================================
// FormattedOverview - 轻量 Markdown 结构化渲染
// ============================================================================

function FormattedOverview({
  content,
  handlers,
}: {
  content: string;
  handlers: HighlightHandlers;
}) {
  const blocks = useMemo(() => {
    // 按双换行分段
    return content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  }, [content]);

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        // # 一级标题
        if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
          return (
            <h2
              key={i}
              className="text-lg font-bold border-b border-blue-200 dark:border-blue-800 pb-2 mt-3"
            >
              {formatInlineText(trimmed.slice(2))}
            </h2>
          );
        }

        // ## 二级标题
        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="text-base font-semibold border-b border-muted pb-1 mt-2"
            >
              {formatInlineText(trimmed.slice(3))}
            </h3>
          );
        }

        // ### 三级子标题
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={i}
              className="text-sm font-semibold text-muted-foreground mt-1"
            >
              {formatInlineText(trimmed.slice(4))}
            </h4>
          );
        }

        // > 引用块
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-blue-300 dark:border-blue-700 pl-3 py-1 text-sm text-muted-foreground italic"
            >
              {formatInlineText(trimmed.slice(2))}
            </blockquote>
          );
        }

        // 普通段落 → 使用 HighlightableText 保留高亮能力
        return (
          <HighlightableText
            key={i}
            content={trimmed}
            section="overview"
            itemIndex={i}
            highlights={handlers.highlights}
            onCreateHighlight={handlers.onCreateHighlight}
            onUpdateHighlight={handlers.onUpdateHighlight}
            onDeleteHighlight={handlers.onDeleteHighlight}
            className="text-sm leading-relaxed"
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// OverviewSection 主组件
// ============================================================================

interface OverviewSectionProps {
  content: string;
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}

/**
 * 概述区块（带折叠功能 + 结构化排版）
 */
export const OverviewSection = memo(function OverviewSection({
  content,
  handlers,
  defaultOpen = true,
}: OverviewSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // 判断内容是否包含 Markdown 结构
  const hasMarkdownStructure = useMemo(
    () => /^#{1,3}\s|^\>\s|\*\*.*\*\*|\n\n/m.test(content),
    [content],
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-blue-400 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100/80 dark:hover:bg-blue-900/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <FileText className="h-5 w-5 text-blue-500" />
              概述
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4">
            {hasMarkdownStructure ? (
              <FormattedOverview content={content} handlers={handlers} />
            ) : (
              <HighlightableText
                content={content}
                section="overview"
                highlights={handlers.highlights}
                onCreateHighlight={handlers.onCreateHighlight}
                onUpdateHighlight={handlers.onUpdateHighlight}
                onDeleteHighlight={handlers.onDeleteHighlight}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
