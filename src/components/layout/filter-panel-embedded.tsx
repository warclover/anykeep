/**
 * 用途筛选嵌入式面板
 *
 * 基于 EmbeddedSidePanel 的用途标签筛选面板
 * 复用 UsageTagFilterSheet 的核心逻辑，但使用挤压式布局
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { X, Trash2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { USAGE_TAG_PRESETS, getAllUsageTags } from "@/lib/constants/usage-tags";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { useCustomUsageTags } from "@/hooks/data";
import { UsageTagButton } from "@/components/bookmark/usage-tag-button";
import { SmartListQuickSave } from "@/components/smart-list";
import { Button } from "@/components/ui/button";
import { EmbeddedSidePanel } from "@/components/ui/embedded-side-panel";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

// ============================================================================
// 常量
// ============================================================================

/** 防抖延迟时间（毫秒）*/
const DEBOUNCE_DELAY = 300;

/** 组件文案 */
const TEXT = {
  PANEL_TITLE: "用途筛选",
  SELECTED_COUNT: (count: number) => `已选择 ${count} 个标签`,
  PRESET_TAGS: "预设标签",
  CUSTOM_TAGS: "自定义标签",
  CLEAR_ALL: "清除",
  DESCRIPTION: "点击标签即可筛选，再次点击取消",
};

// ============================================================================
// 组件
// ============================================================================

interface FilterPanelEmbeddedProps {
  /** 是否展开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

export function FilterPanelEmbedded({
  open,
  onClose,
}: FilterPanelEmbeddedProps) {
  const searchParams = useSearchParams();
  const homeContext = useHomePageSafe();
  const { customTags: customUsageTags, isLoading } = useCustomUsageTags();

  // 从 URL 获取初始值
  const urlUsageTags = searchParams?.get("usageTags") || "";
  const initialTags = useMemo(() => {
    return urlUsageTags ? urlUsageTags.split(",").filter(Boolean) : [];
  }, [urlUsageTags]);

  // 本地状态
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 同步 URL 变化
  useEffect(() => {
    setSelectedTags(initialTags);
  }, [initialTags]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 获取所有可用的用途标签
  const allUsageTags = useMemo(() => {
    return getAllUsageTags(customUsageTags);
  }, [customUsageTags]);

  /**
   * 应用筛选（防抖处理）
   */
  const applyFilterDebounced = useCallback(
    (tags: string[]) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (homeContext) {
          homeContext.filter.setUsageTags(tags);
        } else {
          const params = new URLSearchParams(searchParams?.toString() ?? "");
          if (tags.length > 0) {
            params.set("usageTags", tags.join(","));
          } else {
            params.delete("usageTags");
          }
          const newUrl = `/home?${params.toString()}`;
          window.history.replaceState(
            { ...window.history.state, as: newUrl, url: newUrl },
            "",
            newUrl,
          );
          uiEventBus.emit(UIEvents.USAGE_TAGS_CHANGE, { usageTags: tags });
        }
      }, DEBOUNCE_DELAY);
    },
    [homeContext, searchParams],
  );

  /**
   * 切换标签选中状态
   */
  const toggleTag = useCallback(
    (tagValue: string) => {
      const newTags = selectedTags.includes(tagValue)
        ? selectedTags.filter((t) => t !== tagValue)
        : [...selectedTags, tagValue];

      setSelectedTags(newTags);
      applyFilterDebounced(newTags);
    },
    [selectedTags, applyFilterDebounced],
  );

  /**
   * 清除所有选中标签
   */
  const clearAllTags = useCallback(() => {
    setSelectedTags([]);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (homeContext) {
      homeContext.filter.setUsageTags([]);
    } else {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("usageTags");
      const newUrl = `/home?${params.toString()}`;
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        "",
        newUrl,
      );
      uiEventBus.emit(UIEvents.USAGE_TAGS_CHANGE, { usageTags: [] });
    }
  }, [homeContext, searchParams]);

  /**
   * 保存为智能列表后清除筛选
   */
  const handleSaved = useCallback(() => {
    clearAllTags();
    onClose();
  }, [clearAllTags, onClose]);

  return (
    <EmbeddedSidePanel
      open={open}
      onClose={onClose}
      title={TEXT.PANEL_TITLE}
      titleIcon={
        <div className="size-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
          <Filter className="size-4 text-white" />
        </div>
      }
      width={360}
      headerClassName="bg-gradient-to-r from-purple-50 via-violet-50 to-white dark:from-purple-950/30 dark:via-violet-950/20 dark:to-gray-900 border-purple-100 dark:border-purple-900/30"
      titleClassName="text-purple-700 dark:text-purple-300"
      closeButtonClassName="text-purple-400 hover:text-purple-600 hover:bg-purple-100/50 dark:hover:bg-purple-900/30"
      headerAction={
        selectedTags.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllTags}
            className="h-8 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="size-4 mr-1" />
            {TEXT.CLEAR_ALL}
          </Button>
        ) : undefined
      }
      footer={
        selectedTags.length > 0 ? (
          <SmartListQuickSave
            filters={{ usageTags: selectedTags }}
            visible={true}
            onSaved={handleSaved}
          />
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* 描述 */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {TEXT.DESCRIPTION}
        </p>

        {/* 已选标签预览区 */}
        {selectedTags.length > 0 && (
          <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3 font-medium">
              {TEXT.SELECTED_COUNT(selectedTags.length)}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tagValue) => {
                const tag = allUsageTags.find((t) => t.value === tagValue);
                if (!tag) return null;
                return (
                  <button
                    key={tagValue}
                    type="button"
                    onClick={() => toggleTag(tagValue)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
                      "transition-all duration-150",
                      "hover:scale-105 active:scale-95",
                      tag.style.bgLight,
                      tag.style.bgDark,
                      tag.style.textLight,
                      tag.style.textDark,
                    )}
                  >
                    {tag.label}
                    <X className="size-3.5 opacity-60 hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 标签选择区域 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        ) : (
          <>
            {/* 预设标签 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {TEXT.PRESET_TAGS}
              </h4>
              <div className="flex flex-wrap gap-2">
                {USAGE_TAG_PRESETS.map((preset) => {
                  const tag = allUsageTags.find(
                    (t) => t.value === preset.value,
                  );
                  return tag ? (
                    <UsageTagButton
                      key={tag.value}
                      tag={tag}
                      isSelected={selectedTags.includes(tag.value)}
                      size="sm"
                      onClick={() => toggleTag(tag.value)}
                    />
                  ) : null;
                })}
              </div>
            </div>

            {/* 自定义标签 */}
            {customUsageTags.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {TEXT.CUSTOM_TAGS}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {customUsageTags.map((customTag) => {
                    const tag = allUsageTags.find(
                      (t) => t.value === customTag.value,
                    );
                    return tag ? (
                      <UsageTagButton
                        key={tag.value}
                        tag={tag}
                        isSelected={selectedTags.includes(tag.value)}
                        size="sm"
                        onClick={() => toggleTag(tag.value)}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </EmbeddedSidePanel>
  );
}

export default FilterPanelEmbedded;
