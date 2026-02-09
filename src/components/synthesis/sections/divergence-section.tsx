/**
 * Divergence Section 组件
 *
 * 分歧区块（带折叠功能和来源跳转）
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HighlightableText } from "../highlightable-text";
import { SourceList } from "./source-components";
import type { DivergencePoint } from "@/lib/synthesis";
import type { HighlightHandlers } from "./types";

interface DivergenceSectionProps {
  items: DivergencePoint[];
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}

/**
 * 分歧区块（带折叠功能和来源跳转）
 */
export const DivergenceSection = memo(function DivergenceSection({
  items,
  handlers,
  defaultOpen = true,
}: DivergenceSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-amber-400 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              观点分歧
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            </CardTitle>
            <CardDescription>不同来源之间的观点冲突</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-4">
            {items.map((item, index) => (
              <div key={index} className="space-y-3">
                <h4 className="text-sm">{item.topic}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 观点 A */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <HighlightableText
                      content={item.point_a}
                      section="divergence"
                      itemIndex={index * 2}
                      highlights={handlers.highlights}
                      onCreateHighlight={handlers.onCreateHighlight}
                      onUpdateHighlight={handlers.onUpdateHighlight}
                      onDeleteHighlight={handlers.onDeleteHighlight}
                      className="mb-2"
                    />
                    <SourceList
                      sources={item.sources_a}
                      maxVisible={2}
                      maxLength={15}
                    />
                  </div>
                  {/* 观点 B */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <HighlightableText
                      content={item.point_b}
                      section="divergence"
                      itemIndex={index * 2 + 1}
                      highlights={handlers.highlights}
                      onCreateHighlight={handlers.onCreateHighlight}
                      onUpdateHighlight={handlers.onUpdateHighlight}
                      onDeleteHighlight={handlers.onDeleteHighlight}
                      className="mb-2"
                    />
                    <SourceList
                      sources={item.sources_b}
                      maxVisible={2}
                      maxLength={15}
                    />
                  </div>
                </div>
                {/* AI 分析 */}
                <div className="bg-muted/40 rounded-lg p-3 border-l-2 border-amber-300 dark:border-amber-600">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground/70">
                      💡 分析：
                    </span>
                    {item.analysis}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
