/**
 * 提取要点面板
 *
 * 从 ai-bookmark-assistant.tsx 提取
 */

import { FileText, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KeyPointsPanel as KeyPointsPanelData } from "./assistant-constants";
import { SENTIMENT_LABELS } from "./assistant-constants";

interface KeyPointsPanelProps {
  data: KeyPointsPanelData;
  onDismiss: () => void;
}

export function KeyPointsPanel({ data, onDismiss }: KeyPointsPanelProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="size-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            提取要点
          </span>
          {data.readingTime && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {data.readingTime} 分钟
            </span>
          )}
          {data.sentiment && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              {SENTIMENT_LABELS[data.sentiment]}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="size-3" />
        </Button>
      </div>
      {data.tldr && (
        <p className="text-xs text-foreground/80 italic border-l-2 border-amber-400 pl-2">
          {data.tldr}
        </p>
      )}
      {data.keyPoints.length > 0 && (
        <ul className="space-y-1.5">
          {data.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-400 font-medium">
                {i + 1}
              </span>
              <span className="text-foreground/80 leading-relaxed">
                {point}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-amber-200 dark:border-amber-800/50">
          {data.keywords.map((kw) => (
            <span
              key={kw}
              className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
