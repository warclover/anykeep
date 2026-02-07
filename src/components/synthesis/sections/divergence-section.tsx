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
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
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
          <CardContent className="space-y-6 pt-0">
            {items.map((item, index) => (
              <div key={index} className="space-y-3">
                <h4 className="font-medium text-sm">{item.topic}</h4>
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
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground italic">
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
