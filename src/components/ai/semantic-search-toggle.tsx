/**
 * 语义搜索开关组件
 *
 * 在关键词搜索和语义搜索之间切换
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { Brain, Search, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  /** 紧凑模式 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量配置
// ============================================

const MODE_INFO = {
  keyword: {
    label: "关键词",
    description: "精确匹配标题和内容中的关键词",
    icon: Search,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  semantic: {
    label: "语义",
    description: "理解搜索意图，找到语义��关的内容",
    icon: Brain,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  hybrid: {
    label: "智能混合",
    description: "结合关键词精确匹配与语义理解，获得最佳搜索结果",
    icon: Sparkles,
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    recommended: true,
  },
};

// ============================================
// 组件
// ============================================

/**
 * 语义搜索开关组件（三态选择器）
 * 支持：关键词 / 智能混合（推荐） / 语义 三种模式
 */
export function SemanticSearchToggle({
  mode,
  onModeChange,
  disabled = false,
  compact = false,
  className,
}: SemanticSearchToggleProps) {
  const currentModeInfo = MODE_INFO[mode] ?? MODE_INFO.hybrid;
  const isHybridMode = mode === "hybrid";
  const isSemanticMode = mode === "semantic";

  // 紧凑模式：使用三态切换按钮组
  if (compact) {
    return (
      <SearchModeToggleGroup
        mode={mode}
        onModeChange={onModeChange}
        disabled={disabled}
        className={className}
      />
    );
  }

  // 完整模式：三态选择器卡片
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div
          className={cn(
            "flex items-center justify-center size-10 rounded-full transition-colors",
            currentModeInfo.bgColor,
          )}
        >
          <currentModeInfo.icon
            className={cn("size-5", currentModeInfo.color)}
          />
        </div>

        {/* 标签和描述 */}
        <div>
          <div className="flex items-center gap-2">
            <Label htmlFor="search-mode" className="font-medium">
              {currentModeInfo.label}搜索
            </Label>
            {isHybridMode && (
              <Badge
                variant="secondary"
                className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                <Sparkles className="size-3 mr-1" />
                推荐
              </Badge>
            )}
            {isSemanticMode && (
              <Badge
                variant="secondary"
                className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                <Brain className="size-3 mr-1" />
                AI 增强
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentModeInfo.description}
          </p>
        </div>
      </div>

      {/* 三态切换按钮组 + 帮助信息 */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <Info className="size-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="left" className="w-80">
            <div className="space-y-3">
              <h4 className="font-medium">搜索模式说明</h4>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center size-6 rounded bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 mt-0.5">
                    <Search className="size-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">关键词搜索</p>
                    <p className="text-xs text-muted-foreground">
                      精确匹配文字内容，适合查找特定词汇
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center size-6 rounded bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 mt-0.5">
                    <Sparkles className="size-3 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      智能混合
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        推荐
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      结合关键词精确匹配与语义理解，获得最佳搜索结果
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center size-6 rounded bg-purple-100 dark:bg-purple-900/30 flex-shrink-0 mt-0.5">
                    <Brain className="size-3 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">语义搜索</p>
                    <p className="text-xs text-muted-foreground">
                      理解搜索意图，找到含义相近的内容，即使没有完全匹配的词
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-2">
                语义和混合搜索使用 AI 向量技术，可能需要更长的响应时间
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* 三态切换按钮 */}
        <div className="flex rounded-md border p-0.5 bg-muted/30">
          <Button
            variant={mode === "keyword" ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange("keyword")}
            disabled={disabled}
            className="h-7 px-2"
          >
            <Search className="size-3.5" />
          </Button>
          <Button
            variant={mode === "hybrid" ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange("hybrid")}
            disabled={disabled}
            className={cn(
              "h-7 px-2",
              mode === "hybrid" && "bg-amber-600 hover:bg-amber-700 text-white",
            )}
          >
            <Sparkles className="size-3.5" />
          </Button>
          <Button
            variant={mode === "semantic" ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange("semantic")}
            disabled={disabled}
            className={cn(
              "h-7 px-2",
              mode === "semantic" &&
                "bg-purple-600 hover:bg-purple-700 text-white",
            )}
          >
            <Brain className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 搜索模式切换按钮组（三态选择器）
 */
export function SearchModeToggleGroup({
  mode,
  onModeChange,
  disabled = false,
  className,
}: SemanticSearchToggleProps) {
  return (
    <div className={cn("flex rounded-lg border p-1 bg-muted/30", className)}>
      <Button
        variant={mode === "keyword" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("keyword")}
        disabled={disabled}
        className="flex-1 h-8 gap-1.5"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">关键词</span>
      </Button>
      <Button
        variant={mode === "hybrid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("hybrid")}
        disabled={disabled}
        className={cn(
          "flex-1 h-8 gap-1.5",
          mode === "hybrid" && "bg-amber-600 hover:bg-amber-700 text-white",
        )}
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">智能混合</span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1 py-0 hidden md:inline-flex"
        >
          推荐
        </Badge>
      </Button>
      <Button
        variant={mode === "semantic" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("semantic")}
        disabled={disabled}
        className={cn(
          "flex-1 h-8 gap-1.5",
          mode === "semantic" && "bg-purple-600 hover:bg-purple-700 text-white",
        )}
      >
        <Brain className="size-4" />
        <span className="hidden sm:inline">语义</span>
      </Button>
    </div>
  );
}

export default SemanticSearchToggle;
