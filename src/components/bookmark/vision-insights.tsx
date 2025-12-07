/**
 * 视觉洞察展示组件
 *
 * 展示 Qwen-VL 视觉分析的结果
 * 包括图片描述、OCR 文字、视觉标签等
 *
 * 这是一个独立的插件组件，可单独引入或移除
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

"use client";

import { useState } from "react";
import {
  Eye,
  Image as ImageIcon,
  Type,
  Tag,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Monitor,
  Palette,
  Camera,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  BookmarkVisionData,
  ImageAnalysisData,
  ImageType,
} from "@/types/vision";
import {
  isVisionAnalysisComplete,
  getAllVisualTags,
  getAllOcrText,
} from "@/types/vision";

// ============================================
// 类型定义
// ============================================

interface VisionInsightsProps {
  /** 视觉分析数据 */
  data: BookmarkVisionData | null;
  /** 自定义样式类 */
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 是否显示标题 */
  showHeader?: boolean;
}

interface VisionAnalysisTriggerProps {
  /** 是否正在分析 */
  isAnalyzing: boolean;
  /** 点击回调 */
  onAnalyze: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式类 */
  className?: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取图片类型的图标和标签
 */
function getImageTypeInfo(type: ImageType): {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
} {
  switch (type) {
    case "chart":
      return {
        icon: <BarChart3 className="size-4" />,
        label: "图表",
        colorClass: "text-blue-500",
      };
    case "screenshot":
      return {
        icon: <Monitor className="size-4" />,
        label: "截图",
        colorClass: "text-emerald-500",
      };
    case "design":
      return {
        icon: <Palette className="size-4" />,
        label: "设计",
        colorClass: "text-purple-500",
      };
    case "photo":
      return {
        icon: <Camera className="size-4" />,
        label: "照片",
        colorClass: "text-amber-500",
      };
    default:
      return {
        icon: <HelpCircle className="size-4" />,
        label: "未知",
        colorClass: "text-slate-400",
      };
  }
}

// ============================================
// 子组件
// ============================================

/**
 * 单张图片分析结果
 */
function ImageAnalysisCard({
  data,
  index,
}: {
  data: ImageAnalysisData;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const typeInfo = getImageTypeInfo(data.result.imageType);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
      {/* 图片预览和类型标识 */}
      <div className="flex items-center gap-3 p-3 bg-muted/50">
        <div className="relative size-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.url}
            alt={`分析图片 ${index + 1}`}
            className="size-full object-cover"
            onError={(e) => {
              // 图片加载失败时显示占位符
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn("flex items-center gap-1", typeInfo.colorClass)}
            >
              {typeInfo.icon}
              <span className="text-sm font-medium">{typeInfo.label}</span>
            </span>
            {data.durationMs && (
              <span className="text-xs text-muted-foreground">
                {(data.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {data.result.description.substring(0, 50)}...
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>
      </div>

      {/* 详细信息 */}
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-border/50">
          {/* 描述 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Eye className="size-3.5 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                内容描述
              </span>
            </div>
            <p className="text-sm leading-relaxed">{data.result.description}</p>
          </div>

          {/* OCR 文字 */}
          {data.result.ocrText && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Type className="size-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  提取文字
                </span>
              </div>
              <div className="bg-muted/50 rounded-md p-2.5">
                <p className="text-sm whitespace-pre-wrap font-mono">
                  {data.result.ocrText}
                </p>
              </div>
            </div>
          )}

          {/* 视觉标签 */}
          {data.result.visualTags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Tag className="size-3.5 text-purple-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  视觉标签
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.result.visualTags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * 视觉洞察展示组件
 *
 * @example
 * ```tsx
 * <VisionInsights data={bookmark.ai_vision_data} />
 * ```
 */
export function VisionInsights({
  data,
  className,
  defaultExpanded = true,
  showHeader = true,
}: VisionInsightsProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  // 检查是否有有效数据
  if (!data || !isVisionAnalysisComplete(data)) {
    return null;
  }

  const allTags = getAllVisualTags(data);
  const hasOcr = !!getAllOcrText(data);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      {showHeader && (
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <Sparkles className="size-4 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium">视觉洞察</h3>
                <p className="text-xs text-muted-foreground">
                  {data.images.length} 张图片
                  {hasOcr && " · 含文字提取"}
                  {allTags.length > 0 && ` · ${allTags.length} 个标签`}
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
      )}

      <CollapsibleContent className="space-y-3 pt-2">
        {/* 汇总标签（如果有多张图片） */}
        {data.images.length > 1 && allTags.length > 0 && (
          <div className="px-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Tag className="size-3.5 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">
                全部视觉标签
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 图片分析卡片 */}
        <div className="space-y-2 px-3">
          {data.images.map((img, index) => (
            <ImageAnalysisCard key={img.url} data={img} index={index} />
          ))}
        </div>

        {/* 元信息 */}
        <div className="px-3 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              分析于{" "}
              {new Date(data.analyzedAt).toLocaleString("zh-CN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {data.usage && (
              <span>Token: {data.usage.totalTokens.toLocaleString()}</span>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// 触发按钮组件
// ============================================

/**
 * 视觉分析触发按钮
 *
 * @example
 * ```tsx
 * <VisionAnalysisTrigger
 *   isAnalyzing={isLoading}
 *   onAnalyze={() => analyze(bookmarkId)}
 * />
 * ```
 */
export function VisionAnalysisTrigger({
  isAnalyzing,
  onAnalyze,
  disabled = false,
  className,
}: VisionAnalysisTriggerProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onAnalyze}
      disabled={disabled || isAnalyzing}
      className={cn("gap-2", className)}
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>分析中...</span>
        </>
      ) : (
        <>
          <ImageIcon className="size-4" />
          <span>视觉分析</span>
        </>
      )}
    </Button>
  );
}

// ============================================
// 空状态组件
// ============================================

/**
 * 视觉分析空状态提示
 */
export function VisionEmptyState({
  onAnalyze,
  isAnalyzing = false,
  className,
}: {
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center",
        className,
      )}
    >
      <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Eye className="size-6 text-muted-foreground" />
      </div>
      <h4 className="text-sm font-medium mb-1">暂无视觉分析</h4>
      <p className="text-xs text-muted-foreground mb-4">
        使用 AI 分析图片内容，提取文字和视觉特征
      </p>
      {onAnalyze && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>分析中...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              <span>开始分析</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export default VisionInsights;
