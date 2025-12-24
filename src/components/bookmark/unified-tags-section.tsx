/**
 * 统一标签区组件
 * 将 AI 标签和用途标签整合到同一行显示
 *
 * 特性：
 * - AI 标签：只读显示，默认显示前 N 个，支持展开
 * - 用途标签：保持原有交互形式（显示全部预设+自定义标签）
 * - 响应式：AI 标签桌面端显示 3 个，移动端显示 2 个
 * - 统一样式：保持视觉一致性
 *
 * @version 1.1.0
 * @since 2025-12-21
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
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { USAGE_TAG_PRESETS, getAllUsageTags } from "@/lib/constants/usage-tags";
import type { CustomUsageTag, Platform } from "@/types/supabase";
import { AddCustomUsageTagDialog } from "./add-custom-usage-tag-dialog";
import { useCustomUsageTags } from "@/hooks/use-custom-usage-tags";
import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";
import { clientLogger } from "@/lib/client-logger";

// 图标名称到组件的映射
const ICON_MAP: Record<string, LucideIcon> = {
  Share2,
  RefreshCcw,
  Award,
  Eye,
};

// AI 标签响应式断点配置
const AI_VISIBLE_COUNT = {
  desktop: 3,
  mobile: 2,
};

interface UnifiedTagsSectionProps {
  /** AI 生成的标签（只读） */
  aiTags: string[];
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL（自动快照需要） */
  bookmarkUrl?: string;
  /** 书签平台 */
  platform?: Platform;
  /** 是否已有快照 */
  hasSnapshot?: boolean;
  /** 当前已选中的用途标签值列表 */
  selectedUsageTags: string[];
  /** 当前的普通标签（非用途标签，需要保留） */
  regularTags: string[];
  /** 保存成功后的回调 */
  onSaveSuccess?: (newUsageTags: string[]) => void;
  /** 自定义类名 */
  className?: string;
}

export function UnifiedTagsSection({
  aiTags,
  bookmarkId,
  bookmarkUrl = "",
  platform,
  hasSnapshot = false,
  selectedUsageTags: initialSelectedTags,
  regularTags,
  onSaveSuccess,
  className,
}: UnifiedTagsSectionProps) {
  // ==================== AI 标签状态 ====================
  const [aiExpanded, setAiExpanded] = useState(false);

  // ==================== 用途标签状态 ====================
  const [localSelectedTags, setLocalSelectedTags] =
    useState<string[]>(initialSelectedTags);
  const [savingTags, setSavingTags] = useState<Set<string>>(new Set());
  const [recentlyToggled, setRecentlyToggled] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const originalTagsRef = useRef<string[]>(initialSelectedTags);

  // 响应式检测（仅用于 AI 标签折叠）
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const aiVisibleCount = isMobile
    ? AI_VISIBLE_COUNT.mobile
    : AI_VISIBLE_COUNT.desktop;

  // 自动快照 Hook
  const { checkAndTriggerSnapshot } = useAutoSnapshot({
    bookmarkId,
    bookmarkUrl,
    platform,
    hasSnapshot,
  });

  // 自定义标签 Hook
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

  // 计算显示的 AI 标签
  const { visibleAiTags, hiddenAiCount } = useMemo(() => {
    if (aiExpanded || aiTags.length <= aiVisibleCount) {
      return { visibleAiTags: aiTags, hiddenAiCount: 0 };
    }
    return {
      visibleAiTags: aiTags.slice(0, aiVisibleCount),
      hiddenAiCount: aiTags.length - aiVisibleCount,
    };
  }, [aiTags, aiExpanded, aiVisibleCount]);

  // ==================== 用途标签操作 ====================

  const saveToServer = useCallback(
    async (newUsageTags: string[]): Promise<boolean> => {
      try {
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

  const updateLastUsedAt = useCallback(
    async (tagValue: string) => {
      const customTag = customTags.find((t) => t.value === tagValue);
      if (!customTag) return;
      const now = new Date().toISOString();
      updateTag(customTag.id, { lastUsedAt: now });
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

  const toggleTag = useCallback(
    async (tagValue: string) => {
      if (savingTags.has(tagValue)) return;

      const isSelected = localSelectedTags.includes(tagValue);
      const newTags = isSelected
        ? localSelectedTags.filter((t) => t !== tagValue)
        : [...localSelectedTags, tagValue];

      setLocalSelectedTags(newTags);
      setSavingTags((prev) => new Set(prev).add(tagValue));
      setRecentlyToggled(tagValue);
      setTimeout(() => setRecentlyToggled(null), 300);

      const success = await saveToServer(newTags);

      setSavingTags((prev) => {
        const next = new Set(prev);
        next.delete(tagValue);
        return next;
      });

      if (success) {
        const prevTags = originalTagsRef.current;
        originalTagsRef.current = newTags;
        if (!isSelected) {
          updateLastUsedAt(tagValue);
        }
        onSaveSuccess?.(newTags);
        checkAndTriggerSnapshot(prevTags, newTags);
      } else {
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

  const handleCustomTagCreated = useCallback(
    async (newTag: CustomUsageTag, allTags: CustomUsageTag[]) => {
      setTags(allTags);
      setShowAddDialog(false);

      const prevTags = localSelectedTags;
      const newTags = [...localSelectedTags, newTag.value];
      setLocalSelectedTags(newTags);

      const success = await saveToServer(newTags);
      if (success) {
        originalTagsRef.current = newTags;
        onSaveSuccess?.(newTags);
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

  // ==================== 渲染函数 ====================

  /**
   * 渲染 AI 标签（只读）
   */
  const renderAiTag = (tag: string) => (
    <span
      key={tag}
      className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs"
    >
      {tag}
    </span>
  );

  /**
   * 渲染用途标签（可交互）
   */
  const renderUsageTagButton = (tagValue: string) => {
    const tag = allUsageTags.find((t) => t.value === tagValue);
    if (!tag) return null;

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
          "relative inline-flex items-center rounded-full",
          "border transition-all duration-200",
          "gap-1 px-2 py-0.5 text-xs font-medium",
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
                "bg-white dark:bg-gray-900",
                "border-dashed border-gray-300 dark:border-gray-600",
                "text-gray-500 dark:text-gray-400",
                "hover:border-gray-400 dark:hover:border-gray-500",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
              ],
          isRecentlyToggled && isSelected && "animate-pulse scale-105",
          isRecentlyToggled && !isSelected && "animate-pulse",
          isSaving && "opacity-70 cursor-wait",
        )}
      >
        {tag.icon &&
          ICON_MAP[tag.icon] &&
          (() => {
            const IconComponent = ICON_MAP[tag.icon];
            return <IconComponent className="size-3" />;
          })()}
        <span>{tag.label}</span>
        {isSelected &&
          (isSaving ? (
            <Loader2 className="size-2.5 animate-spin ml-0.5" />
          ) : (
            <X className="size-2.5 ml-0.5 opacity-60" />
          ))}
        {!isSelected && isSaving && (
          <Loader2 className="size-2.5 animate-spin ml-0.5" />
        )}
      </button>
    );
  };

  // 判断是否有内容需要显示
  const hasAiTags = aiTags.length > 0;
  const hasUsageTags = localSelectedTags.length > 0 || !isLoading;

  if (!hasAiTags && !hasUsageTags) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {/* ==================== AI 标签区域 ==================== */}
      {hasAiTags && (
        <>
          {/* AI 标签前缀 */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-300 font-medium text-xs flex-shrink-0">
            AI
          </span>

          {/* AI 标签列表 */}
          {visibleAiTags.map(renderAiTag)}

          {/* AI 标签折叠/展开按钮 */}
          {hiddenAiCount > 0 && (
            <button
              type="button"
              onClick={() => setAiExpanded(true)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              +{hiddenAiCount}
              <ChevronDown className="size-3" />
            </button>
          )}
          {aiExpanded && aiTags.length > aiVisibleCount && (
            <button
              type="button"
              onClick={() => setAiExpanded(false)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              收起
              <ChevronUp className="size-3" />
            </button>
          )}

          {/* 分隔符 */}
          {hasUsageTags && (
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 flex-shrink-0" />
          )}
        </>
      )}

      {/* ==================== 用途标签区域 ==================== */}
      {hasUsageTags && (
        <>
          {/* 用途标签前缀 */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-300 font-medium text-xs flex-shrink-0">
            用途
          </span>

          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <Loader2 className="size-3 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : (
            <>
              {/* 预设标签 */}
              {USAGE_TAG_PRESETS.map((preset) => {
                const unifiedTag = allUsageTags.find(
                  (t) => t.value === preset.value,
                );
                return unifiedTag
                  ? renderUsageTagButton(unifiedTag.value)
                  : null;
              })}

              {/* 分隔线（如果有自定义标签） */}
              {customTags.length > 0 && (
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 flex-shrink-0" />
              )}

              {/* 自定义标签 */}
              {customTags.map((customTag) => {
                const unifiedTag = allUsageTags.find(
                  (t) => t.value === customTag.value,
                );
                return unifiedTag
                  ? renderUsageTagButton(unifiedTag.value)
                  : null;
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
                  "px-2 py-0.5 text-xs font-medium",
                )}
              >
                <Plus className="size-3" />
                <span>自定义</span>
              </button>
            </>
          )}
        </>
      )}

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
