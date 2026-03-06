/**
 * AI 学习洞察页面 - 排除规则选项卡
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldBan, Globe, FolderHeart } from "lucide-react";
import { TEXT } from "./constants";
import type { ExclusionRecord, FolderPreference } from "./types";

export function ExclusionsTab({
  exclusions,
  stats,
  folderPreferences,
}: {
  exclusions: ExclusionRecord[];
  stats: {
    total: number;
    byType: Record<string, number>;
    byFolder: Record<string, number>;
  };
  folderPreferences?: FolderPreference[];
}) {
  const folderNameMap = useMemo(() => {
    const map = new Map<number, string>();
    folderPreferences?.forEach((f) => map.set(f.folderId, f.folderName));
    return map;
  }, [folderPreferences]);

  // 按文件夹分组 - 必须在条件返回之前调用
  const grouped = useMemo(() => {
    const map = new Map<number, ExclusionRecord[]>();
    for (const ex of exclusions) {
      if (!map.has(ex.folder_id)) map.set(ex.folder_id, []);
      map.get(ex.folder_id)!.push(ex);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [exclusions]);

  const getFolderName = (id: number) =>
    folderNameMap.get(id) ?? `文件夹 #${id}`;

  const typeIcons: Record<string, typeof ShieldBan> = {
    tag: ShieldBan,
    source: Globe,
    keyword: ShieldBan,
  };

  if (exclusions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShieldBan className="size-10 mx-auto mb-3 opacity-30" />
          <p>{TEXT.exclusions.empty}</p>
          <p className="text-xs mt-1">{TEXT.exclusions.emptyHint}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {TEXT.exclusions.description}
      </p>

      {/* 类型分布 */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(stats.byType).map(([type, count]) => (
          <Badge key={type} variant="secondary" className="gap-1">
            {(TEXT.exclusions[
              type as keyof typeof TEXT.exclusions
            ] as string) ?? type}
            <span className="font-bold">{count}</span>
          </Badge>
        ))}
      </div>

      {/* 按文件夹分组列表 */}
      {grouped.map(([folderId, records]) => (
        <Card key={folderId}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderHeart className="size-4 text-amber-500" />
              {getFolderName(folderId)}
              <Badge variant="outline" className="text-xs ml-auto">
                {records.length} 条规则
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-1.5">
              {records.map((ex) => {
                const Icon = typeIcons[ex.exclusion_type] ?? ShieldBan;
                const value =
                  ex.excluded_tag ??
                  ex.excluded_source_id ??
                  ex.excluded_keyword ??
                  "—";
                const createdLabel =
                  TEXT.exclusions.createdFrom[ex.created_from] ??
                  ex.created_from;

                return (
                  <div
                    key={ex.id}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted/50"
                  >
                    <Icon className="size-3.5 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {(TEXT.exclusions[
                        ex.exclusion_type as keyof typeof TEXT.exclusions
                      ] as string) ?? ex.exclusion_type}
                    </Badge>
                    <span className="truncate font-mono text-xs">{value}</span>
                    {ex.weight != null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        权重 {(ex.weight * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {createdLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
