/**
 * 用途标签筛选组件
 * 用于首页顶部的用途标签快捷筛选
 * 支持预设标签 + 自定义标签
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { USAGE_TAG_PRESETS, getAllUsageTags } from "@/lib/constants/usage-tags";
import { useSafeNavigation } from "@/contexts/navigation-context";
import { useCustomUsageTags } from "@/hooks/use-custom-usage-tags";
import { UsageTagButton } from "@/components/bookmark/usage-tag-button";

interface UsageTagFilterProps {
  /** 自定义类名 */
  className?: string;
  /** 筛选变化回调 */
  onFilterChange?: (selectedTags: string[]) => void;
}

export function UsageTagFilter({
  className,
  onFilterChange,
}: UsageTagFilterProps) {
  const searchParams = useSearchParams();

  // 获取导航上下文
  const navigationContext = useSafeNavigation();
  const { activePage, isClientNavEnabled } = navigationContext || {
    activePage: null,
    isClientNavEnabled: false,
  };

  // 使用统一的自定义标签 Hook（共享缓存，避免重复请求）
  const { customTags: customUsageTags, isLoading } = useCustomUsageTags();

  // 从 URL 派生选中状态（单一数据源，避免 state 同步问题）
  const urlUsageTags = searchParams.get("usageTags") || "";
  const selectedTags = useMemo(() => {
    return urlUsageTags ? urlUsageTags.split(",").filter(Boolean) : [];
  }, [urlUsageTags]);

  // 是否展开筛选区（UI 状态，需要独立管理）
  const [isExpanded, setIsExpanded] = useState(selectedTags.length > 0);

  // 判断当前页面
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const isHomePage = isClientNavEnabled
    ? activePage === "home"
    : pathname === "/home";

  // 获取所有可用的用途标签
  const allUsageTags = useMemo(() => {
    return getAllUsageTags(customUsageTags);
  }, [customUsageTags]);

  /**
   * 切换标签选中状态
   */
  const toggleTag = useCallback(
    (tagValue: string) => {
      const newSelected = selectedTags.includes(tagValue)
        ? selectedTags.filter((t) => t !== tagValue)
        : [...selectedTags, tagValue];

      // 更新 URL（selectedTags 会自动从 URL 派生）
      const params = new URLSearchParams(searchParams.toString());
      if (newSelected.length > 0) {
        params.set("usageTags", newSelected.join(","));
      } else {
        params.delete("usageTags");
      }
      const newUrl = `/home?${params.toString()}`;
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        "",
        newUrl,
      );

      // 触发回调
      onFilterChange?.(newSelected);

      // 触发自定义事件通知首页
      window.dispatchEvent(
        new CustomEvent("usageTagFilterChange", {
          detail: { usageTags: newSelected },
        }),
      );
    },
    [selectedTags, searchParams, onFilterChange],
  );

  /**
   * 清除所有筛选
   */
  const clearFilter = useCallback(() => {
    // 更新 URL（selectedTags 会自动从 URL 派生）
    const params = new URLSearchParams(searchParams.toString());
    params.delete("usageTags");
    const newUrl = `/home?${params.toString()}`;
    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl,
    );

    // 触发回调
    onFilterChange?.([]);

    // 触发自定义事件通知首页
    window.dispatchEvent(
      new CustomEvent("usageTagFilterChange", {
        detail: { usageTags: [] },
      }),
    );
  }, [searchParams, onFilterChange]);

  // 非首页不显示
  if (!isHomePage) {
    return null;
  }

  // 没有用途标签时不显示
  if (allUsageTags.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* 筛选触发器行 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors",
            "border",
            selectedTags.length > 0
              ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
              : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
          )}
        >
          <Filter className="size-3" />
          <span>用途</span>
          {selectedTags.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-blue-500 text-white rounded-full">
              {selectedTags.length}
            </span>
          )}
        </button>

        {/* 已选中的标签快速展示 */}
        {selectedTags.length > 0 && !isExpanded && (
          <>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {selectedTags.slice(0, 2).map((tagValue) => {
                const tag = allUsageTags.find((t) => t.value === tagValue);
                if (!tag) return null;
                return (
                  <span
                    key={tagValue}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-full",
                      tag.style.bgLight,
                      tag.style.bgDark,
                      tag.style.textLight,
                      tag.style.textDark,
                    )}
                  >
                    {tag.label}
                  </span>
                );
              })}
              {selectedTags.length > 2 && (
                <span className="text-xs text-gray-500">
                  +{selectedTags.length - 2}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={clearFilter}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="清除筛选"
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {/* 展开的筛选区域 */}
      {isExpanded && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : (
            <>
              {/* 预设标签 */}
              {USAGE_TAG_PRESETS.map((preset) => {
                const tag = allUsageTags.find((t) => t.value === preset.value);
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

              {/* 分隔线（如果有自定义标签） */}
              {customUsageTags.length > 0 && (
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 self-center mx-1" />
              )}

              {/* 自定义标签 */}
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

              {/* 清除按钮 */}
              {selectedTags.length > 0 && (
                <>
                  <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 self-center mx-1" />
                  <button
                    type="button"
                    onClick={clearFilter}
                    className="px-2.5 py-1 text-xs font-medium rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    清除
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
