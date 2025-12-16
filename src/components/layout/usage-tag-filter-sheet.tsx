/**
 * 用途标签筛选 Sheet 组件
 * 用于首页顶部的用途标签筛选（右侧滑窗形式）
 * V10.3: 即时生效模式 - 点击标签立即应用筛选（带防抖）
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { USAGE_TAG_PRESETS, getAllUsageTags } from "@/lib/constants/usage-tags";
import { useSafeNavigation } from "@/contexts/navigation-context";
import { useCustomUsageTags } from "@/hooks/use-custom-usage-tags";
import { UsageTagButton } from "@/components/bookmark/usage-tag-button";
import { SmartListQuickSave } from "@/components/smart-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// 防抖延迟时间（毫秒）
const DEBOUNCE_DELAY = 300;

interface UsageTagFilterSheetProps {
  /** 自定义类名 */
  className?: string;
  /** 筛选变化回调 */
  onFilterChange?: (selectedTags: string[]) => void;
}

export function UsageTagFilterSheet({
  className,
  onFilterChange,
}: UsageTagFilterSheetProps) {
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

  // 使用本地状态管理选中标签
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  // Sheet 开关状态
  const [isOpen, setIsOpen] = useState(false);
  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 同步 URL 变化到本地状态（处理浏览器前进/后退）
  useEffect(() => {
    setSelectedTags(initialTags);
  }, [initialTags]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

  // 生成按钮显示文本（必须在早期返回之前调用）
  const buttonText = useMemo(() => {
    if (selectedTags.length === 0) {
      return "用途筛选";
    }
    // 显示第一个标签名称
    const firstTag = allUsageTags.find((t) => t.value === selectedTags[0]);
    if (selectedTags.length === 1) {
      return firstTag?.label || "用途筛选";
    }
    return `${firstTag?.label || "用途筛选"} +${selectedTags.length - 1}`;
  }, [selectedTags, allUsageTags]);

  /**
   * 应用筛选到 URL 和触发事件（防抖处理）
   */
  const applyFilterDebounced = useCallback(
    (tags: string[]) => {
      // 清除之前的定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 设置新的防抖定时器
      debounceTimerRef.current = setTimeout(() => {
        // 更新 URL
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

        // 触发回调
        onFilterChange?.(tags);

        // 触发自定义事件通知首页
        window.dispatchEvent(
          new CustomEvent("usageTagFilterChange", {
            detail: { usageTags: tags },
          }),
        );
      }, DEBOUNCE_DELAY);
    },
    [searchParams, onFilterChange],
  );

  /**
   * 切换标签选中状态（即时生效）
   */
  const toggleTag = useCallback(
    (tagValue: string) => {
      const newTags = selectedTags.includes(tagValue)
        ? selectedTags.filter((t) => t !== tagValue)
        : [...selectedTags, tagValue];

      // 立即更新 UI
      setSelectedTags(newTags);

      // 防抖应用筛选
      applyFilterDebounced(newTags);
    },
    [selectedTags, applyFilterDebounced],
  );

  /**
   * 保存为智能列表后清除筛选
   */
  const handleSaved = useCallback(() => {
    setSelectedTags([]);

    // 清除防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 立即更新 URL
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

    // 触发自定义事件通知首页
    window.dispatchEvent(
      new CustomEvent("usageTagFilterChange", {
        detail: { usageTags: [] },
      }),
    );

    setIsOpen(false);
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
    <div className={cn("flex items-center", className)}>
      {/* 筛选触发按钮 */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <Button
          variant="default"
          size="default"
          onClick={() => setIsOpen(true)}
          className={cn(
            "h-12 px-4 gap-2 shrink-0",
            selectedTags.length > 0
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white",
          )}
        >
          <Filter className="size-4" />
          <span>{buttonText}</span>
          {selectedTags.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-white/25 rounded-full font-semibold">
              {selectedTags.length}
            </span>
          )}
        </Button>

        <SheetContent
          side="right"
          className="w-[340px] sm:w-[400px] flex flex-col"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg">用途筛选</SheetTitle>
            <SheetDescription>点击标签即可筛选，再次点击取消</SheetDescription>
          </SheetHeader>

          {/* 已选标签预览 */}
          {selectedTags.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg mx-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                已选择 {selectedTags.length} 个标签
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tagValue) => {
                  const tag = allUsageTags.find((t) => t.value === tagValue);
                  if (!tag) return null;
                  return (
                    <span
                      key={tagValue}
                      className={cn(
                        "px-2 py-1 text-xs rounded-full cursor-pointer transition-opacity hover:opacity-80",
                        tag.style.bgLight,
                        tag.style.bgDark,
                        tag.style.textLight,
                        tag.style.textDark,
                      )}
                      onClick={() => toggleTag(tagValue)}
                    >
                      {tag.label} ×
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 标签选择区域 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* 预设标签 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    预设标签
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
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      自定义标签
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

          {/* 底部：保存为智能列表 */}
          {selectedTags.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <SmartListQuickSave
                filters={{ usageTags: selectedTags }}
                visible={true}
                onSaved={handleSaved}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
