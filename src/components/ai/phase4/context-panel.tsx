"use client";
/**
 * Phase 4: ContextPanel - 上下文面板组件
 * @version 1.0.0
 * @description 显示 AI 对话中引用的上下文（书签、文件夹、标签、搜索结果、前次输出）
 */
import * as React from "react";
import {
  Bookmark,
  FolderOpen,
  Tag,
  Search,
  MessageSquare,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  User,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  ContextPanelProps,
  ContextItem,
  ContextItemType,
  ContextItemData,
  BookmarkContextData,
} from "./types";
// =============================================================================
// 常量配置
// =============================================================================
/**
 * 上下文类型配置
 */
const CONTEXT_TYPE_CONFIG: Record<
  ContextItemType,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  bookmark: {
    icon: Bookmark,
    label: "书签",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  folder: {
    icon: FolderOpen,
    label: "文件夹",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  tag: {
    icon: Tag,
    label: "标签",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  search_results: {
    icon: Search,
    label: "搜索结果",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  previous_output: {
    icon: MessageSquare,
    label: "上轮回答",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
  },
};
// =============================================================================
// 工具函数
// =============================================================================
/**
 * 获取上下文项的显示标题
 */
function getItemTitle(data: ContextItemData): string {
  switch (data.type) {
    case "bookmark":
      return data.title;
    case "folder":
      return data.name;
    case "tag":
      return `#${data.name}`;
    case "search_results":
      return `搜索: ${data.query}`;
    case "previous_output":
      return data.preview;
    default:
      return "未知项目";
  }
}
/**
 * 获取上下文项的副标题
 */
function getItemSubtitle(data: ContextItemData): string | null {
  switch (data.type) {
    case "bookmark":
      return data.url || null;
    case "folder":
      return `${data.bookmarkCount} 个书签`;
    case "tag":
      return data.bookmarkCount ? `${data.bookmarkCount} 个书签` : null;
    case "search_results":
      return `${data.results.length} 个结果`;
    case "previous_output":
      return null;
    default:
      return null;
  }
}
/**
 * 格式化相对时间
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}
// =============================================================================
// 上下文面板组件
// =============================================================================
export function ContextPanel({
  items,
  onRemove,
  onClear,
  onAddMore,
  expanded = true,
  onExpandedChange,
}: ContextPanelProps) {
  const hasItems = items.length > 0;
  // 按类型分组统计
  const typeCounts = React.useMemo(() => {
    const counts = new Map<ContextItemType, number>();
    for (const item of items) {
      counts.set(item.type, (counts.get(item.type) || 0) + 1);
    }
    return counts;
  }, [items]);
  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <div className="rounded-lg border bg-card">
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 -ml-2 text-sm font-medium"
            >
              <span>上下文引用</span>
              {hasItems && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {items.length}
                </Badge>
              )}
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          {hasItems && (
            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onAddMore}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>添加更多引用</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={onClear}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>清除所有引用</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
        {/* 内容 */}
        <CollapsibleContent>
          {hasItems ? (
            <div className="p-2">
              {/* 类型分组标签 */}
              <div className="flex flex-wrap gap-1 mb-2">
                {Array.from(typeCounts.entries()).map(([type, count]) => {
                  const config = CONTEXT_TYPE_CONFIG[type];
                  const Icon = config.icon;
                  return (
                    <Badge
                      key={type}
                      variant="outline"
                      className={cn("gap-1 text-xs", config.color)}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label} ({count})
                    </Badge>
                  );
                })}
              </div>
              {/* 上下文项列表 */}
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {items.map((item) => (
                    <ContextItemCard
                      key={item.id}
                      item={item}
                      onRemove={() => onRemove(item.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <EmptyState onAddMore={onAddMore} />
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
// =============================================================================
// 上下文项卡片组件
// =============================================================================
interface ContextItemCardProps {
  item: ContextItem;
  onRemove: () => void;
}
function ContextItemCard({ item, onRemove }: ContextItemCardProps) {
  const config = CONTEXT_TYPE_CONFIG[item.type];
  const Icon = config.icon;
  const title = getItemTitle(item.data);
  const subtitle = getItemSubtitle(item.data);
  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-md p-2 transition-colors",
        "hover:bg-muted/50",
      )}
    >
      {/* 图标 */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          config.bgColor,
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={title}>
          {title}
        </p>
        {subtitle && (
          <p
            className="text-xs text-muted-foreground truncate"
            title={subtitle}
          >
            {subtitle}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {item.addedBy === "user" ? (
            <User className="h-3 w-3" />
          ) : (
            <Bot className="h-3 w-3" />
          )}
          <span>{item.addedBy === "user" ? "手动添加" : "AI 引用"}</span>
          <Clock className="h-3 w-3 ml-1" />
          <span>{formatRelativeTime(item.addedAt)}</span>
        </div>
      </div>
      {/* 操作按钮 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* 书签类型显示外链按钮 */}
        {item.data.type === "bookmark" &&
          (item.data as BookmarkContextData).url && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      window.open(
                        (item.data as BookmarkContextData).url,
                        "_blank",
                      )
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>打开链接</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>移除引用</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
// =============================================================================
// 空状态组件
// =============================================================================
interface EmptyStateProps {
  onAddMore: () => void;
}
function EmptyState({ onAddMore }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-1">暂无上下文引用</p>
      <p className="text-xs text-muted-foreground mb-3">
        添加书签或文件夹让 AI 更准确地理解您的需求
      </p>
      <Button variant="outline" size="sm" onClick={onAddMore}>
        <Plus className="mr-1 h-4 w-4" />
        添加引用
      </Button>
    </div>
  );
}
// =============================================================================
// 紧凑版上下文指示器（用于输入框上方）
// =============================================================================
interface ContextIndicatorProps {
  items: ContextItem[];
  onExpand: () => void;
  onClear: () => void;
}
export function ContextIndicator({
  items,
  onExpand,
  onClear,
}: ContextIndicatorProps) {
  if (items.length === 0) return null;
  // 取前 3 个显示
  const displayItems = items.slice(0, 3);
  const remainingCount = items.length - 3;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-t-lg border-b">
      <span className="text-xs text-muted-foreground">引用:</span>
      <div className="flex items-center gap-1 flex-1 overflow-hidden">
        {displayItems.map((item) => {
          const config = CONTEXT_TYPE_CONFIG[item.type];
          const Icon = config.icon;
          const title = getItemTitle(item.data);
          return (
            <Badge
              key={item.id}
              variant="secondary"
              className="gap-1 text-xs max-w-[120px] truncate"
            >
              <Icon className={cn("h-3 w-3 shrink-0", config.color)} />
              <span className="truncate">{title}</span>
            </Badge>
          );
        })}
        {remainingCount > 0 && (
          <Badge
            variant="outline"
            className="text-xs cursor-pointer hover:bg-muted"
            onClick={onExpand}
          >
            +{remainingCount}
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-muted-foreground hover:text-foreground"
        onClick={onClear}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
// =============================================================================
// 上下文选择器（用于添加上下文的对话框）
// =============================================================================
interface ContextSelectorProps {
  onSelect: (type: ContextItemType, id: string) => void;
  className?: string;
}
export function ContextSelector({ onSelect, className }: ContextSelectorProps) {
  const contextTypes: ContextItemType[] = [
    "bookmark",
    "folder",
    "tag",
    "search_results",
    "previous_output",
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {contextTypes.map((type) => {
        const config = CONTEXT_TYPE_CONFIG[type];
        const Icon = config.icon;
        return (
          <Button
            key={type}
            variant="outline"
            className="h-auto py-3 flex-col gap-1"
            onClick={() => onSelect(type, "")}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                config.bgColor,
              )}
            >
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>
            <span className="text-sm">{config.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
// =============================================================================
// Hook: 上下文管理
// =============================================================================
export function useContextItems() {
  const [items, setItems] = React.useState<ContextItem[]>([]);
  const [expanded, setExpanded] = React.useState(true);
  // 添加上下文项
  const addItem = React.useCallback(
    (
      type: ContextItemType,
      data: ContextItemData,
      addedBy: "user" | "ai" = "user",
    ) => {
      const newItem: ContextItem = {
        id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type,
        data,
        addedAt: new Date(),
        addedBy,
      };
      setItems((prev) => [...prev, newItem]);
      return newItem.id;
    },
    [],
  );
  // 移除上下文项
  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);
  // 清除所有上下文项
  const clearItems = React.useCallback(() => {
    setItems([]);
  }, []);
  // 获取用于 API 请求的上下文引用
  const getContextReferences = React.useCallback(() => {
    const bookmarkIds: number[] = [];
    const folderIds: number[] = [];
    let previousOutputId: string | undefined;
    for (const item of items) {
      if (item.data.type === "bookmark") {
        bookmarkIds.push(item.data.id);
      } else if (item.data.type === "folder") {
        folderIds.push(item.data.id);
      } else if (item.data.type === "previous_output") {
        previousOutputId = item.data.messageId;
      }
    }
    return {
      bookmarkIds: bookmarkIds.length > 0 ? bookmarkIds : undefined,
      folderIds: folderIds.length > 0 ? folderIds : undefined,
      previousOutputId,
    };
  }, [items]);
  return {
    items,
    expanded,
    setExpanded,
    addItem,
    removeItem,
    clearItems,
    getContextReferences,
    hasItems: items.length > 0,
  };
}
// =============================================================================
// 导出
// =============================================================================
export default ContextPanel;
