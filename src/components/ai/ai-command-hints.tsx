/**
 * AI 特殊命令提示组件
 *
 * 在 AI 对话框中显示可用的特殊命令
 * 帮助用户发现和使用高级功能
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState, memo } from "react";
import {
  Sparkles,
  Search,
  Tags,
  Download,
  Volume2,
  Brain,
  Folder,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  BarChart3,
  Trash2,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

interface SpecialCommand {
  /** 命令触发词 */
  trigger: string;
  /** 命令描述 */
  description: string;
  /** 示例 */
  example?: string;
  /** 图标 */
  icon: React.ComponentType<{ className?: string }>;
  /** 分类 */
  category: "search" | "organize" | "learn" | "export" | "analyze";
}

export interface AICommandHintsProps {
  /** 输入框当前值 */
  inputValue?: string;
  /** 点击命令的回调 */
  onCommandClick?: (command: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
}

// ============================================
// 命令配置
// ============================================

const SPECIAL_COMMANDS: SpecialCommand[] = [
  // 搜索类
  {
    trigger: "搜索",
    description: "语义搜索收藏内容",
    example: "搜索 React 性能优化",
    icon: Search,
    category: "search",
  },
  {
    trigger: "找到关于...",
    description: "精确查找特定主题",
    example: "找到关于 TypeScript 的收藏",
    icon: Search,
    category: "search",
  },
  // 整理类
  {
    trigger: "整理",
    description: "智能整理书签到文件夹",
    example: "帮我整理待分类的书签",
    icon: Folder,
    category: "organize",
  },
  {
    trigger: "打标签",
    description: "自动生成推荐标签",
    example: "帮这些书签打标签",
    icon: Tags,
    category: "organize",
  },
  {
    trigger: "清理重复",
    description: "检测并清理重复书签",
    example: "检查重复的收藏",
    icon: Trash2,
    category: "organize",
  },
  {
    trigger: "检查链接",
    description: "检测失效链接",
    example: "检查链接是否有效",
    icon: Link2,
    category: "organize",
  },
  // 学习类
  {
    trigger: "复习",
    description: "开始知识复习",
    example: "开始今日复习",
    icon: Brain,
    category: "learn",
  },
  {
    trigger: "生成摘要",
    description: "生成书签内容摘要",
    example: "生成这篇文章的摘要",
    icon: FileText,
    category: "learn",
  },
  {
    trigger: "朗读",
    description: "TTS 语音朗读摘要",
    example: "朗读这篇文章",
    icon: Volume2,
    category: "learn",
  },
  {
    trigger: "最近收藏",
    description: "查看最近添加的内容",
    example: "看看最近收藏了什么",
    icon: Clock,
    category: "learn",
  },
  // 导出类
  {
    trigger: "导出",
    description: "导出为多种格式",
    example: "导出到 Obsidian",
    icon: Download,
    category: "export",
  },
  // 分析类
  {
    trigger: "统计",
    description: "生成收藏统计报告",
    example: "统计我的收藏分布",
    icon: BarChart3,
    category: "analyze",
  },
];

const CATEGORY_LABELS: Record<SpecialCommand["category"], string> = {
  search: "搜索",
  organize: "整理",
  learn: "学习",
  export: "导出",
  analyze: "分析",
};

const CATEGORY_COLORS: Record<SpecialCommand["category"], string> = {
  search: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  organize:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  learn:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  export:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  analyze: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
};

// ============================================
// 组件
// ============================================

/**
 * AI 特殊命令提示组件
 */
export const AICommandHints = memo(function AICommandHints({
  inputValue = "",
  onCommandClick,
  className,
  defaultExpanded = false,
}: AICommandHintsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 过滤匹配的命令
  const filteredCommands = inputValue.trim()
    ? SPECIAL_COMMANDS.filter(
        (cmd) =>
          cmd.trigger.toLowerCase().includes(inputValue.toLowerCase()) ||
          cmd.description.toLowerCase().includes(inputValue.toLowerCase()),
      )
    : SPECIAL_COMMANDS;

  // 按分类分组
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<SpecialCommand["category"], SpecialCommand[]>,
  );

  const handleCommandClick = (cmd: SpecialCommand) => {
    onCommandClick?.(cmd.example || cmd.trigger);
  };

  // 展示的命令（折叠时只显示前4个）
  const displayCommands = isExpanded
    ? filteredCommands
    : filteredCommands.slice(0, 4);

  return (
    <div className={cn("text-xs", className)}>
      {/* 标题栏 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          <span>试试这些命令</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {filteredCommands.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>

      {/* 命令列表 */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-64" : "max-h-24",
        )}
      >
        <div className="flex flex-wrap gap-1.5 p-2">
          {displayCommands.map((cmd) => (
            <button
              key={cmd.trigger}
              type="button"
              onClick={() => handleCommandClick(cmd)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-all",
                "text-xs font-medium",
                "hover:scale-105 active:scale-95",
                CATEGORY_COLORS[cmd.category],
              )}
              title={cmd.example}
            >
              <cmd.icon className="size-3" />
              <span>{cmd.trigger}</span>
            </button>
          ))}
        </div>

        {/* 展开时显示分组详情 */}
        {isExpanded && (
          <div className="px-2 pb-2 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
            {(Object.keys(groupedCommands) as SpecialCommand["category"][]).map(
              (category) => (
                <div key={category}>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                    {CATEGORY_LABELS[category]}
                  </div>
                  <div className="space-y-1">
                    {groupedCommands[category].map((cmd) => (
                      <button
                        key={cmd.trigger}
                        type="button"
                        onClick={() => handleCommandClick(cmd)}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <cmd.icon
                          className={cn(
                            "size-3.5",
                            CATEGORY_COLORS[cmd.category].split(" ")[1],
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-700 dark:text-gray-300">
                            {cmd.trigger}
                          </div>
                          <div className="text-gray-400 truncate">
                            {cmd.description}
                          </div>
                        </div>
                        {cmd.example && (
                          <Zap className="size-3 text-yellow-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* 快捷提示 */}
      {!isExpanded && filteredCommands.length > 4 && (
        <div className="px-2 pb-1 text-[10px] text-gray-400">
          还有 {filteredCommands.length - 4} 个命令，点击展开查看
        </div>
      )}
    </div>
  );
});

export default AICommandHints;
