/**
 * 用途标签选择器组件
 * 提供预设和自定义用途标签的快捷选择
 * 支持点击添加/移除标签
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  USAGE_TAG_PRESETS,
  getAllUsageTags,
  getUsageTagStyleExtended,
  type UnifiedUsageTag,
} from "@/lib/constants/usage-tags";
import type { CustomUsageTag } from "@/types/supabase";
import { AddCustomUsageTagDialog } from "./add-custom-usage-tag-dialog";

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
  customUsageTags = [],
  onCustomTagsChange,
  disabled = false,
  showAddButton = true,
  maxSelection = 0,
  className,
}: UsageTagSelectorProps) {
  // 添加自定义标签弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false);
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  // 内部自定义标签状态（如果没有外部传入）
  const [internalCustomTags, setInternalCustomTags] =
    useState<CustomUsageTag[]>(customUsageTags);

  // 同步外部传入的自定义标签
  useEffect(() => {
    setInternalCustomTags(customUsageTags);
  }, [customUsageTags]);

  // 获取所有可用的用途标签（预设 + 自定义）
  const allUsageTags = useMemo(() => {
    return getAllUsageTags(internalCustomTags);
  }, [internalCustomTags]);

  // 加载用户的自定义标签（如果没有外部传入）
  const loadCustomTags = useCallback(async () => {
    if (customUsageTags.length > 0) return; // 已有外部传入，不需要加载

    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/usage-tags");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.customUsageTags) {
          setInternalCustomTags(data.data.customUsageTags);
        }
      }
    } catch (error) {
      console.error("Failed to load custom usage tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, [customUsageTags.length]);

  // 组件挂载时加载自定义标签
  useEffect(() => {
    loadCustomTags();
  }, [loadCustomTags]);

  /**
   * 更新自定义标签的最后使用时间
   */
  const updateLastUsedAt = useCallback(
    async (tagValue: string) => {
      // 检查是否是自定义标签
      const customTag = internalCustomTags.find((t) => t.value === tagValue);
      if (!customTag) return;

      try {
        await fetch("/api/settings/usage-tags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customTag.id,
            lastUsedAt: new Date().toISOString(),
          }),
        });
      } catch (error) {
        // 静默失败，不影响用户体验
        console.error("Failed to update lastUsedAt:", error);
      }
    },
    [internalCustomTags],
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
      setInternalCustomTags(allTags);
      onCustomTagsChange?.(allTags);

      // 自动选中新创建的标签
      if (maxSelection === 0 || selectedTags.length < maxSelection) {
        onSelectedTagsChange([...selectedTags, newTag.value]);
      }

      setShowAddDialog(false);
    },
    [selectedTags, onSelectedTagsChange, onCustomTagsChange, maxSelection],
  );

  /**
   * 渲染单个标签按钮
   */
  const renderTagButton = (tag: UnifiedUsageTag) => {
    const isSelected = selectedTags.includes(tag.value);
    const isDisabled =
      disabled ||
      (!isSelected && maxSelection > 0 && selectedTags.length >= maxSelection);

    return (
      <button
        key={tag.value}
        type="button"
        onClick={() => toggleTag(tag.value)}
        disabled={isDisabled}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
          "border flex items-center gap-1.5",
          "focus:outline-none focus:ring-2 focus:ring-offset-1",
          isSelected
            ? // 选中状态：使用标签颜色
              cn(
                tag.style.bgLight,
                tag.style.bgDark,
                tag.style.borderLight,
                tag.style.borderDark,
                tag.style.textLight,
                tag.style.textDark,
                "ring-offset-white dark:ring-offset-gray-900",
                `focus:ring-${tag.style.color}-400`,
              )
            : // 未选中状态：灰色边框
              cn(
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700",
                "text-gray-600 dark:text-gray-400",
                "hover:border-gray-300 dark:hover:border-gray-600",
                "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                "focus:ring-gray-400",
              ),
          isDisabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {tag.label}
        {isSelected && (
          <X className="size-3.5 opacity-60 hover:opacity-100 transition-opacity" />
        )}
      </button>
    );
  };

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
              return unifiedTag ? renderTagButton(unifiedTag) : null;
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
              return unifiedTag ? renderTagButton(unifiedTag) : null;
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
