/**
 * Consensus Section 组件
 *
 * 共识区块（带折叠功能和来源跳转）
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
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
import type { ConsensusPoint } from "@/lib/synthesis";
import type { HighlightHandlers } from "./types";

interface ConsensusSectionProps {
  items: ConsensusPoint[];
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}

/**
 * 共识区块（带折叠功能和来源跳转）
 */
export const ConsensusSection = memo(function ConsensusSection({
  items,
  handlers,
  defaultOpen = true,
}: ConsensusSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-green-400 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer bg-green-50/80 dark:bg-green-950/30 hover:bg-green-100/80 dark:hover:bg-green-900/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              核心共识
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            </CardTitle>
            <CardDescription>多个来源都认同的观点</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="border-l-4 border-green-500 pl-4 py-2 space-y-2"
              >
                <HighlightableText
                  content={item.point}
                  section="consensus"
                  itemIndex={index}
                  highlights={handlers.highlights}
                  onCreateHighlight={handlers.onCreateHighlight}
                  onUpdateHighlight={handlers.onUpdateHighlight}
                  onDeleteHighlight={handlers.onDeleteHighlight}
                  className="font-medium"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>置信度: {Math.round(item.confidence * 100)}%</span>
                  <span>·</span>
                  <span>{item.sources.length} 个来源</span>
                </div>
                <SourceList sources={item.sources} maxVisible={3} />
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
