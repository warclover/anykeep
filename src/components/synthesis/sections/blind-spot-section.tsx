/**
 * BlindSpot Section 组件
 *
 * 盲区区块（带折叠功能和一键补充）
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb, Search } from "lucide-react";
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
import { BlindSpotSupplementDialog } from "../blind-spot-supplement-dialog";
import type { BlindSpot } from "@/lib/synthesis";
import type { HighlightHandlers } from "./types";

interface BlindSpotSectionProps {
  items: BlindSpot[];
  handlers: HighlightHandlers;
  reportId: string;
  onRegenerate?: () => void;
  defaultOpen?: boolean;
}

/**
 * 盲区区块（带折叠功��）
 */
export const BlindSpotSection = memo(function BlindSpotSection({
  items,
  handlers,
  reportId,
  onRegenerate,
  defaultOpen = true,
}: BlindSpotSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedBlindSpot, setSelectedBlindSpot] = useState<BlindSpot | null>(
    null,
  );

  if (items.length === 0) return null;

  return (
    <>
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
                <Lightbulb className="h-5 w-5 text-purple-500" />
                知识盲区
                <Badge variant="secondary" className="ml-2">
                  {items.length}
                </Badge>
              </CardTitle>
              <CardDescription>你的收藏尚未覆盖的相关领域</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="border-l-4 border-purple-500 pl-4 py-2 space-y-2"
                >
                  <p className="text-sm font-medium">{item.topic}</p>
                  <HighlightableText
                    content={item.suggestion}
                    section="blindspot"
                    itemIndex={index}
                    highlights={handlers.highlights}
                    onCreateHighlight={handlers.onCreateHighlight}
                    onUpdateHighlight={handlers.onUpdateHighlight}
                    onDeleteHighlight={handlers.onDeleteHighlight}
                    className="text-muted-foreground"
                  />
                  {item.search_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.search_keywords.map((keyword, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-purple-100 hover:border-purple-300 transition-colors group"
                          onClick={() => setSelectedBlindSpot(item)}
                        >
                          <Search className="h-3 w-3 mr-1 opacity-50 group-hover:opacity-100" />
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* 相关书签 */}
                  {item.related_bookmarks &&
                    item.related_bookmarks.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs text-muted-foreground mr-2">
                          相关书签:
                        </span>
                        <SourceList
                          sources={item.related_bookmarks}
                          maxVisible={2}
                          maxLength={15}
                        />
                      </div>
                    )}
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 盲区补充对话框 */}
      {selectedBlindSpot && (
        <BlindSpotSupplementDialog
          open={!!selectedBlindSpot}
          onOpenChange={(open) => !open && setSelectedBlindSpot(null)}
          blindSpot={selectedBlindSpot}
          reportId={reportId}
          onRegenerate={onRegenerate}
        />
      )}
    </>
  );
});
