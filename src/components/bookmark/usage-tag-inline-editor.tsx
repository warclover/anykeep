/**
 * 用途标签内联编辑器
 * 支持点击即保存的 Toggle 模式，无需额外的保存/取消按钮
 *
 * 特性：
 * - 乐观更新：点击立即更新 UI
 * - 错误回滚：保存失败时恢复原状态
 * - 微妙动画：选中/取消时的视觉反馈
 * - 静默成功：成功时不显示 Toast，失败时才提示
 * - P2-010: 自动快照触发（添加特定标签时自动创建快照）
 * - V4.2.5: 微信文章使用专用微信快照 API
 *
 * @version 1.2.0
 * @since 2025-12-14
 */

"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  Loader2,
  X,
  Share2,
  RefreshCcw,
  Award,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  USAGE_TAG_PRESETS,
  getAllUsageTags,
  type UnifiedUsageTag,
} from "@/lib/constants/usage-tags";

// 图标名称到组件的映射
const ICON_MAP: Record<string, LucideIcon> = {
  Share2,
  RefreshCcw,
  Award,
  Eye,
};
import type { CustomUsageTag, Platform } from "@/types/supabase";
import { AddCustomUsageTagDialog } from "./add-custom-usage-tag-dialog";
import { useCustomUsageTags } from "@/hooks/use-custom-usage-tags";
import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";
import { clientLogger } from "@/lib/client-logger";

interface UsageTagInlineEditorProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL（P2-010: 自动快照需要） */
  bookmarkUrl?: string;
  /** 书签平台（V4.2.5: 用于判断使用哪种快照 API） */
  platform?: Platform;
  /** 是否已有快照（P2-010: 避免重复创建） */
  hasSnapshot?: boolean;
  /** 当前已选中的用途标签值列表 */
  selectedTags: string[];
  /** 当前的普通标签（非用途标签，需要保留） */
  regularTags: string[];
  /** 保存成功后的回调 */
  onSaveSuccess?: (newUsageTags: string[]) => void;
  /** 紧凑模式：用于详情页 Header 等空间受限场景 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

export function UsageTagInlineEditor({
  bookmarkId,
  bookmarkUrl = "",
  platform,
  hasSnapshot = false,
  selectedTags: initialSelectedTags,
  regularTags,
  onSaveSuccess,
  compact = false,
  className,
}: UsageTagInlineEditorProps) {
  // 本地状态（用于乐观更新）
  const [localSelectedTags, setLocalSelectedTags] =
    useState<string[]>(initialSelectedTags);

  // P2-010: 自动快照触发 Hook
  // V4.2.5: 传递 platform 参数，微信文章使用专用 API
  const { checkAndTriggerSnapshot } = useAutoSnapshot({
    bookmarkId,
    bookmarkUrl,
    platform,
    hasSnapshot,
  });

  // 正在保存中的标签（用于显示加载状态）
  const [savingTags, setSavingTags] = useState<Set<string>>(new Set());

  // 最近操作的标签（用于动画效果）
  const [recentlyToggled, setRecentlyToggled] = useState<string | null>(null);

  // 添加自定义标签弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false);

  // 保存原始值，用于错误回滚
  const originalTagsRef = useRef<string[]>(initialSelectedTags);

  // 使用统一的自定义标签 Hook
  const { customTags, isLoading, setTags, updateTag } = useCustomUsageTags();

  // 同步外部传入的 selectedTags 变化
  useEffect(() => {
    setLocalSelectedTags(initialSelectedTags);
    originalTagsRef.current = initialSelectedTags;
  }, [initialSelectedTags]);

  // 获取所有可用的用途标签
  const allUsageTags = useMemo(() => {
    return getAllUsageTags(customTags);
  }, [customTags]);

  /**
   * 保存标签到服务器
   */
  const saveToServer = useCallback(
    async (newUsageTags: string[]): Promise<boolean> => {
      try {
        // 合并：新用途标签 + 保留原普通标签
        const newUserTags = [...newUsageTags, ...regularTags];

        const response = await fetch(`/api/bookmarks/${bookmarkId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userTags: newUserTags }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || "保存失败");
        }

        return true;
      } catch (error) {
        clientLogger.error({ error }, "保存用途标签失败");
        return false;
      }
    },
    [bookmarkId, regularTags],
  );

  /**
   * 更新自定义标签的最后使用时间
   */
  const updateLastUsedAt = useCallback(
    async (tagValue: string) => {
      const customTag = customTags.find((t) => t.value === tagValue);
      if (!customTag) return;

      const now = new Date().toISOString();
      updateTag(customTag.id, { lastUsedAt: now });

      // 异步同步到服务器（静默失败）
      try {
        await fetch("/api/settings/usage-tags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: customTag.id, lastUsedAt: now }),
        });
      } catch {
        // 静默失败
      }
    },
    [customTags, updateTag],
  );

  /**
   * Toggle 标签（点击即保存）
   */
  const toggleTag = useCallback(
    async (tagValue: string) => {
      // 防止重复点击
      if (savingTags.has(tagValue)) return;

      const isSelected = localSelectedTags.includes(tagValue);
      const newTags = isSelected
        ? localSelectedTags.filter((t) => t !== tagValue)
        : [...localSelectedTags, tagValue];

      // 1. 乐观更新 UI
      setLocalSelectedTags(newTags);
      setSavingTags((prev) => new Set(prev).add(tagValue));
      setRecentlyToggled(tagValue);

      // 清除动画状态
      setTimeout(() => setRecentlyToggled(null), 300);

      // 2. 后台保存
      const success = await saveToServer(newTags);

      // 3. 处理结果
      setSavingTags((prev) => {
        const next = new Set(prev);
        next.delete(tagValue);
        return next;
      });

      if (success) {
        // 更新原始值（成功后）
        const prevTags = originalTagsRef.current;
        originalTagsRef.current = newTags;
        // 更新最后使用时间（仅添加时）
        if (!isSelected) {
          updateLastUsedAt(tagValue);
        }
        // 通知父组件
        onSaveSuccess?.(newTags);
        // P2-010: 检查是否需要触发自动快照
        checkAndTriggerSnapshot(prevTags, newTags);
      } else {
        // 回滚到原始状态
        setLocalSelectedTags(originalTagsRef.current);
        toast.error("保存失败，请重试");
      }
    },
    [
      localSelectedTags,
      savingTags,
      saveToServer,
      updateLastUsedAt,
      onSaveSuccess,
      checkAndTriggerSnapshot,
    ],
  );

  /**
   * 处理新建自定义标签成功
   */
  const handleCustomTagCreated = useCallback(
    async (newTag: CustomUsageTag, allTags: CustomUsageTag[]) => {
      // 同步到 Hook 缓存
      setTags(allTags);
      setShowAddDialog(false);

      // 自动选中新创建的标签并保存
      const prevTags = localSelectedTags;
      const newTags = [...localSelectedTags, newTag.value];
      setLocalSelectedTags(newTags);

      const success = await saveToServer(newTags);
      if (success) {
        originalTagsRef.current = newTags;
        onSaveSuccess?.(newTags);
        // P2-010: 检查是否需要触发自动快照（自定义标签也可能是触发标签）
        checkAndTriggerSnapshot(prevTags, newTags);
      } else {
        setLocalSelectedTags(originalTagsRef.current);
        toast.error("保存失败，请重试");
      }
    },
    [
      localSelectedTags,
      saveToServer,
      setTags,
      onSaveSuccess,
      checkAndTriggerSnapshot,
    ],
  );

  /**
   * 渲染单个标签按钮
   */
  const renderTagButton = (tag: UnifiedUsageTag) => {
    const isSelected = localSelectedTags.includes(tag.value);
    const isSaving = savingTags.has(tag.value);
    const isRecentlyToggled = recentlyToggled === tag.value;

    return (
      <button
        key={tag.value}
        type="button"
        onClick={() => toggleTag(tag.value)}
        disabled={isSaving}
        className={cn(
          // 基础样式
          "relative inline-flex items-center rounded-full",
          "border transition-all duration-200",
          // 紧凑模式 vs 默认模式
          compact
            ? "gap-1 px-2 py-0.5 text-xs font-medium"
            : "gap-1.5 px-3 py-1.5 text-sm font-medium",
          // 选中状态
          isSelected
            ? [
                tag.style.bgLight,
                tag.style.bgDark,
                tag.style.borderLight,
                tag.style.borderDark,
                tag.style.textLight,
                tag.style.textDark,
                "shadow-sm",
              ]
            : [
                // 未选中：淡色/虚线边框
                "bg-white dark:bg-gray-900",
                "border-dashed border-gray-300 dark:border-gray-600",
                "text-gray-500 dark:text-gray-400",
                "hover:border-gray-400 dark:hover:border-gray-500",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
              ],
          // 动画效果
          isRecentlyToggled && isSelected && "animate-pulse scale-105",
          isRecentlyToggled && !isSelected && "animate-pulse",
          // 禁用状态
          isSaving && "opacity-70 cursor-wait",
        )}
      >
        {/* 图标（预设标签） */}
        {tag.icon &&
          ICON_MAP[tag.icon] &&
          (() => {
            const IconComponent = ICON_MAP[tag.icon];
            return (
              <IconComponent className={compact ? "size-3" : "size-3.5"} />
            );
          })()}

        {/* 标签文字 */}
        <span>{tag.label}</span>

        {/* 选中时显示移除图标或加载指示器 */}
        {isSelected &&
          (isSaving ? (
            <Loader2
              className={cn(
                "animate-spin ml-0.5",
                compact ? "size-2.5" : "size-3",
              )}
            />
          ) : (
            <X
              className={cn(
                "ml-0.5 opacity-60",
                compact ? "size-2.5" : "size-3",
              )}
            />
          ))}

        {/* 未选中时保存中显示加载 */}
        {!isSelected && isSaving && (
          <Loader2
            className={cn(
              "animate-spin ml-0.5",
              compact ? "size-2.5" : "size-3",
            )}
          />
        )}
      </button>
    );
  };

  return (
    <div className={cn(compact ? "" : "space-y-2", className)}>
      {/* 标签区域（紧凑模式下包含前缀） */}
      <div
        className={cn(
          "flex flex-wrap items-center",
          compact ? "gap-1.5" : "gap-2",
        )}
      >
        {/* 紧凑模式：显示「用途标签」前缀（与标签同行） */}
        {compact && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-300 font-medium text-xs flex-shrink-0">
            用途标签
          </span>
        )}
        {isLoading ? (
          <div
            className={cn(
              "flex items-center gap-2 text-gray-500",
              compact ? "text-xs" : "text-sm",
            )}
          >
            <Loader2
              className={
                compact ? "size-3 animate-spin" : "size-4 animate-spin"
              }
            />
            <span>加载中...</span>
          </div>
        ) : (
          <>
            {/* 预设标签 */}
            {USAGE_TAG_PRESETS.map((preset) => {
              const unifiedTag = allUsageTags.find(
                (t) => t.value === preset.value,
              );
              return unifiedTag ? renderTagButton(unifiedTag) : null;
            })}

            {/* 分隔线（如果有自定义标签） */}
            {customTags.length > 0 && (
              <div
                className={cn(
                  "w-px bg-gray-200 dark:bg-gray-700 self-center mx-0.5",
                  compact ? "h-5" : "h-7",
                )}
              />
            )}

            {/* 自定义标签 */}
            {customTags.map((customTag) => {
              const unifiedTag = allUsageTags.find(
                (t) => t.value === customTag.value,
              );
              return unifiedTag ? renderTagButton(unifiedTag) : null;
            })}

            {/* 添加自定义标签按钮 */}
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full",
                "border border-dashed",
                "border-gray-300 dark:border-gray-600",
                "text-gray-500 dark:text-gray-400",
                "hover:border-gray-400 dark:hover:border-gray-500",
                "hover:text-gray-600 dark:hover:text-gray-300",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                "transition-colors duration-200",
                compact
                  ? "px-2 py-0.5 text-xs font-medium"
                  : "px-3 py-1.5 text-sm font-medium",
              )}
            >
              <Plus className={compact ? "size-3" : "size-3.5"} />
              <span>自定义</span>
            </button>
          </>
        )}
      </div>

      {/* 添加自定义标签弹窗 */}
      <AddCustomUsageTagDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        existingTags={customTags}
        onSuccess={handleCustomTagCreated}
      />
    </div>
  );
}
