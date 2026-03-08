/**
 * 章节渲染器 (Story 3.2)
 * @module knowledge-studio/structured-output
 *
 * 文档章节结构渲染器。
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Hash } from "lucide-react";
import { AIMarkdown } from "@/components/ai/ai-markdown";
import type { SectionsRendererProps } from "./types";

/**
 * 章节渲染器
 *
 * 渲染文档结构化章节内容。
 */
export const SectionsRenderer = memo(function SectionsRenderer({
  data,
  className,
  maxHeight,
}: SectionsRendererProps) {
  const { title, summary, sections, keywords } = data;

  const renderContent = () => (
    <div className="space-y-4">
      {/* 标题和摘要 */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="size-5" />
          {title}
        </h2>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        {keywords && keywords.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {keywords.map((keyword, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                <Hash className="size-3 mr-0.5" />
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 章节内容 */}
      <div className="space-y-4 pt-2 border-t">
        {sections.map((section) => (
          <div
            key={section.id}
            className={cn(
              "space-y-1",
              section.level === 2 && "pl-4",
              section.level === 3 && "pl-8",
            )}
          >
            <h3
              className={cn(
                "font-semibold",
                section.level === 1 && "text-lg",
                section.level === 2 && "text-base",
                section.level === 3 && "text-sm",
              )}
            >
              {section.title}
            </h3>
            {section.content && (
              <div className="text-sm">
                <AIMarkdown content={section.content} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={className}>
      {maxHeight ? (
        <ScrollArea style={{ maxHeight }} className="pr-4">
          {renderContent()}
        </ScrollArea>
      ) : (
        renderContent()
      )}
    </div>
  );
});

SectionsRenderer.displayName = "SectionsRenderer";
