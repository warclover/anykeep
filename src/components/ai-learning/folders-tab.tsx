/**
 * AI 学习洞察页面 - 文件夹偏好选项卡
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderHeart } from "lucide-react";
import { TEXT } from "./constants";
import type { FolderPreference } from "./types";

export function FoldersTab({ folders }: { folders: FolderPreference[] }) {
  if (folders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FolderHeart className="size-10 mx-auto mb-3 opacity-30" />
          <p>{TEXT.folders.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const maxFreq = Math.max(...folders.map((f) => f.usageFrequency), 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {TEXT.folders.description}
      </p>

      {folders.map((folder, index) => (
        <Card key={folder.folderId}>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-muted-foreground font-mono w-5">
                #{index + 1}
              </span>
              <FolderHeart className="size-4 text-amber-500 shrink-0" />
              <span className="font-medium truncate">{folder.folderName}</span>
              <span className="ml-auto text-sm text-muted-foreground shrink-0">
                {folder.usageFrequency} {TEXT.folders.bookmarks}
              </span>
            </div>

            <div className="ml-8">
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${(folder.usageFrequency / maxFreq) * 100}%`,
                  }}
                />
              </div>

              {folder.associatedTags.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground mr-2">
                    {TEXT.folders.topTags}:
                  </span>
                  <div className="inline-flex flex-wrap gap-1">
                    {folder.associatedTags.slice(0, 8).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {folder.associatedTags.length > 8 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{folder.associatedTags.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {folder.associatedSources.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mr-2">
                    {TEXT.folders.topSources}:
                  </span>
                  <div className="inline-flex flex-wrap gap-1">
                    {folder.associatedSources.slice(0, 5).map((src) => (
                      <Badge
                        key={src}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {src}
                      </Badge>
                    ))}
                    {folder.associatedSources.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{folder.associatedSources.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
