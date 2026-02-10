/**
 * 用途标签筛选组件
 * 用于首页顶部的用途标签快捷筛选
 * 支持预设标签 + 自定义标签
 * V10.1: 支持快速保存为智能列表
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { USAGE_TAG_PRESETS, getAllUsageTags } from "@/lib/constants/usage-tags";
import { useSafeNavigation } from "@/contexts/navigation-context";
import { useCustomUsageTags } from "@/hooks/data";
import { UsageTagButton } from "@/components/bookmark/usage-tag-button";
import { SmartListQuickSave } from "@/components/smart-list";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

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
  const urlUsageTags = searchParams?.get("usageTags") || "";
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
  // ⚠️ 不要在渲染路径直接读取 window.location.pathname（SSR="" vs CSR=实际路径 → hydration 不匹配）
  // 使用 useEffect 延迟读取，确保 SSR/CSR 初始值一致
  const [pathname, setPathname] = useState("");
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);
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
      const params = new URLSearchParams(searchParams?.toString() ?? "");
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

      // 触发事件通知首页
      uiEventBus.emit(UIEvents.USAGE_TAGS_CHANGE, { usageTags: newSelected });
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
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("usageTags");
    const newUrl = `/home?${params.toString()}`;
    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl,
    );

    // 触发回调
    onFilterChange?.([]);

    // 触发事件通知首页
    uiEventBus.emit(UIEvents.USAGE_TAGS_CHANGE, { usageTags: [] });
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
      {/* 用途按钮 - 深色实心风格（与添加收藏按钮一致） */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          // 尺寸与 Button size="default" 一致：h-9 px-4 py-2 rounded-md
          "h-9 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors shrink-0",
          // 深色实心风格
          "bg-gray-900 text-white hover:bg-gray-800",
          "dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100",
        )}
      >
        <Filter className="size-4" />
        <span>用途</span>
        {selectedTags.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-white/25 dark:bg-gray-900/25 text-white dark:text-gray-900 rounded-full font-semibold">
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

              {/* 操作按钮组：清除 + 保存为智能列表 */}
              {selectedTags.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {/* 快速保存为智能列表 */}
                  <SmartListQuickSave
                    filters={{ usageTags: selectedTags }}
                    visible={true}
                    onSaved={clearFilter}
                  />
                  {/* 清除按钮 */}
                  <button
                    type="button"
                    onClick={clearFilter}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="清除筛选"
                  >
                    <X className="size-4" />
                  </button>
                </div>
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
          {/* 操作按钮组 */}
          <div className="flex items-center gap-1 shrink-0">
            <SmartListQuickSave
              filters={{ usageTags: selectedTags }}
              visible={true}
              onSaved={clearFilter}
            />
            <button
              type="button"
              onClick={clearFilter}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="清除筛选"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
