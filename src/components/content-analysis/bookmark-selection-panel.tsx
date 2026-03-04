"use client";

import { Search, Lightbulb, CheckSquare, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SynthesisDepthMode, SynthesisOutputStyle } from "@/lib/synthesis";
import { AdvancedSettingsPanel } from "@/components/synthesis/advanced-settings-panel";
import { BookmarkListItem } from "./bookmark-list-item";
import type { BookmarkItem, AnalysisTab } from "./types";

interface BookmarkSelectionPanelProps {
  mode: Extract<AnalysisTab, "compare" | "synthesis">;
  hint: string;
  bookmarks: BookmarkItem[];
  isLoadingBookmarks: boolean;
  bookmarkSearch: string;
  onSearchChange: (value: string) => void;
  selectedIds: Set<number>;
  selectedCount: number;
  onToggleSelection: (id: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  canStartAnalysis: boolean;
  isCreating: boolean;
  buttonText: string;
  onStartAnalysis: () => void;
  depthMode?: SynthesisDepthMode;
  outputStyle?: SynthesisOutputStyle;
  onDepthModeChange?: (mode: SynthesisDepthMode) => void;
  onOutputStyleChange?: (style: SynthesisOutputStyle) => void;
}

function BookmarkListSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
          <div className="h-5 w-5 shrink-0 rounded bg-muted" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-4 bg-muted rounded w-12" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BookmarkSelectionPanel({
  mode,
  hint,
  bookmarks,
  isLoadingBookmarks,
  bookmarkSearch,
  onSearchChange,
  selectedIds,
  selectedCount,
  onToggleSelection,
  hasMore,
  isLoadingMore,
  onLoadMore,
  canStartAnalysis,
  isCreating,
  buttonText,
  onStartAnalysis,
  depthMode,
  outputStyle,
  onDepthModeChange,
  onOutputStyleChange,
}: BookmarkSelectionPanelProps) {
  const maxCount = mode === "compare" ? 2 : Infinity;
  const scrollHeight =
    mode === "compare" ? "calc(100vh - 320px)" : "calc(100vh - 340px)";

  return (
    <div className="flex flex-col flex-1 -mx-4 md:-mx-8 px-4 md:px-8">
      <Alert className="mt-4 bg-muted/50 border-muted">
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>{hint}</AlertDescription>
      </Alert>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={bookmarkSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索书签..."
          className="pl-9"
        />
      </div>

      <ScrollArea
        className="flex-1 mt-4 border rounded-lg"
        style={{ height: scrollHeight }}
      >
        {isLoadingBookmarks ? (
          <BookmarkListSkeleton />
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckSquare className="h-8 w-8 mb-2" />
            <p className="text-sm">
              {bookmarkSearch ? "未找到匹配的书签" : "暂无书签"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {bookmarks.map((bookmark) => {
              const isSelected = selectedIds.has(bookmark.id);
              const isDisabled =
                !isSelected && mode === "compare" && selectedCount >= maxCount;

              return (
                <BookmarkListItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  isSelected={isSelected}
                  onToggle={() => onToggleSelection(bookmark.id)}
                  disabled={isDisabled}
                />
              );
            })}

            {hasMore && (
              <div className="p-3 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    "加载更多"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="sticky bottom-0 border-t bg-background py-4 -mx-4 md:-mx-8 px-4 md:px-8 mt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              已选{" "}
              <span className="font-medium text-foreground">
                {selectedCount}
              </span>{" "}
              篇{mode === "compare" ? " / 最多 2 篇" : ""}
            </span>

            {mode === "synthesis" &&
              depthMode &&
              outputStyle &&
              onDepthModeChange &&
              onOutputStyleChange && (
                <AdvancedSettingsPanel
                  depthMode={depthMode}
                  outputStyle={outputStyle}
                  onDepthModeChange={onDepthModeChange}
                  onOutputStyleChange={onOutputStyleChange}
                  disabled={isCreating}
                />
              )}
          </div>

          <Button
            onClick={onStartAnalysis}
            disabled={!canStartAnalysis || isCreating}
            className="gap-2"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
