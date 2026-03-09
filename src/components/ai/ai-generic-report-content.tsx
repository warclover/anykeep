/**
 * AI 通用报告内容渲染组件
 *
 * 作为报告类型交付物的 fallback 渲染器
 * 适用于 batch_organize, duplicate_cleanup, smart_tagging 等 Skills
 *
 * 提取常见字段（summary/report, stats, suggestions）进行可视化
 * 支持嵌套数据结构（如 data.overview/data.suggestions）
 *
 * @version 1.1.0
 * @since 2025-12-27
 */

import { memo } from "react";
import {
  BarChart3,
  CheckCircle2,
  Lightbulb,
  FileText,
  TrendingUp,
  Clock,
  Tag,
  Folder,
  AlertCircle,
  Mail,
  Bell,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIMarkdown } from "./ai-markdown";

// ============================================
// 类型定义
// ============================================

interface GenericReportData {
  // 常见字段
  summary?: string;
  report?: string; // InboxDigestSkill 使用 report 字段
  suggestions?: string[];
  stats?: Record<string, unknown>;
  data?: {
    // 嵌套数据结构（如 InboxDigestSkill）
    overview?: Record<string, unknown>;
    suggestions?: string[];
    [key: string]: unknown;
  };
  // 其他可能的字段
  title?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

interface AIGenericReportContentProps {
  content: unknown;
  className?: string;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 统计项渲染
 */
const StatItem = memo(function StatItem({
  label,
  value,
  icon: Icon = BarChart3,
  colorClass = "text-purple-600 bg-purple-100",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
      <div className={cn("p-2 rounded-lg", colorClass)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-semibold text-gray-800 truncate">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );
});

/**
 * 统计数据映射到图标和颜色
 */
function getStatConfig(key: string): {
  icon: React.ElementType;
  colorClass: string;
  label: string;
} {
  const configMap: Record<
    string,
    { icon: React.ElementType; colorClass: string; label: string }
  > = {
    // 通用统计
    totalItems: {
      icon: FileText,
      colorClass: "text-purple-600 bg-purple-100",
      label: "总项目",
    },
    totalCount: {
      icon: FileText,
      colorClass: "text-purple-600 bg-purple-100",
      label: "总数量",
    },
    processedCount: {
      icon: CheckCircle2,
      colorClass: "text-green-600 bg-green-100",
      label: "已处理",
    },
    successCount: {
      icon: CheckCircle2,
      colorClass: "text-green-600 bg-green-100",
      label: "成功数",
    },
    failedCount: {
      icon: AlertCircle,
      colorClass: "text-red-600 bg-red-100",
      label: "失败数",
    },
    skippedCount: {
      icon: Clock,
      colorClass: "text-gray-600 bg-gray-100",
      label: "跳过数",
    },

    // 时间相关
    totalTime: {
      icon: Clock,
      colorClass: "text-blue-600 bg-blue-100",
      label: "总耗时",
    },
    totalReadingTime: {
      icon: Clock,
      colorClass: "text-blue-600 bg-blue-100",
      label: "阅读时间",
    },
    estimatedTime: {
      icon: Clock,
      colorClass: "text-blue-600 bg-blue-100",
      label: "预估时间",
    },

    // 标签相关
    totalTags: {
      icon: Tag,
      colorClass: "text-amber-600 bg-amber-100",
      label: "标签数",
    },
    newTags: {
      icon: Tag,
      colorClass: "text-amber-600 bg-amber-100",
      label: "新标签",
    },
    tagCount: {
      icon: Tag,
      colorClass: "text-amber-600 bg-amber-100",
      label: "标签数",
    },

    // 文件夹相关
    foldersCreated: {
      icon: Folder,
      colorClass: "text-indigo-600 bg-indigo-100",
      label: "新建文件夹",
    },
    foldersMoved: {
      icon: Folder,
      colorClass: "text-indigo-600 bg-indigo-100",
      label: "移动数",
    },

    // 重复/清理相关
    duplicatesFound: {
      icon: AlertCircle,
      colorClass: "text-orange-600 bg-orange-100",
      label: "重复项",
    },
    duplicatesRemoved: {
      icon: CheckCircle2,
      colorClass: "text-green-600 bg-green-100",
      label: "已清理",
    },
    cleaned: {
      icon: CheckCircle2,
      colorClass: "text-green-600 bg-green-100",
      label: "已清理",
    },

    // 进度相关
    completionRate: {
      icon: TrendingUp,
      colorClass: "text-green-600 bg-green-100",
      label: "完成率",
    },
    progress: {
      icon: TrendingUp,
      colorClass: "text-blue-600 bg-blue-100",
      label: "进度",
    },

    // 消息相关（InboxDigestSkill）
    totalMessages: {
      icon: Inbox,
      colorClass: "text-purple-600 bg-purple-100",
      label: "总消息数",
    },
    unreadCount: {
      icon: Mail,
      colorClass: "text-blue-600 bg-blue-100",
      label: "未读消息",
    },
    readCount: {
      icon: CheckCircle2,
      colorClass: "text-green-600 bg-green-100",
      label: "已读消息",
    },
    importantCount: {
      icon: Bell,
      colorClass: "text-red-600 bg-red-100",
      label: "重要消息",
    },
    normalCount: {
      icon: Mail,
      colorClass: "text-gray-600 bg-gray-100",
      label: "普通消息",
    },
    silentCount: {
      icon: Bell,
      colorClass: "text-gray-500 bg-gray-50",
      label: "静默通知",
    },
  };

  return (
    configMap[key] || {
      icon: BarChart3,
      colorClass: "text-gray-600 bg-gray-100",
      label: formatLabel(key),
    }
  );
}

/**
 * 将 camelCase/snake_case 转换为可读标签
 */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\s/, "")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * 格式化统计值
 */
function formatStatValue(value: unknown): string | number | null {
  if (typeof value === "number") {
    // 如果是百分比（0-1之间的小数），转换为百分比显示
    if (value > 0 && value <= 1 && value !== Math.floor(value)) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return null;
}

// ============================================
// 主组件
// ============================================

/**
 * AI 通用报告内容渲染组件
 */
export const AIGenericReportContent = memo(function AIGenericReportContent({
  content,
  className,
}: AIGenericReportContentProps) {
  // 类型检查
  if (typeof content !== "object" || content === null) {
    return <div className="text-sm text-gray-500 italic">无法解析报告数据</div>;
  }

  const data = content as GenericReportData;

  // 提取摘要内容（优先 summary，其次 report）
  const summaryContent = data.summary || data.report;

  // 提取建议（优先顶层 suggestions，其次 data.suggestions）
  const suggestions = data.suggestions?.length
    ? data.suggestions
    : data.data?.suggestions;

  // 提取 stats 中的可渲染项（支持 stats 和 data.overview）
  const statsEntries: Array<{
    key: string;
    value: string | number;
    config: ReturnType<typeof getStatConfig>;
  }> = [];

  // 从顶层 stats 提取
  if (data.stats && typeof data.stats === "object") {
    Object.entries(data.stats).forEach(([key, value]) => {
      const formattedValue = formatStatValue(value);
      if (formattedValue !== null) {
        statsEntries.push({
          key,
          value: formattedValue,
          config: getStatConfig(key),
        });
      }
    });
  }

  // 从 data.overview 提取（如 InboxDigestSkill）
  if (data.data?.overview && typeof data.data.overview === "object") {
    Object.entries(data.data.overview).forEach(([key, value]) => {
      // 避免重复添加
      if (statsEntries.some((e) => e.key === key)) return;
      const formattedValue = formatStatValue(value);
      if (formattedValue !== null) {
        statsEntries.push({
          key,
          value: formattedValue,
          config: getStatConfig(key),
        });
      }
    });
  }

  // 没有任何可渲染内容时的 fallback
  if (!summaryContent && statsEntries.length === 0 && !suggestions?.length) {
    // 尝试渲染整个对象的 Markdown 表示
    const markdownContent = generateMarkdownFromObject(data);
    if (markdownContent) {
      return (
        <div className={cn("space-y-4", className)}>
          <AIMarkdown content={markdownContent} />
        </div>
      );
    }
    return <div className="text-sm text-gray-500 italic">报告数据为空</div>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 统计概览 */}
      {statsEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {statsEntries.slice(0, 8).map(({ key, value, config }) => (
            <StatItem
              key={key}
              label={config.label}
              value={value}
              icon={config.icon}
              colorClass={config.colorClass}
            />
          ))}
        </div>
      )}

      {/* 摘要/报告 */}
      {summaryContent && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <FileText className="size-3.5" />
            <span>{data.report ? "报告" : "摘要"}</span>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <AIMarkdown
              content={summaryContent}
              className="text-sm text-gray-700"
            />
          </div>
        </div>
      )}

      {/* 建议 */}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Lightbulb className="size-3.5" />
            <span>建议</span>
          </div>
          <div className="space-y-1.5">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-100"
              >
                <span className="text-amber-500 text-sm">💡</span>
                <span className="text-sm text-gray-700">{suggestion}</span>
              </div>
            ))}
            {suggestions.length > 5 && (
              <div className="text-xs text-gray-400 text-center pt-1">
                还有 {suggestions.length - 5} 条建议...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 生成时间 */}
      {data.generatedAt && (
        <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
          生成于 {new Date(data.generatedAt).toLocaleString("zh-CN")}
        </div>
      )}
    </div>
  );
});

/**
 * 从对象生成 Markdown 内容
 * 用于没有标准字段时的 fallback
 */
function generateMarkdownFromObject(
  data: Record<string, unknown>,
  depth: number = 0,
): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const [key, value] of Object.entries(data)) {
    // 跳过内部字段
    if (key.startsWith("_") || key === "metadata") continue;

    const label = formatLabel(key);

    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === "string") {
      if (value.length > 100) {
        lines.push(`${indent}**${label}**:`);
        lines.push(`${indent}${value}`);
      } else {
        lines.push(`${indent}**${label}**: ${value}`);
      }
    } else if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${indent}**${label}**: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        lines.push(`${indent}**${label}**:`);
        value.slice(0, 10).forEach((item, i) => {
          if (typeof item === "string") {
            lines.push(`${indent}- ${item}`);
          } else if (typeof item === "object" && item !== null) {
            const title =
              (item as Record<string, unknown>).title ||
              (item as Record<string, unknown>).name ||
              `项目 ${i + 1}`;
            lines.push(`${indent}- ${title}`);
          }
        });
        if (value.length > 10) {
          lines.push(`${indent}- ...还有 ${value.length - 10} 项`);
        }
      }
    } else if (typeof value === "object" && depth < 2) {
      lines.push(`${indent}**${label}**:`);
      const nested = generateMarkdownFromObject(
        value as Record<string, unknown>,
        depth + 1,
      );
      if (nested) {
        lines.push(nested);
      }
    }
  }

  return lines.join("\n");
}

export default AIGenericReportContent;
