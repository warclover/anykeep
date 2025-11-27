/**
 * AI 分类通知工具
 * 处理收藏创建后的分类通知（高置信度/中置信度）
 */

"use client";

import { toast } from "sonner";

/**
 * 分类响应数据结构
 */
export interface ClassificationResponse {
  auto_classified: boolean;
  confidence: number | null;
  folder_name: string | null;
  suggestion: {
    id: number;
    folder_name: string;
    confidence: number;
    reason: string;
  } | null;
}

/**
 * 显示高置信度自动归类通知（≥80%）
 * 带有"撤销"操作
 */
export function showAutoClassificationToast(
  folderName: string,
  bookmarkId: number,
  confidence: number,
  onUndo?: () => Promise<void>,
) {
  toast.success(
    <div className="flex flex-col gap-1">
      <div className="font-medium">已自动归类到「{folderName}」</div>
      <div className="text-xs text-muted-foreground">
        AI 置信度: {confidence}%
      </div>
    </div>,
    {
      duration: 5000,
      action: onUndo
        ? {
            label: "撤销",
            onClick: async () => {
              try {
                await onUndo();
                toast.success("已撤销自动归类");
              } catch {
                toast.error("撤销失败");
              }
            },
          }
        : undefined,
    },
  );
}

/**
 * 显示中置信度分类建议（60-79%）
 * 带有"确认"和"忽略"操作
 */
export function showClassificationSuggestionToast(
  suggestion: {
    id: number;
    folder_name: string;
    confidence: number;
    reason: string;
  },
  onAccept: (suggestionId: number) => Promise<void>,
  onReject: (suggestionId: number) => Promise<void>,
) {
  toast(
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="font-medium">
            推荐归类到「{suggestion.folder_name}」
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {suggestion.reason}
          </div>
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 whitespace-nowrap">
          {suggestion.confidence}%
        </div>
      </div>
    </div>,
    {
      duration: 15000, // 15秒后自动关闭
      action: {
        label: "确认",
        onClick: async () => {
          try {
            await onAccept(suggestion.id);
            toast.success(`已归类到「${suggestion.folder_name}」`);
          } catch {
            toast.error("操作失败，请重试");
          }
        },
      },
      cancel: {
        label: "忽略",
        onClick: async () => {
          try {
            await onReject(suggestion.id);
          } catch (error) {
            // 静默失败
            console.error("Reject suggestion failed:", error);
          }
        },
      },
    },
  );
}

/**
 * 处理收藏创建响应，显示相应的分类通知
 */
export async function handleClassificationNotification(
  classification: ClassificationResponse,
  bookmarkId: number,
  onAcceptSuggestion: (suggestionId: number) => Promise<void>,
  onRejectSuggestion: (suggestionId: number) => Promise<void>,
  onUndoAutoClassification?: () => Promise<void>,
) {
  if (!classification) return;

  // 高置信度（≥80%）：显示自动归类通知
  if (classification.auto_classified && classification.folder_name) {
    showAutoClassificationToast(
      classification.folder_name,
      bookmarkId,
      classification.confidence || 80,
      onUndoAutoClassification,
    );
  }

  // 中置信度（60-79%）：显示分类建议
  if (classification.suggestion) {
    showClassificationSuggestionToast(
      classification.suggestion,
      onAcceptSuggestion,
      onRejectSuggestion,
    );
  }

  // 低置信度（<60%）或无AI推荐：不显示通知
}

/**
 * 调用 API 接受分类建议
 */
export async function acceptClassificationSuggestion(
  suggestionId: number,
): Promise<void> {
  const response = await fetch("/api/bookmarks/suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "accept",
      suggestionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "接受建议失败");
  }
}

/**
 * 调用 API 拒绝分类建议
 */
export async function rejectClassificationSuggestion(
  suggestionId: number,
): Promise<void> {
  const response = await fetch("/api/bookmarks/suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "reject",
      suggestionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "拒绝建议失败");
  }
}
