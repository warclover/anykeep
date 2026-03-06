/**
 * AI 学习洞察页面 - 来源偏好选项卡
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { TEXT } from "./constants";
import type { SourcePreference, FolderPreference } from "./types";

export function SourcesTab({
  sources,
  folders,
}: {
  sources: SourcePreference[];
  folders: FolderPreference[];
}) {
  const folderNameMap = useMemo(() => {
    const map = new Map<number, string>();
    folders.forEach((f) => map.set(f.folderId, f.folderName));
    return map;
  }, [folders]);

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Globe className="size-10 mx-auto mb-3 opacity-30" />
          <p>{TEXT.sources.empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {TEXT.sources.description}
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {sources.map((src) => {
              const folderName =
                folderNameMap.get(src.preferredFolderId) ??
                `文件夹 #${src.preferredFolderId}`;

              return (
                <div
                  key={src.sourceId}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Globe className="size-4 text-cyan-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {src.sourceName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → {folderName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {src.sampleCount} {TEXT.sources.samples}
                    </span>
                    <Badge
                      variant={
                        src.confirmationRate >= 0.7 ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {TEXT.sources.confidence}{" "}
                      {Math.round(src.confirmationRate * 100)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
