/**
 * 综述入口卡片
 *
 * 当书签所在文件夹 ≥3 篇或同标签内容 ≥3 篇时出现，
 * 引导用户快速进入综述创建流程。
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

"use client";

import { useRouter } from "next/navigation";
import { Folder, Tag, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSynthesisContext } from "@/hooks/bookmark/use-synthesis-context";
import { DETAIL_INSIGHTS_TEXT } from "./constants";
import type { SynthesisEligibility } from "./types";

const TEXT = DETAIL_INSIGHTS_TEXT.synthesisEntry;

// ============================================================================
// Sub-components
// ============================================================================

function EligibilityRow({
  item,
  onNavigate,
}: {
  item: SynthesisEligibility;
  onNavigate: (item: SynthesisEligibility) => void;
}) {
  const Icon = item.sourceType === "folder" ? Folder : Tag;
  const description =
    item.sourceType === "folder"
      ? TEXT.folderDescription(item.sourceName, item.count)
      : TEXT.tagDescription(item.sourceName, item.count);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <Icon className="size-4 text-slate-400 flex-shrink-0" />
        <span className="text-slate-600 dark:text-slate-300 truncate">
          {description}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate(item)}
        className="flex-shrink-0 h-7 text-xs"
      >
        {TEXT.createButton}
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface SynthesisEntryCardProps {
  bookmarkId: number;
  folderId: number | null;
  folderName: string | null;
  userTags: string[] | null;
  aiTags: string[] | null;
}

export function SynthesisEntryCard({
  bookmarkId,
  folderId,
  folderName,
  userTags,
  aiTags,
}: SynthesisEntryCardProps) {
  const router = useRouter();

  const { data: eligibilities, isLoading } = useSynthesisContext(
    bookmarkId,
    folderId,
    folderName,
    userTags,
    aiTags,
  );

  // 触发条件：至少一个维度满足
  if (isLoading || !eligibilities || eligibilities.length === 0) {
    return null;
  }

  const handleNavigate = (item: SynthesisEligibility) => {
    const params = new URLSearchParams({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
    });
    router.push(`/synthesis/new?${params.toString()}`);
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardContent className="px-3 py-2.5 space-y-2">
        {/* 标题行 */}
        <div className="flex items-center gap-2 text-sm">
          <BarChart3 className="size-4 text-indigo-500 flex-shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {TEXT.sectionTitle}
          </span>
        </div>

        {/* 资格列表 */}
        <div className="space-y-1.5">
          {eligibilities.map((item) => (
            <EligibilityRow
              key={`${item.sourceType}-${item.sourceId}`}
              item={item}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
