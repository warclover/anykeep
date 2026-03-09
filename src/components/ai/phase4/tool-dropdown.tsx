/**
 * Phase 4: 工具下拉菜单组件
 *
 * 参考 YouMind 设计：
 * - 主工具按钮带下拉箭头
 * - 点击展开子工具菜单
 * - 子工具显示图标和名称
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { memo, useState, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ToolType } from "./types";

// =============================================================================
// 工具分组定义
// =============================================================================

export interface SubTool {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
}

export interface ToolGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 子工具列表，为空则直接使用该工具 */
  subTools?: SubTool[];
  /** 直接工具 ID（无子工具时使用） */
  directToolId?: ToolType;
}

/**
 * 工具分组配置
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "auto",
    name: "Auto",
    icon: "✨",
    description: "AI 自动选择最佳工具",
    directToolId: "auto",
  },
  {
    id: "search-group",
    name: "搜索",
    icon: "🔍",
    description: "搜索和分析收藏内容",
    subTools: [
      {
        id: "search",
        name: "搜索内容",
        icon: "🔎",
        description: "在收藏中搜索相关内容",
      },
      {
        id: "stats",
        name: "统计分析",
        icon: "📊",
        description: "分析收藏数据和趋势",
      },
    ],
  },
  {
    id: "organize-group",
    name: "整理",
    icon: "📂",
    description: "整理和分类书签",
    subTools: [
      {
        id: "organize",
        name: "自动分类",
        icon: "🗂️",
        description: "智能分类到合适的文件夹",
      },
      {
        id: "tag",
        name: "智能标签",
        icon: "🏷️",
        description: "自动添加相关标签",
      },
      {
        id: "dedupe",
        name: "去重清理",
        icon: "🧹",
        description: "查找并清理重复书签",
      },
    ],
  },
  {
    id: "create-group",
    name: "创作",
    icon: "✍️",
    description: "生成内容和摘要",
    subTools: [
      {
        id: "summarize",
        name: "生成摘要",
        icon: "📝",
        description: "为内容生成简洁摘要",
      },
      {
        id: "extract",
        name: "萃取知识",
        icon: "💡",
        description: "提取关键知识点",
      },
    ],
  },
  {
    id: "export",
    name: "导出",
    icon: "📤",
    description: "导出数据到多种格式",
    directToolId: "export",
  },
];

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 根据 ToolType 找到对应的工具信息
 */
export function findToolInfo(toolId: ToolType): {
  group: ToolGroup;
  subTool?: SubTool;
} | null {
  for (const group of TOOL_GROUPS) {
    // 直接工具
    if (group.directToolId === toolId) {
      return { group };
    }
    // 子工具
    if (group.subTools) {
      const subTool = group.subTools.find((st) => st.id === toolId);
      if (subTool) {
        return { group, subTool };
      }
    }
  }
  return null;
}

/**
 * 获取工具显示名称
 */
export function getToolDisplayName(toolId: ToolType): string {
  const info = findToolInfo(toolId);
  if (!info) return toolId;
  return info.subTool?.name || info.group.name;
}

/**
 * 获取工具图标
 */
export function getToolIcon(toolId: ToolType): string {
  const info = findToolInfo(toolId);
  if (!info) return "🔧";
  return info.subTool?.icon || info.group.icon;
}

// =============================================================================
// 组件 Props
// =============================================================================

export interface ToolDropdownProps {
  value: ToolType;
  onChange: (tool: ToolType) => void;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 工具下拉菜单组件
 *
 * 特点：
 * - 主按钮显示当前选中工具
 * - 点击展开分组菜单
 * - 子菜单支持二级展开
 */
export const ToolDropdown = memo(function ToolDropdown({
  value,
  onChange,
  disabled = false,
  className,
}: ToolDropdownProps) {
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // 获取当前选中工具的显示信息
  const currentInfo = findToolInfo(value);
  const displayName =
    currentInfo?.subTool?.name || currentInfo?.group.name || "Auto";

  // 处理工具组点击
  const handleGroupClick = useCallback(
    (group: ToolGroup) => {
      if (group.directToolId) {
        // 直接工具，立即选中并关闭
        onChange(group.directToolId);
        setOpen(false);
        setExpandedGroup(null);
      } else if (group.subTools && group.subTools.length > 0) {
        // 有子工具，展开/收起
        setExpandedGroup((prev) => (prev === group.id ? null : group.id));
      }
    },
    [onChange],
  );

  // 处理子工具点击
  const handleSubToolClick = useCallback(
    (subTool: SubTool) => {
      onChange(subTool.id);
      setOpen(false);
      setExpandedGroup(null);
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl",
            "bg-gradient-to-r from-pink-50 to-rose-50",
            "border border-pink-200 hover:border-pink-300",
            "text-xs font-medium text-pink-600",
            "transition-all duration-200",
            "hover:shadow-sm hover:from-pink-100 hover:to-rose-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          <span>{displayName}</span>
          <ChevronDown
            className={cn(
              "size-4 text-pink-400 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        alignOffset={-60}
        className={cn(
          "w-48 p-1.5 rounded-xl",
          "bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl",
          "animate-in fade-in-0 zoom-in-95",
          "max-h-[280px] overflow-y-auto",
        )}
      >
        <div className="space-y-0.5">
          {TOOL_GROUPS.map((group) => {
            const isExpanded = expandedGroup === group.id;
            const hasSubTools = group.subTools && group.subTools.length > 0;
            const isSelected =
              group.directToolId === value ||
              group.subTools?.some((st) => st.id === value);

            return (
              <div key={group.id}>
                {/* 工具组按钮 - 紧凑版 */}
                <button
                  type="button"
                  onClick={() => handleGroupClick(group)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg",
                    "text-left transition-all duration-150",
                    isSelected
                      ? "bg-pink-50 text-pink-600"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <span className="text-base">{group.icon}</span>
                  <span className="flex-1 text-xs font-medium">
                    {group.name}
                  </span>
                  {hasSubTools && (
                    <ChevronDown
                      className={cn(
                        "size-3.5 text-gray-400 transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    />
                  )}
                  {!hasSubTools && isSelected && (
                    <Check className="size-3.5 text-pink-500" />
                  )}
                </button>

                {/* 子工具列表 - 紧凑版 */}
                {hasSubTools && isExpanded && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-pink-100 pl-2">
                    {(group.subTools ?? []).map((subTool) => {
                      const isSubSelected = subTool.id === value;

                      return (
                        <button
                          key={subTool.id}
                          type="button"
                          onClick={() => handleSubToolClick(subTool)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md",
                            "text-left transition-all duration-150",
                            isSubSelected
                              ? "bg-pink-50 text-pink-600"
                              : "text-gray-600 hover:bg-gray-50",
                          )}
                        >
                          <span className="text-xs">{subTool.icon}</span>
                          <span className="flex-1 text-xs">{subTool.name}</span>
                          {isSubSelected && (
                            <Check className="size-3.5 text-pink-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default ToolDropdown;
