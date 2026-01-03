"use client";

/**
 * V4.2 Report Suggestions List
 * 展示月度报告中的优化建议列表
 */

import { Badge } from "@/components/ui/badge";
import {
  Scissors,
  Merge,
  FileEdit,
  Trash2,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Type Definitions
// ============================================

export interface ReportSuggestion {
  type?: "merge" | "split" | "rename" | "cleanup";
  description?: string;
  targetFolders?: Array<{ id: number; name: string }>;
  priority?: "high" | "medium" | "low";
}

interface ReportSuggestionsListProps {
  suggestions: ReportSuggestion[];
  onSuggestionClick?: (suggestion: ReportSuggestion) => void;
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

function getSuggestionIcon(type: ReportSuggestion["type"]) {
  switch (type) {
    case "split":
      return Scissors;
    case "merge":
      return Merge;
    case "rename":
      return FileEdit;
    case "cleanup":
      return Trash2;
    default:
      return Lightbulb;
  }
}

function getSuggestionColor(type: ReportSuggestion["type"]) {
  switch (type) {
    case "split":
      return "text-amber-500";
    case "merge":
      return "text-blue-500";
    case "rename":
      return "text-purple-500";
    case "cleanup":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

function getPriorityBadge(priority: ReportSuggestion["priority"]) {
  switch (priority) {
    case "high":
      return (
        <Badge variant="destructive" className="text-xs">
          高优先
        </Badge>
      );
    case "medium":
      return (
        <Badge
          variant="outline"
          className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700"
        >
          中优先
        </Badge>
      );
    case "low":
      return (
        <Badge variant="outline" className="text-xs">
          低优先
        </Badge>
      );
    default:
      return null;
  }
}

// ============================================
// Component Implementation
// ============================================

export function ReportSuggestionsList({
  suggestions,
  onSuggestionClick,
  className,
}: ReportSuggestionsListProps) {
  if (suggestions.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="font-medium text-green-600 dark:text-green-400">
          文件夹结构健康
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          暂无优化建议，继续保持！
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          优化建议
        </h4>
        <span className="text-xs text-muted-foreground">
          {suggestions.length} 条建议
        </span>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const Icon = getSuggestionIcon(suggestion.type);
          const iconColor = getSuggestionColor(suggestion.type);
          const targetFolders = suggestion.targetFolders ?? [];

          return (
            <div
              key={index}
              className={cn(
                "p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
                onSuggestionClick && "cursor-pointer",
              )}
              onClick={() => onSuggestionClick?.(suggestion)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    suggestion.priority === "high"
                      ? "bg-red-100 dark:bg-red-900/30"
                      : suggestion.priority === "medium"
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-muted",
                  )}
                >
                  <Icon className={cn("w-4 h-4", iconColor)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getPriorityBadge(suggestion.priority)}
                  </div>
                  <p className="text-sm">{suggestion.description ?? ""}</p>
                  {targetFolders.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {targetFolders.map((folder) => (
                        <Badge
                          key={folder.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {folder.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {onSuggestionClick && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReportSuggestionsList;
