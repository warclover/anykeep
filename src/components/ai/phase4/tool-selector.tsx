"use client";

/**
 * Phase 4: ToolPicker - 工具选择器组件
 * @version 1.0.0
 * @description 用户可手动选择 AI 工具，绕过意图分类，实现 100% 意图准确率
 */

import * as React from "react";
import {
  Bot,
  Search,
  FolderOpen,
  FileText,
  Download,
  Lightbulb,
  BookOpen,
  BarChart3,
  Tag,
  Trash2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  ToolType,
  ToolOption,
  ToolCategory,
  ToolSelectorProps,
} from "./types";

// =============================================================================
// 工具配置
// =============================================================================

/**
 * 工具选项配置
 */
export const TOOL_OPTIONS: ToolOption[] = [
  // 自动模式
  {
    type: "auto",
    label: "自动",
    icon: Bot,
    description: "AI 自动判断意图",
    category: "auto",
    shortcut: "⌘A",
  },

  // 搜索类
  {
    type: "search",
    label: "搜索",
    icon: Search,
    description: "搜索收藏内容",
    category: "search",
    shortcut: "⌘S",
  },
  {
    type: "stats",
    label: "统计",
    icon: BarChart3,
    description: "查看收藏统计",
    category: "search",
  },

  // 管理类
  {
    type: "organize",
    label: "整理",
    icon: FolderOpen,
    description: "整理和分类",
    category: "manage",
    shortcut: "⌘O",
  },
  {
    type: "tag",
    label: "标签",
    icon: Tag,
    description: "批量添加标签",
    category: "manage",
  },
  {
    type: "dedupe",
    label: "去重",
    icon: Trash2,
    description: "清理重复内容",
    category: "manage",
  },

  // 创作类
  {
    type: "summarize",
    label: "总结",
    icon: FileText,
    description: "生成摘要",
    category: "create",
    shortcut: "⌘M",
  },
  {
    type: "extract",
    label: "萃取",
    icon: Lightbulb,
    description: "知识萃取",
    category: "create",
    shortcut: "⌘K",
  },
  {
    type: "review",
    label: "复习",
    icon: BookOpen,
    description: "知识回顾",
    category: "create",
  },

  // 导出类
  {
    type: "export",
    label: "导出",
    icon: Download,
    description: "导出数据",
    category: "export",
    shortcut: "⌘E",
  },
];

/**
 * 分类标签
 */
const CATEGORY_LABELS: Record<ToolCategory, string> = {
  auto: "智能模式",
  search: "🔍 搜索",
  manage: "📁 管理",
  create: "✍️ 创作",
  export: "📤 导出",
};

/**
 * 按分类分组工具
 */
const TOOLS_BY_CATEGORY = TOOL_OPTIONS.reduce(
  (acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  },
  {} as Record<ToolCategory, ToolOption[]>,
);

// =============================================================================
// 工具选择器组件
// =============================================================================

export function ToolSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ToolSelectorProps) {
  const selectedTool = TOOL_OPTIONS.find((t) => t.type === value);
  const isAuto = value === "auto";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant={isAuto ? "ghost" : "outline"}
          size="sm"
          className={cn(
            "gap-2 min-w-[100px] transition-colors",
            isAuto && "text-muted-foreground hover:text-foreground",
            !isAuto && "border-primary/50 bg-primary/5",
            className,
          )}
        >
          {selectedTool && (
            <>
              {isAuto ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <selectedTool.icon className="h-4 w-4" />
              )}
              <span>{selectedTool.label}</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[220px]">
        {/* 自动模式 */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {CATEGORY_LABELS.auto}
          </DropdownMenuLabel>
          {TOOLS_BY_CATEGORY.auto.map((tool) => (
            <ToolMenuItem
              key={tool.type}
              tool={tool}
              isSelected={value === tool.type}
              onClick={() => onChange(tool.type)}
            />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* 搜索类 */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {CATEGORY_LABELS.search}
          </DropdownMenuLabel>
          {TOOLS_BY_CATEGORY.search.map((tool) => (
            <ToolMenuItem
              key={tool.type}
              tool={tool}
              isSelected={value === tool.type}
              onClick={() => onChange(tool.type)}
            />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* 管理类 */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {CATEGORY_LABELS.manage}
          </DropdownMenuLabel>
          {TOOLS_BY_CATEGORY.manage.map((tool) => (
            <ToolMenuItem
              key={tool.type}
              tool={tool}
              isSelected={value === tool.type}
              onClick={() => onChange(tool.type)}
            />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* 创作类 */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {CATEGORY_LABELS.create}
          </DropdownMenuLabel>
          {TOOLS_BY_CATEGORY.create.map((tool) => (
            <ToolMenuItem
              key={tool.type}
              tool={tool}
              isSelected={value === tool.type}
              onClick={() => onChange(tool.type)}
            />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* 导出类 */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {CATEGORY_LABELS.export}
          </DropdownMenuLabel>
          {TOOLS_BY_CATEGORY.export.map((tool) => (
            <ToolMenuItem
              key={tool.type}
              tool={tool}
              isSelected={value === tool.type}
              onClick={() => onChange(tool.type)}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// 工具菜单项组件
// =============================================================================

interface ToolMenuItemProps {
  tool: ToolOption;
  isSelected: boolean;
  onClick: () => void;
}

function ToolMenuItem({ tool, isSelected, onClick }: ToolMenuItemProps) {
  const Icon = tool.icon;

  return (
    <DropdownMenuItem
      onClick={onClick}
      disabled={tool.isDisabled}
      className={cn(
        "flex items-center justify-between cursor-pointer",
        isSelected && "bg-accent",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="font-medium text-sm">{tool.label}</div>
          <div className="text-xs text-muted-foreground">
            {tool.description}
          </div>
        </div>
      </div>
      {tool.shortcut && (
        <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
          {tool.shortcut}
        </kbd>
      )}
    </DropdownMenuItem>
  );
}

// =============================================================================
// 键盘快捷键 Hook
// =============================================================================

/**
 * 工具快捷键 Hook
 */
export function useToolShortcuts(onToolChange: (tool: ToolType) => void) {
  React.useEffect(() => {
    const shortcutMap: Record<string, ToolType> = {
      a: "auto",
      s: "search",
      o: "organize",
      m: "summarize",
      e: "export",
      k: "extract",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否按下了 Cmd/Ctrl 键
      if (!e.metaKey && !e.ctrlKey) return;

      // 忽略输入框中的快捷键
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const tool = shortcutMap[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        onToolChange(tool);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange]);
}

// =============================================================================
// 工具选择器带快捷键版本
// =============================================================================

export interface ToolSelectorWithShortcutsProps extends ToolSelectorProps {
  enableShortcuts?: boolean;
}

export function ToolSelectorWithShortcuts({
  value,
  onChange,
  disabled = false,
  className,
  enableShortcuts = true,
}: ToolSelectorWithShortcutsProps) {
  // 启用快捷键
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  useToolShortcuts(enableShortcuts && !disabled ? onChange : () => {});

  return (
    <ToolSelector
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
    />
  );
}

// =============================================================================
// 工具提示组件（用于显示当前选中工具的说明）
// =============================================================================

interface ToolHintProps {
  tool: ToolType;
  className?: string;
}

export function ToolHint({ tool, className }: ToolHintProps) {
  const selectedTool = TOOL_OPTIONS.find((t) => t.type === tool);

  if (!selectedTool || tool === "auto") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 text-xs rounded-md",
        "bg-primary/10 text-primary border border-primary/20",
        className,
      )}
    >
      <selectedTool.icon className="h-3 w-3" />
      <span>
        使用 <strong>{selectedTool.label}</strong> 工具
      </span>
    </div>
  );
}

// =============================================================================
// 导出
// =============================================================================

export default ToolSelector;
