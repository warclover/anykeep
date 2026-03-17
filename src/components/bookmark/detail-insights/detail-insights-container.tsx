/**
 * 详情页洞察卡片容器
 *
 * 管理四个子卡片的触发条件和渲染。
 * 各子卡片内部自行判断触发条件并决定是否渲染（return null）。
 * 容器始终渲染以确保子组件 hooks 正常执行。
 *
 * @version 1.1.0
 * @since 2026-03-17
 */

"use client";

import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";
import { ClassificationExplanation } from "./classification-explanation";
import { QuickCompareCard } from "./quick-compare-card";
import { SynthesisEntryCard } from "./synthesis-entry-card";
import type { DetailInsightsProps } from "./types";

export function DetailInsightsContainer({
  bookmarkId,
  folderId,
  folderName,
  userTags,
  aiTags,
  classificationResult,
}: DetailInsightsProps) {
  const hasClassification =
    classificationResult !== null && classificationResult !== undefined;

  // 容器始终渲染 —— 各子卡片内部自行判断触发条件。
  // 若所有子卡片均 return null，该 div 仅产生一个空 DOM 节点（可接受）。
  return (
    <div className="space-y-3">
      {/* 分类解释面板 */}
      {hasClassification && (
        <SilentErrorBoundary>
          <ClassificationExplanation
            bookmarkId={bookmarkId}
            hasClassificationResult={hasClassification}
          />
        </SilentErrorBoundary>
      )}

      {/* 快速对比卡片 */}
      <SilentErrorBoundary>
        <QuickCompareCard bookmarkId={bookmarkId} />
      </SilentErrorBoundary>

      {/* 综述入口卡片 */}
      <SilentErrorBoundary>
        <SynthesisEntryCard
          bookmarkId={bookmarkId}
          folderId={folderId}
          folderName={folderName}
          userTags={userTags}
          aiTags={aiTags}
        />
      </SilentErrorBoundary>

      {/* Phase 3: KnowledgePositionCard */}
    </div>
  );
}
