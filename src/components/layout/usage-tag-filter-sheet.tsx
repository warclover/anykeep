/**
 * V5.0: 用途标签筛选 SideSheet 组件
 *
 * 基于统一的 SideSheet 设计系统重构
 * - 使用新的 SideSheet 组件
 * - 优化视觉设计和动效
 * - 保持原有功能不变
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { USAGE_TAG_PRESETS, getAllUsageTags } from "@/lib/constants/usage-tags";
import { useSafeNavigation } from "@/contexts/navigation-context";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { useCustomUsageTags } from "@/hooks/data";
import { UsageTagButton } from "@/components/bookmark/usage-tag-button";
import { SmartListQuickSave } from "@/components/smart-list";
import { Button } from "@/components/ui/button";
import { SideSheet, SideSheetSection } from "@/components/ui/side-sheet";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

// ============================================================================
// 常量
// ============================================================================

/** 防抖延迟时间（毫秒）*/
const DEBOUNCE_DELAY = 300;

/** 组件文案 */
const TEXT = {
  TRIGGER_DEFAULT: "用途筛选",
  SHEET_TITLE: "用途筛选",
  SHEET_DESCRIPTION: "点击标签即可筛选，再次点击取消",
  SELECTED_COUNT: (count: number) => `已选择 ${count} 个标签`,
  PRESET_TAGS: "预设标签",
  CUSTOM_TAGS: "自定义标签",
  CLEAR_ALL: "清除",
  SAVE_SMART_LIST: "保存为智能列表",
};

// ============================================================================
// 类型
// ============================================================================

interface UsageTagFilterSheetProps {
  /** 自定义类名 */
  className?: string;
  /** 筛选变化回调 */
  onFilterChange?: (selectedTags: string[]) => void;
}

// ============================================================================
// 组件
// ============================================================================

export function UsageTagFilterSheet({
  className,
  onFilterChange,
}: UsageTagFilterSheetProps) {
  const searchParams = useSearchParams();

  // Phase 3.3: 尝试获取 HomePageContext（安全版本，不抛错）
  const homeContext = useHomePageSafe();

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

  // Hydration 修复：确保组件只在客户端渲染
  const [isMounted, setIsMounted] = useState(false);
  const [isHomePage, setIsHomePage] = useState(false);

  // 客户端挂载检测
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 判断是否为首页
  useEffect(() => {
    if (!isMounted) return;

    // 客户端确定是否为首页
    const pathname = window.location.pathname;
    const homePageCheck = isClientNavEnabled
      ? activePage === "home"
      : pathname === "/home";
    setIsHomePage(homePageCheck);
  }, [isMounted, isClientNavEnabled, activePage]);

  // 获取所有可用的用途标签
  const allUsageTags = useMemo(() => {
    return getAllUsageTags(customUsageTags);
  }, [customUsageTags]);

  // 生成按钮显示文本（必须在早期返回之前调用）
  const buttonText = useMemo(() => {
    if (selectedTags.length === 0) {
      return TEXT.TRIGGER_DEFAULT;
    }
    // 显示第一个标签名称
    const firstTag = allUsageTags.find((t) => t.value === selectedTags[0]);
    if (selectedTags.length === 1) {
      return firstTag?.label || TEXT.TRIGGER_DEFAULT;
    }
    return `${firstTag?.label || TEXT.TRIGGER_DEFAULT} +${selectedTags.length - 1}`;
  }, [selectedTags, allUsageTags]);

  /**
   * 应用筛选（防抖处理）
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const applyFilterDebounced = useCallback(
    (tags: string[]) => {
      // 清除之前的定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 设置新的防抖定时器
      debounceTimerRef.current = setTimeout(() => {
        if (homeContext) {
          // Phase 3.3: 使用 Context
          homeContext.filter.setUsageTags(tags);
        } else {
          // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
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

          // 触发事件通知首页
          uiEventBus.emit(UIEvents.USAGE_TAGS_CHANGE, { usageTags: tags });
        }

        // 触发回调
        onFilterChange?.(tags);
      }, DEBOUNCE_DELAY);
    },
    [homeContext, searchParams, onFilterChange],
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
   * 清除所有选中标签
   */
  const clearAllTags = useCallback(() => {
    setSelectedTags([]);

    // 清除防抖定时器
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

    onFilterChange?.([]);
  }, [homeContext, searchParams, onFilterChange]);

  /**
   * 保存为智能列表后清除筛选
   */
  const handleSaved = useCallback(() => {
    clearAllTags();
    setIsOpen(false);
  }, [clearAllTags]);

  // SSR 阶段不渲染（避免 Hydration 错误）
  if (!isMounted) {
    return null;
  }

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
      {/* 筛选触发按钮 - 糖果色风格（紫色） */}
      <Button
        variant="default"
        size="default"
        onClick={() => setIsOpen(true)}
        className={cn(
          "h-8 px-3 gap-1.5 shrink-0 text-sm",
          "transition-all duration-200",
          selectedTags.length > 0
            ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-200 hover:shadow-violet-300 hover:scale-105"
            : "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-200 hover:shadow-purple-300 hover:scale-105",
        )}
      >
        <Filter className="size-3.5" />
        <span>{buttonText}</span>
        {selectedTags.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-white/25 rounded-full font-semibold">
            {selectedTags.length}
          </span>
        )}
      </Button>

      {/* SideSheet 弹窗 */}
      <SideSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        size="md"
        title={TEXT.SHEET_TITLE}
        description={TEXT.SHEET_DESCRIPTION}
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
        {/* 已选标签预览区 */}
        {selectedTags.length > 0 && (
          <SideSheetSection index={0}>
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
          </SideSheetSection>
        )}

        {/* 标签选择区域 */}
        {isLoading ? (
          <SideSheetSection index={1}>
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">加载中...</span>
              </div>
            </div>
          </SideSheetSection>
        ) : (
          <>
            {/* 预设标签 */}
            <SideSheetSection index={selectedTags.length > 0 ? 1 : 0}>
              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 px-1">
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
            </SideSheetSection>

            {/* 自定义标签 */}
            {customUsageTags.length > 0 && (
              <SideSheetSection index={selectedTags.length > 0 ? 2 : 1}>
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 px-1">
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
              </SideSheetSection>
            )}
          </>
        )}
      </SideSheet>
    </div>
  );
}
