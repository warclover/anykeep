/**
 * AI 分类通知工具
 * 处理收藏创建后的分类通知（高置信度/中置信度）
 */

"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, X, RefreshCw } from "lucide-react";
import { clientLogger } from "@/lib/client-logger";
import { API_BOOKMARKS } from "@/lib/constants/api-paths";

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
 * 带有"确认"、"换一个"和"忽略"操作
 */
export function showClassificationSuggestionToast(
  suggestion: {
    id: number;
    folder_name: string;
    confidence: number;
    reason: string;
  },
  bookmarkId: number,
  onAccept: (suggestionId: number) => Promise<void>,
  onReject: (suggestionId: number) => Promise<void>,
  onChangeFolder?: (bookmarkId: number, suggestionId: number) => void,
) {
  const toastId = toast(
    <div className="flex flex-col gap-3">
      {/* 信息区域 */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="font-medium text-sm">
            💡 推荐归类到「{suggestion.folder_name}」
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {suggestion.reason}
          </div>
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0">
          {suggestion.confidence}%
        </div>
      </div>

      {/* 操作按钮区域 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1"
          onClick={async () => {
            try {
              await onAccept(suggestion.id);
              toast.dismiss(toastId);
              toast.success(`已归类到「${suggestion.folder_name}」`);
            } catch {
              toast.error("操作失败，请重试");
            }
          }}
        >
          <Check className="w-3 h-3 mr-1" />
          同意
        </Button>

        {onChangeFolder && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={() => {
              toast.dismiss(toastId);
              onChangeFolder(bookmarkId, suggestion.id);
            }}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            换一个
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={async () => {
            try {
              await onReject(suggestion.id);
              toast.dismiss(toastId);
            } catch (error) {
              clientLogger.error({ error }, "Reject suggestion failed:");
            }
          }}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>,
    {
      duration: 10000, // 10秒后自动关闭
      className: "w-[360px]",
    },
  );

  return toastId;
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
  onChangeFolder?: (bookmarkId: number, suggestionId: number) => void,
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
      bookmarkId,
      onAcceptSuggestion,
      onRejectSuggestion,
      onChangeFolder,
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
  const response = await fetch(API_BOOKMARKS.suggestions, {
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
  const response = await fetch(API_BOOKMARKS.suggestions, {
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

// ============================================================================
// V3.0 新增：自动创建文件夹通知
// ============================================================================

import {
  FolderPlus,
  Lightbulb,
  FolderSync,
  FolderOpen,
  Undo2,
} from "lucide-react";

/**
 * V3.0 - 显示自动创建文件夹通知
 * 当系统自动创建新文件夹并归类书签时触发
 */
export function showAutoCreateFolderToast(
  folderName: string,
  bookmarkTitle: string,
  onUndo: () => Promise<void>,
  onViewFolder?: () => void,
) {
  const toastId = toast(
    <div className="flex flex-col gap-2">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <FolderPlus className="w-4 h-4 text-green-500 shrink-0" />
        <span className="font-medium text-sm">
          已创建新文件夹「{folderName}」
        </span>
      </div>

      {/* 归类信息 */}
      <div className="text-xs text-muted-foreground pl-6">
        「
        {bookmarkTitle.length > 30
          ? bookmarkTitle.slice(0, 30) + "..."
          : bookmarkTitle}
        」已归入此文件夹
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pl-6">
        {onViewFolder && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={() => {
              toast.dismiss(toastId);
              onViewFolder();
            }}
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            查看
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={async () => {
            try {
              await onUndo();
              toast.dismiss(toastId);
              toast.info("已撤销，内容已移回待整理，文件夹已删除");
            } catch {
              toast.error("撤销失败，请重试");
            }
          }}
        >
          <Undo2 className="w-3 h-3 mr-1" />
          撤销
        </Button>
      </div>
    </div>,
    {
      duration: 8000,
      className: "w-[340px]",
    },
  );

  return toastId;
}

/**
 * V3.0 - 显示建议创建文件夹通知（用户确认模式）
 * 当 AI 建议创建新文件夹但需要用户确认时触发
 */
export function showSuggestCreateFolderToast(
  suggestedName: string,
  bookmarkTitle: string,
  universalCategoryName: string,
  onConfirm: () => Promise<void>,
  onReject: () => void,
) {
  const toastId = toast(
    <div className="flex flex-col gap-3">
      {/* 建议信息 */}
      <div className="flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-sm">
            建议创建新文件夹「{suggestedName}」
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            「
            {bookmarkTitle.length > 25
              ? bookmarkTitle.slice(0, 25) + "..."
              : bookmarkTitle}
            」 属于「{universalCategoryName}」领域，但无匹配文件夹
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1"
          onClick={async () => {
            try {
              await onConfirm();
              toast.dismiss(toastId);
              toast.success(`已创建「${suggestedName}」并归类`);
            } catch {
              toast.error("创建失败，请重试");
            }
          }}
        >
          <Check className="w-3 h-3 mr-1" />
          创建并归类
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            onReject();
            toast.dismiss(toastId);
          }}
        >
          暂不创建
        </Button>
      </div>
    </div>,
    {
      duration: 15000, // 15秒，给用户足够时间决定
      className: "w-[380px]",
    },
  );

  return toastId;
}

// ============================================================================
// V3.0 新增：回溯分类通知
// ============================================================================

/**
 * 回溯分类项目信息
 */
interface BackfillClassifiedItem {
  id: number;
  title: string;
  confidence: number;
}

/**
 * V3.0 - 显示回溯分类完成通知
 * 当新文件夹创建后，待整理中的相关内容被自动归类时触发
 */
export function showBackfillClassificationToast(
  folderName: string,
  classifiedCount: number,
  classifiedItems: BackfillClassifiedItem[],
  onViewFolder: () => void,
  onUndo: () => Promise<void>,
) {
  // 如果没有归类任何内容，不显示通知
  if (classifiedCount === 0) return null;

  const toastId = toast(
    <div className="flex flex-col gap-3">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <FolderSync className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="font-medium text-sm">
          已整理 {classifiedCount} 条相关内容
        </span>
      </div>

      {/* 详情说明 */}
      <div className="text-xs text-muted-foreground">
        以下内容已从「待整理」移动到「{folderName}」：
      </div>

      {/* 归类列表预览 */}
      <div className="space-y-1 max-h-[100px] overflow-y-auto">
        {classifiedItems.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
          >
            <span className="truncate flex-1 mr-2">
              {item.title.length > 30
                ? item.title.slice(0, 30) + "..."
                : item.title}
            </span>
            <span className="text-muted-foreground shrink-0">
              {item.confidence}%
            </span>
          </div>
        ))}
        {classifiedCount > 5 && (
          <div className="text-xs text-muted-foreground text-center py-1">
            还有 {classifiedCount - 5} 条...
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1"
          onClick={() => {
            toast.dismiss(toastId);
            onViewFolder();
          }}
        >
          <FolderOpen className="w-3 h-3 mr-1" />
          查看文件夹
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={async () => {
            try {
              await onUndo();
              toast.dismiss(toastId);
              toast.info(`已撤销，${classifiedCount} 条内容已移回待整理`);
            } catch {
              toast.error("撤销失败，请重试");
            }
          }}
        >
          <Undo2 className="w-3 h-3 mr-1" />
          撤销全部
        </Button>
      </div>
    </div>,
    {
      duration: 15000, // 15秒，给用户足够时间查看
      className: "w-[400px]",
    },
  );

  return toastId;
}

/**
 * V3.0 - 显示简洁的回溯分类通知（少量内容时）
 */
export function showSimpleBackfillToast(
  folderName: string,
  count: number,
  onViewFolder?: () => void,
) {
  toast.success(
    <div className="flex flex-col gap-1">
      <div className="font-medium">
        已将 {count} 条相关内容整理到「{folderName}」
      </div>
      <div className="text-xs text-muted-foreground">来自待整理的历史内容</div>
    </div>,
    {
      duration: 5000,
      action: onViewFolder
        ? {
            label: "查看",
            onClick: onViewFolder,
          }
        : undefined,
    },
  );
}
