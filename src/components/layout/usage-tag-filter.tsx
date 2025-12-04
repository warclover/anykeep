/**
 * 用途标签筛选组件
 * 用于首页顶部的用途标签快捷筛选
 * 支持预设标签 + 自定义标签
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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

  // 从 URL 获取初始值
  const urlUsageTags = searchParams.get("usageTags") || "";
  const initialTags = useMemo(() => {
    return urlUsageTags ? urlUsageTags.split(",").filter(Boolean) : [];
  }, [urlUsageTags]);

  // 使用本地状态管理选中标签（解决 replaceState 后 useSearchParams 不更新的问题）
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);

  // 同步 URL 变化到本地状态（处理浏览器前进/后退）
  useEffect(() => {
    setSelectedTags(initialTags);
  }, [initialTags]);

  // 是否展开筛选区（UI 状态）
  const [isExpanded, setIsExpanded] = useState(initialTags.length > 0);

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

      // 立即更新本地状态（确保 UI 响应）
      setSelectedTags(newSelected);

      // 更新 URL
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
    // 立即更新本地状态
    setSelectedTags([]);

    // 更新 URL
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
    <div className={cn("flex items-center gap-2", className)}>
      {/* 用途按钮 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors shrink-0",
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

      {/* 标签区域 */}
      {isExpanded ? (
        // 展开状态：显示所有标签
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-gray-400" />
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

              {/* 自定义标签 */}
              {customUsageTags.length > 0 && (
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 self-center mx-0.5" />
              )}
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
                <button
                  type="button"
                  onClick={clearFilter}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                  title="清除筛选"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      ) : selectedTags.length > 0 ? (
        // 收起状态 + 有选中：显示已选标签预览
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {selectedTags.slice(0, 3).map((tagValue) => {
            const tag = allUsageTags.find((t) => t.value === tagValue);
            if (!tag) return null;
            return (
              <span
                key={tagValue}
                className={cn(
                  "px-2 py-1 text-xs rounded-full shrink-0",
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
          {selectedTags.length > 3 && (
            <span className="text-xs text-gray-500 shrink-0">
              +{selectedTags.length - 3}
            </span>
          )}
          <button
            type="button"
            onClick={clearFilter}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            title="清除筛选"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
