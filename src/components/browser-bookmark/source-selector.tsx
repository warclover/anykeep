"use client";

import { Chrome, Compass, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { BrowserSource } from "@/lib/browser-bookmark";
import {
  getBrowserSourceName,
  getSupportedBrowserSources,
} from "@/lib/browser-bookmark";

interface SourceSelectorProps {
  detectedSource: BrowserSource;
  selectedSource: BrowserSource;
  onSourceChange: (source: BrowserSource) => void;
  disabled?: boolean;
}

// Icons kept for future use
void Chrome;
void Compass;
void Globe;

const sourceEmojis: Record<BrowserSource, string> = {
  chrome: "🌐",
  edge: "🔷",
  firefox: "🦊",
  safari: "🧭",
  unknown: "📌",
};

export function SourceSelector({
  detectedSource,
  selectedSource,
  onSourceChange,
  disabled = false,
}: SourceSelectorProps) {
  const isAutoDetected = selectedSource === detectedSource;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">来源:</span>
      <Select
        value={selectedSource}
        onValueChange={(value) => onSourceChange(value as BrowserSource)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            <div className="flex items-center gap-2">
              <span>{sourceEmojis[selectedSource]}</span>
              <span>{getBrowserSourceName(selectedSource)}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {getSupportedBrowserSources().map((source) => (
            <SelectItem key={source} value={source}>
              <div className="flex items-center gap-2">
                <span>{sourceEmojis[source]}</span>
                <span>{getBrowserSourceName(source)}</span>
              </div>
            </SelectItem>
          ))}
          <SelectItem value="unknown">
            <div className="flex items-center gap-2">
              <span>{sourceEmojis.unknown}</span>
              <span>{getBrowserSourceName("unknown")}</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {isAutoDetected && detectedSource !== "unknown" && (
        <Badge variant="secondary" className="text-xs">
          自动检测
        </Badge>
      )}
    </div>
  );
}
