/**
 * 搜索模式切换组件
 *
 * 简化为两态开关：普通搜索 / AI 搜索
 * - 普通搜索 → keyword 模式（精确匹配）
 * - AI 搜索 → hybrid 模式（关键词 + 语义融合，最佳效果）
 *
 * SearchMode 类型保持三态（keyword/semantic/hybrid）以兼容 API 层，
 * 但 UI 层只暴露两个选项，降低用户认知负担。
 *
 * @version 2.0.0 - 三态简化为两态
 * @since 2025-12-22
 */

"use client";

import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface SemanticSearchToggleProps {
  /** 当前搜索模式 */
  mode: SearchMode;
  /** 模式变更回调 */
  onModeChange: (mode: SearchMode) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 紧凑模式（忽略，统一使用紧凑布局） */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 内部工具
// ============================================

/** UI 层是否为 AI 模式（hybrid 或 semantic 都视为 AI 开启） */
const isAIMode = (mode: SearchMode): boolean =>
  mode === "hybrid" || mode === "semantic";

// ============================================
// 组件
// ============================================

/**
 * 搜索模式切换组件（两态开关）
 *
 * 普通搜索 ⇄ AI 搜索
 * AI 搜索开启时内部使用 hybrid 模式（最佳效果）
 */
export function SemanticSearchToggle({
  mode,
  onModeChange,
  disabled = false,
  className,
}: SemanticSearchToggleProps) {
  const aiEnabled = isAIMode(mode);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border bg-card",
        className,
      )}
    >
      {/* 左侧：图标 + 文案 */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center size-9 rounded-full transition-colors",
            aiEnabled
              ? "bg-purple-100 dark:bg-purple-900/30"
              : "bg-gray-100 dark:bg-gray-800",
          )}
        >
          {aiEnabled ? (
            <Sparkles className="size-4.5 text-purple-600 dark:text-purple-400" />
          ) : (
            <Search className="size-4.5 text-gray-500 dark:text-gray-400" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium">
            {aiEnabled ? "AI 搜索" : "普通搜索"}
          </p>
          <p className="text-xs text-muted-foreground">
            {aiEnabled
              ? "理解搜索意图，智能匹配相关内容"
              : "精确匹配标题和内容中的关键词"}
          </p>
        </div>
      </div>

      {/* 右侧：两态切换按钮组 */}
      <div className="flex rounded-md border p-0.5 bg-muted/30">
        <Button
          variant={!aiEnabled ? "default" : "ghost"}
          size="sm"
          onClick={() => onModeChange("keyword")}
          disabled={disabled}
          className="h-7 px-2.5 gap-1.5 text-xs"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">普通</span>
        </Button>
        <Button
          variant={aiEnabled ? "default" : "ghost"}
          size="sm"
          onClick={() => onModeChange("hybrid")}
          disabled={disabled}
          className={cn(
            "h-7 px-2.5 gap-1.5 text-xs",
            aiEnabled && "bg-purple-600 hover:bg-purple-700 text-white",
          )}
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">AI</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * 搜索模式切换按钮组（紧凑版，两态）
 */
export function SearchModeToggleGroup({
  mode,
  onModeChange,
  disabled = false,
  className,
}: SemanticSearchToggleProps) {
  const aiEnabled = isAIMode(mode);

  return (
    <div className={cn("flex rounded-lg border p-1 bg-muted/30", className)}>
      <Button
        variant={!aiEnabled ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("keyword")}
        disabled={disabled}
        className="flex-1 h-8 gap-1.5"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">普通搜索</span>
      </Button>
      <Button
        variant={aiEnabled ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("hybrid")}
        disabled={disabled}
        className={cn(
          "flex-1 h-8 gap-1.5",
          aiEnabled && "bg-purple-600 hover:bg-purple-700 text-white",
        )}
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">AI 搜索</span>
      </Button>
    </div>
  );
}

/**
 * 搜索模式内嵌切换（嵌入搜索框右侧的紧凑版）
 *
 * 只显示两个按钮，无描述文案，适合放在 Input 内部
 */
export function InlineSearchModeToggle({
  mode,
  onModeChange,
  disabled = false,
  className,
}: SemanticSearchToggleProps) {
  const aiEnabled = isAIMode(mode);

  return (
    <div className={cn("flex rounded-md border p-0.5 bg-muted/30", className)}>
      <Button
        variant={!aiEnabled ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("keyword")}
        disabled={disabled}
        className="h-7 px-2 gap-1 text-xs"
        type="button"
      >
        <Search className="size-3.5" />
        <span>普通</span>
      </Button>
      <Button
        variant={aiEnabled ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("hybrid")}
        disabled={disabled}
        className={cn(
          "h-7 px-2 gap-1 text-xs",
          aiEnabled && "bg-purple-600 hover:bg-purple-700 text-white",
        )}
        type="button"
      >
        <Sparkles className="size-3.5" />
        <span>AI</span>
      </Button>
    </div>
  );
}

export default SemanticSearchToggle;
