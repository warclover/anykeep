/**
 * 用途标签选择器组件
 * 提供预设和自定义用途标签的快捷选择
 * 支持点击添加/移除标签
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  USAGE_TAG_PRESETS,
  getAllUsageTags,
  getUsageTagStyleExtended,
} from "@/lib/constants/usage-tags";
import type { CustomUsageTag } from "@/types/supabase";
import { AddCustomUsageTagDialog } from "./add-custom-usage-tag-dialog";
import { useCustomUsageTags } from "@/hooks/use-custom-usage-tags";
import { UsageTagButton } from "./usage-tag-button";

interface UsageTagSelectorProps {
  /** 已选中的用途标签值列表 */
  selectedTags: string[];
  /** 选中标签变化回调 */
  onSelectedTagsChange: (tags: string[]) => void;
  /** 自定义用途标签列表（从用户设置中获取） */
  customUsageTags?: CustomUsageTag[];
  /** 自定义标签变化回调（用于刷新） */
  onCustomTagsChange?: (tags: CustomUsageTag[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示添加自定义标签按钮 */
  showAddButton?: boolean;
  /** 最大可选数量（0表示无限制） */
  maxSelection?: number;
  /** 自定义类名 */
  className?: string;
}

export function UsageTagSelector({
  selectedTags,
  onSelectedTagsChange,
  customUsageTags: externalCustomTags,
  onCustomTagsChange,
  disabled = false,
  showAddButton = true,
  maxSelection = 0,
  className,
}: UsageTagSelectorProps) {
  // 添加自定义标签弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false);

  // 使用统一的自定义标签 Hook（共享缓存，避免重复请求）
  const {
    customTags: hookCustomTags,
    isLoading,
    setTags,
    updateTag,
  } = useCustomUsageTags();

  // 优先使用外部传入的标签，否则使用 Hook 的数据
  const hasExternalTags = externalCustomTags && externalCustomTags.length > 0;
  const internalCustomTags = hasExternalTags
    ? externalCustomTags
    : hookCustomTags;

  // 获取所有可用的用途标签（预设 + 自定义）
  const allUsageTags = useMemo(() => {
    return getAllUsageTags(internalCustomTags);
  }, [internalCustomTags]);

  /**
   * 更新自定义标签的最后使用时间
   */
  const updateLastUsedAt = useCallback(
    async (tagValue: string) => {
      // 检查是否是自定义标签
      const customTag = internalCustomTags.find((t) => t.value === tagValue);
      if (!customTag) return;

      const now = new Date().toISOString();

      // 乐观更新本地缓存
      updateTag(customTag.id, { lastUsedAt: now });

      // 异步同步到服务器
      try {
        await fetch("/api/settings/usage-tags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customTag.id,
            lastUsedAt: now,
          }),
        });
      } catch (error) {
        // 静默失败，不影响用户体验
        console.error("Failed to update lastUsedAt:", error);
      }
    },
    [internalCustomTags, updateTag],
  );

  /**
   * 切换标签选中状态
   */
  const toggleTag = useCallback(
    (tagValue: string) => {
      if (disabled) return;

      const isSelected = selectedTags.includes(tagValue);

      if (isSelected) {
        // 移除标签
        onSelectedTagsChange(selectedTags.filter((t) => t !== tagValue));
      } else {
        // 添加标签（检查最大数量限制）
        if (maxSelection > 0 && selectedTags.length >= maxSelection) {
          return;
        }
        onSelectedTagsChange([...selectedTags, tagValue]);

        // 更新最后使用时间（异步，不阻塞 UI）
        updateLastUsedAt(tagValue);
      }
    },
    [
      disabled,
      selectedTags,
      onSelectedTagsChange,
      maxSelection,
      updateLastUsedAt,
    ],
  );

  /**
   * 处理新建自定义标签成功
   */
  const handleCustomTagCreated = useCallback(
    (newTag: CustomUsageTag, allTags: CustomUsageTag[]) => {
      // 同步到 Hook 缓存（所有使用该 Hook 的组件都会更新）
      setTags(allTags);
      // 通知外部（如果有）
      onCustomTagsChange?.(allTags);

      // 自动选中新创建的标签
      if (maxSelection === 0 || selectedTags.length < maxSelection) {
        onSelectedTagsChange([...selectedTags, newTag.value]);
      }

      setShowAddDialog(false);
    },
    [
      selectedTags,
      onSelectedTagsChange,
      onCustomTagsChange,
      maxSelection,
      setTags,
    ],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* 标签选择区域 */}
      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" />
            <span>加载中...</span>
          </div>
        ) : (
          <>
            {/* 预设标签 */}
            {USAGE_TAG_PRESETS.map((preset) => {
              const unifiedTag = allUsageTags.find(
                (t) => t.value === preset.value,
              );
              if (!unifiedTag) return null;
              const isSelected = selectedTags.includes(unifiedTag.value);
              const isDisabled =
                disabled ||
                (!isSelected &&
                  maxSelection > 0 &&
                  selectedTags.length >= maxSelection);
              return (
                <UsageTagButton
                  key={unifiedTag.value}
                  tag={unifiedTag}
                  isSelected={isSelected}
                  disabled={isDisabled}
                  size="md"
                  showRemoveIcon
                  onClick={() => toggleTag(unifiedTag.value)}
                />
              );
            })}

            {/* 分隔线（如果有自定义标签） */}
            {internalCustomTags.length > 0 && (
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 self-center mx-1" />
            )}

            {/* 自定义标签 */}
            {internalCustomTags.map((customTag) => {
              const unifiedTag = allUsageTags.find(
                (t) => t.value === customTag.value,
              );
              if (!unifiedTag) return null;
              const isSelected = selectedTags.includes(unifiedTag.value);
              const isDisabled =
                disabled ||
                (!isSelected &&
                  maxSelection > 0 &&
                  selectedTags.length >= maxSelection);
              return (
                <UsageTagButton
                  key={unifiedTag.value}
                  tag={unifiedTag}
                  isSelected={isSelected}
                  disabled={isDisabled}
                  size="md"
                  showRemoveIcon
                  onClick={() => toggleTag(unifiedTag.value)}
                />
              );
            })}

            {/* 添加自定义标签按钮 */}
            {showAddButton && (
              <button
                type="button"
                onClick={() => setShowAddDialog(true)}
                disabled={disabled}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium",
                  "border border-dashed",
                  "border-gray-300 dark:border-gray-600",
                  "text-gray-500 dark:text-gray-400",
                  "hover:border-gray-400 dark:hover:border-gray-500",
                  "hover:text-gray-600 dark:hover:text-gray-300",
                  "hover:bg-gray-50 dark:hover:bg-gray-800",
                  "transition-colors duration-200",
                  "flex items-center gap-1",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <Plus className="size-3.5" />
                <span>自定义</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* 选中数量提示 */}
      {maxSelection > 0 && (
        <p className="text-xs text-gray-500">
          已选择 {selectedTags.length}/{maxSelection} 个用途标签
        </p>
      )}

      {/* 添加自定义标签弹窗 */}
      <AddCustomUsageTagDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        existingTags={internalCustomTags}
        onSuccess={handleCustomTagCreated}
      />
    </div>
  );
}

/**
 * 简化版用途标签展示组件（只展示，不可编辑）
 * 用于卡片、详情页等只读场景
 */
interface UsageTagDisplayProps {
  /** 用途标签值列表 */
  tags: string[];
  /** 自定义用途标签列表 */
  customUsageTags?: CustomUsageTag[];
  /** 最大显示数量 */
  maxDisplay?: number;
  /** 标签大小 */
  size?: "sm" | "md";
  /** 自定义类名 */
  className?: string;
}

export function UsageTagDisplay({
  tags,
  customUsageTags = [],
  maxDisplay = 0,
  size = "sm",
  className,
}: UsageTagDisplayProps) {
  if (tags.length === 0) return null;

  const displayTags = maxDisplay > 0 ? tags.slice(0, maxDisplay) : tags;
  const remainingCount = maxDisplay > 0 ? tags.length - maxDisplay : 0;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {displayTags.map((tagValue) => {
        const tagStyle = getUsageTagStyleExtended(tagValue, customUsageTags);

        if (!tagStyle) {
          // 不是用途标签，显示普通样式
          return (
            <span
              key={tagValue}
              className={cn(
                "inline-flex items-center rounded-full border",
                "bg-gray-50 dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700",
                "text-gray-600 dark:text-gray-400",
                size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
              )}
            >
              {tagValue}
            </span>
          );
        }

        return (
          <span
            key={tagValue}
            className={cn(
              "inline-flex items-center rounded-full border",
              tagStyle.style.bgLight,
              tagStyle.style.bgDark,
              tagStyle.style.borderLight,
              tagStyle.style.borderDark,
              tagStyle.style.textLight,
              tagStyle.style.textDark,
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
            )}
          >
            {tagStyle.label}
          </span>
        );
      })}

      {remainingCount > 0 && (
        <span
          className={cn(
            "inline-flex items-center rounded-full",
            "bg-gray-100 dark:bg-gray-800",
            "text-gray-500 dark:text-gray-400",
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
          )}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
