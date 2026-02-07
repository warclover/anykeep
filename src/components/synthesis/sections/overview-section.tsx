/**
 * Overview Section 组件
 *
 * 概述区块（带折叠功能）
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HighlightableText } from "../highlightable-text";
import type { HighlightHandlers } from "./types";

interface OverviewSectionProps {
  content: string;
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}

/**
 * 概述区块（带折叠功能）
 */
export const OverviewSection = memo(function OverviewSection({
  content,
  handlers,
  defaultOpen = true,
}: OverviewSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
              <FileText className="h-5 w-5 text-blue-500" />
              概述
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <HighlightableText
              content={content}
              section="overview"
              highlights={handlers.highlights}
              onCreateHighlight={handlers.onCreateHighlight}
              onUpdateHighlight={handlers.onUpdateHighlight}
              onDeleteHighlight={handlers.onDeleteHighlight}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
