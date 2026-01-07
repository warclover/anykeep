/**
 * 搜索结果分组视图组件
 *
 * 支持按平台、时间、内容类型等维度对搜索结果进行分组展示
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { useState, useMemo, useEffect, memo } from "react";
import {
  LayoutGrid,
  List,
  Layers,
  Globe,
  Calendar,
  FileType,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

export type GroupByOption = "none" | "platform" | "date" | "contentType";
export type ViewMode = "grid" | "list";

export interface SearchResultGroupViewProps {
  /** 搜索结果 */
  results: (Bookmark & { folders?: { name: string } | null })[];
  /** 分组方式 */
  groupBy: GroupByOption;
  /** 分组方式变更回调 */
  onGroupByChange: (groupBy: GroupByOption) => void;
  /** 视图模式 */
  viewMode: ViewMode;
  /** 视图模式变更回调 */
  onViewModeChange: (mode: ViewMode) => void;
  /** 渲染单个结果项 */
  renderItem: (
    bookmark: Bookmark & { folders?: { name: string } | null },
  ) => React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

interface GroupedResults {
  key: string;
  label: string;
  count: number;
  items: (Bookmark & { folders?: { name: string } | null })[];
}

// ============================================
// 常量配置
// ============================================

const GROUP_OPTIONS: {
  value: GroupByOption;
  label: string;
  icon: typeof Layers;
}[] = [
  { value: "none", label: "不分组", icon: LayoutGrid },
  { value: "platform", label: "按平台", icon: Globe },
  { value: "date", label: "按时间", icon: Calendar },
  { value: "contentType", label: "按类型", icon: FileType },
];

const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信公众号",
  bilibili: "B站",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  juejin: "掘金",
  csdn: "CSDN",
  github: "GitHub",
  twitter: "Twitter",
  browser: "浏览器书签",
  unknown: "其他",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: "文章",
  video: "视频",
  image: "图片",
  audio: "音频",
  document: "文档",
  code: "代码",
  unknown: "其他",
};

// ============================================
// 辅助函数
// ============================================

/**
 * 获取日期分组标签
 */
function getDateGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor(
    (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays <= 7) return "本周";
  if (diffDays <= 30) return "本月";
  if (diffDays <= 90) return "近三月";
  if (diffDays <= 365) return "今年";
  return "更早";
}

/**
 * 获取日期分组排序权重（越小越靠前）
 */
function getDateGroupWeight(label: string): number {
  const weights: Record<string, number> = {
    今天: 0,
    昨天: 1,
    本周: 2,
    本月: 3,
    近三月: 4,
    今年: 5,
    更早: 6,
  };
  return weights[label] ?? 999;
}

// ============================================
// 子组件
// ============================================

/**
 * 分组头部组件
 */
interface GroupHeaderProps {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

const GroupHeader = memo(function GroupHeader({
  label,
  count,
  expanded,
  onToggle,
}: GroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-3 px-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
    >
      {expanded ? (
        <ChevronDown className="size-4 text-gray-400" />
      ) : (
        <ChevronRight className="size-4 text-gray-400" />
      )}
      <span className="font-medium text-gray-900 dark:text-white">{label}</span>
      <Badge variant="secondary" className="ml-auto">
        {count}
      </Badge>
    </button>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 搜索结果分组视图
 */
export const SearchResultGroupView = memo(function SearchResultGroupView({
  results,
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
  renderItem,
  className,
}: SearchResultGroupViewProps) {
  // 跟踪每个分组的展开状态
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["all"]),
  );

  /**
   * 切换分组展开状态
   */
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /**
   * 对结果进行分组
   */
  const groupedResults = useMemo((): GroupedResults[] => {
    if (groupBy === "none") {
      return [
        {
          key: "all",
          label: "全部结果",
          count: results.length,
          items: results,
        },
      ];
    }

    const groups = new Map<
      string,
      (Bookmark & { folders?: { name: string } | null })[]
    >();

    results.forEach((item) => {
      let groupKey: string;

      switch (groupBy) {
        case "platform":
          groupKey = item.platform?.toLowerCase() || "unknown";
          break;
        case "date":
          // 使用固定日期作为回退，避免 Date.now() 的不纯性
          groupKey = getDateGroupLabel(
            new Date(item.created_at || "1970-01-01"),
          );
          break;
        case "contentType":
          groupKey = item.ai_content_type?.toLowerCase() || "unknown";
          break;
        default:
          groupKey = "unknown";
      }

      const existing = groups.get(groupKey) || [];
      existing.push(item);
      groups.set(groupKey, existing);
    });

    // 转换为数组并排序
    const groupArray: GroupedResults[] = Array.from(groups.entries()).map(
      ([key, items]) => {
        let label: string;
        switch (groupBy) {
          case "platform":
            label = PLATFORM_LABELS[key] || key;
            break;
          case "contentType":
            label = CONTENT_TYPE_LABELS[key] || key;
            break;
          case "date":
            label = key;
            break;
          default:
            label = key;
        }
        return { key, label, count: items.length, items };
      },
    );

    // 按不同规则排序
    if (groupBy === "date") {
      groupArray.sort(
        (a, b) => getDateGroupWeight(a.label) - getDateGroupWeight(b.label),
      );
    } else {
      // 按数量降序排序
      groupArray.sort((a, b) => b.count - a.count);
    }

    return groupArray;
  }, [results, groupBy]);

  // 当分组方式变化时，默认展开所有分组
  useEffect(() => {
    if (groupBy !== "none") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 需要在分组变化时同步展开状态
      setExpandedGroups(new Set(groupedResults.map((g) => g.key)));
    } else {
      setExpandedGroups(new Set(["all"]));
    }
  }, [groupBy, groupedResults]);

  const selectedGroupOption =
    GROUP_OPTIONS.find((o) => o.value === groupBy) || GROUP_OPTIONS[0];

  return (
    <div className={className}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        {/* 分组选择 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Layers className="size-3.5" />
              <span>{selectedGroupOption.label}</span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {GROUP_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onGroupByChange(option.value)}
                  className={cn(
                    groupBy === option.value &&
                      "bg-purple-50 dark:bg-purple-900/30",
                  )}
                >
                  <Icon className="mr-2 size-4" />
                  {option.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 视图模式切换 */}
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onViewModeChange("grid")}
            title="网格视图"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onViewModeChange("list")}
            title="列表视图"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* 分组内容 */}
      <div className="space-y-4">
        {groupedResults.map((group) => (
          <div key={group.key}>
            {/* 分组头部（仅在分组模式下显示） */}
            {groupBy !== "none" && (
              <GroupHeader
                label={group.label}
                count={group.count}
                expanded={expandedGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
              />
            )}

            {/* 分组内容 */}
            {expandedGroups.has(group.key) && (
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-2",
                  groupBy !== "none" && "pl-6",
                )}
              >
                {group.items.map((item) => renderItem(item))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

export default SearchResultGroupView;
