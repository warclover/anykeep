/**
 * AI 摘要渲染组件
 * 智能解析纯文本摘要，提供结构化视觉呈现
 *
 * 支持两种格式：
 * - V1: 纯文本格式（智能解析）
 * - V2: JSON 结构化格式（直接渲染）
 *
 * @version 2.0.0
 */

import {
  Lightbulb,
  List,
  Info,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckSquare,
  Clock,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseStructuredSummary,
  isStructuredSummary,
  type StructuredSummary,
  type Sentiment,
} from "@/lib/classification/types/ai-summary";

interface SummaryRendererProps {
  summary: string;
  className?: string;
}

/**
 * 摘要段落类型
 */
type SectionType = "heading" | "list" | "paragraph" | "quote";

interface Section {
  type: SectionType;
  title?: string;
  iconData?: {
    icon: React.ReactNode;
    colorClass: string;
  };
  content?: string;
  items?: string[];
}

/**
 * 根据标题文本返回对应图标和样式
 */
function getIconForHeading(text: string): {
  icon: React.ReactNode;
  colorClass: string;
} {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("核心") || lowerText.includes("主旨")) {
    return {
      icon: <Lightbulb className="size-4" />,
      colorClass: "text-blue-500",
    };
  }
  if (
    lowerText.includes("关键") ||
    lowerText.includes("价值") ||
    lowerText.includes("信息")
  ) {
    return {
      icon: <List className="size-4" />,
      colorClass: "text-emerald-500",
    };
  }
  if (
    lowerText.includes("要点") ||
    lowerText.includes("步骤") ||
    lowerText.includes("要点步骤")
  ) {
    return {
      icon: <Sparkles className="size-4" />,
      colorClass: "text-amber-500",
    };
  }

  return {
    icon: <Info className="size-4" />,
    colorClass: "text-slate-400",
  };
}

/**
 * 解析列表内容（支持数字列表、句号分隔、分号分隔）
 */
function parseListContent(content: string): string[] {
  // 模式 1: 数字列表 "1. xxx；2. xxx；3. xxx"
  const numberListMatch = content.match(/(\d+)[\.、\)]\s*([^；;。]+)/g);
  if (numberListMatch && numberListMatch.length > 1) {
    return numberListMatch.map((item) => {
      return item.replace(/^\d+[\.、\)]\s*/, "").trim();
    });
  }

  // 模式 2: 分号分隔的列表（去除句号分隔，避免误判）
  const separatorList = content.split(/[；;]/).filter((item) => item.trim());
  if (separatorList.length > 1) {
    return separatorList.map((item) => item.trim());
  }

  // 模式 3: 换行符分隔的列表
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length > 1) {
    return lines.map((line) => {
      // 移除列表符号 (-, •, *, 数字.)
      return line.replace(/^[\-\•\*]\s*|^\d+[\.、\)]\s*/, "").trim();
    });
  }

  // 不是列表，返回空数组
  return [];
}

/**
 * 智能提取数字编号列表项
 * 使用分割而非正则捕获组，避免在内容中的数字处截断
 *
 * 支持格式：
 * - "1）xxx；2）xxx；3）xxx"
 * - "1. xxx；2. xxx；3. xxx"
 * - "1、xxx；2、xxx；3、xxx"
 */
function extractNumberedItems(
  summary: string,
): { coreContent: string; items: string[] } | null {
  // 找到第一个编号的位置（1）、1.、1、 等格式）
  const firstNumberMatch = summary.match(/\d+[）\)\.、]/);
  if (!firstNumberMatch || firstNumberMatch.index === undefined) {
    return null;
  }

  const firstPos = firstNumberMatch.index;
  const coreContent = summary.substring(0, firstPos).trim();
  const listPart = summary.substring(firstPos);

  // 使用前瞻断言按编号分割（在编号前分割，保留编号）
  // 匹配 "1）" "2）" "3）" "1." "2." "1、" 等
  const splits = listPart.split(/(?=\d+[）\)\.、])/);

  const items: string[] = [];
  for (const part of splits) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // 移除开头的编号（如 "1）"、"2."、"3、"）
    const content = trimmed.replace(/^\d+[）\)\.、]\s*/, "").trim();
    if (content) {
      // 移除末尾的分号或句号
      items.push(content.replace(/[；;。]$/, ""));
    }
  }

  // 至少需要 2 个列表项才算有效的编号列表
  return items.length >= 2 ? { coreContent, items } : null;
}

/**
 * 解析没有结构化标记的纯文本（回退方案）
 */
function parsePlainText(summary: string): Section[] {
  const sections: Section[] = [];
  const lines = summary.split("\n").filter((line) => line.trim());

  // 如果只有一行，直接返回段落
  if (lines.length <= 1) {
    return [{ type: "paragraph", content: summary.trim() }];
  }

  let currentListItems: string[] = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // 识别列表项（以 -、•、*、数字. 开头）
    const listMatch = trimmedLine.match(
      /^[\-\•\*]\s+(.*)|^(\d+)[\.、\)]\s+(.*)/,
    );
    if (listMatch) {
      const item = listMatch[1] || listMatch[3];
      currentListItems.push(item);
      return;
    }

    // 如果之前有列表项，先保存列表
    if (currentListItems.length > 0) {
      sections.push({ type: "list", items: [...currentListItems] });
      currentListItems = [];
    }

    // 普通段落
    if (trimmedLine) {
      sections.push({ type: "paragraph", content: trimmedLine });
    }
  });

  // 保存最后的列表项
  if (currentListItems.length > 0) {
    sections.push({ type: "list", items: [...currentListItems] });
  }

  return sections;
}

/**
 * 智能解析摘要文本，自动识别结构
 * 支持两种模式：
 * 1. 显式标记模式：包含"核心主旨："等标记
 * 2. 隐式结构模式：第一句话 + 数字编号列表
 */
function parseSummary(summary: string): Section[] {
  const sections: Section[] = [];

  // 步骤 1: 尝试识别显式结构化标记
  const sectionRegex =
    /(核心主旨|关键价值点?|关键信息点?|要点步骤|价值|要点|步骤|方法论?|总结)(?:[：:]|(?:是|包括[：:]))/g;
  const explicitMatches = [...summary.matchAll(sectionRegex)];

  // 如果有显式标记，使用标记解析模式
  if (explicitMatches.length > 0) {
    return parseWithExplicitMarkers(summary, explicitMatches);
  }

  // 步骤 2: 尝试智能解析（第一句话 + 数字编号列表）
  // 使用更可靠的分割方式，避免在数字处截断
  const extractResult = extractNumberedItems(summary);

  if (extractResult) {
    const { coreContent, items } = extractResult;

    if (coreContent) {
      // 添加核心主旨标题
      sections.push({
        type: "heading",
        title: "核心主旨",
        iconData: getIconForHeading("核心主旨"),
      });
      // 核心主旨内容
      sections.push({
        type: "paragraph",
        content: coreContent.replace(/[。\.]+$/, ""),
      });
    }

    // 添加关键价值点标题
    sections.push({
      type: "heading",
      title: "关键价值点",
      iconData: getIconForHeading("关键价值点"),
    });

    // 提取所有编号项
    sections.push({ type: "list", items });

    return sections;
  }

  // 步骤 3: 回退到纯文本解析
  return parsePlainText(summary);
}

/**
 * 使用显式标记解析摘要
 */
function parseWithExplicitMarkers(
  summary: string,
  matches: RegExpMatchArray[],
): Section[] {
  const sections: Section[] = [];
  let lastIndex = 0;
  let leadingContent = "";

  matches.forEach((match, idx) => {
    const matchStart = match.index ?? 0;
    const title = match[1];
    const isCore = title.includes("核心") || title.includes("主旨");

    // 提取前一段内容
    if (matchStart > lastIndex) {
      const prevContent = summary.substring(lastIndex, matchStart).trim();
      if (prevContent) {
        if (isCore && sections.length === 0) {
          leadingContent = prevContent.replace(/[，,]+$/, "");
        } else {
          const cleanContent = prevContent.replace(/[。\.]+$/, "");
          sections.push({ type: "paragraph", content: cleanContent });
        }
      }
    }

    // 添加标题
    const displayTitle = title.replace("关键信息点", "关键价值点");
    sections.push({
      type: "heading",
      title: displayTitle,
      iconData: getIconForHeading(title),
    });

    // 提取内容
    const contentStart = matchStart + match[0].length;
    const nextMatch = matches[idx + 1];
    const contentEnd = nextMatch
      ? (nextMatch.index ?? summary.length)
      : summary.length;
    let content = summary.substring(contentStart, contentEnd).trim();

    if (isCore && leadingContent) {
      content = leadingContent + "，" + content;
      leadingContent = "";
    }

    if (content) {
      const listItems = parseListContent(content);
      if (listItems.length > 0) {
        sections.push({ type: "list", items: listItems });
      } else {
        const cleanContent = content.replace(/[。\.]+$/, "");
        sections.push({ type: "paragraph", content: cleanContent });
      }
    }

    lastIndex = contentEnd;
  });

  return sections;
}

/**
 * 判断是否为核心主旨类型的标题
 */
function isCoreSection(title: string): boolean {
  const lowerText = title.toLowerCase();
  return lowerText.includes("核心") || lowerText.includes("主旨");
}

// ============================================================
// V2: JSON 结构化摘要渲染
// ============================================================

/**
 * 获取情感图标和颜色
 */
function getSentimentIcon(sentiment: Sentiment): {
  icon: React.ReactNode;
  colorClass: string;
  label: string;
} {
  switch (sentiment) {
    case "positive":
      return {
        icon: <TrendingUp className="size-3" />,
        colorClass: "text-green-500 bg-green-50 dark:bg-green-900/30",
        label: "积极",
      };
    case "negative":
      return {
        icon: <TrendingDown className="size-3" />,
        colorClass: "text-red-500 bg-red-50 dark:bg-red-900/30",
        label: "消极",
      };
    default:
      return {
        icon: <Minus className="size-3" />,
        colorClass: "text-gray-500 bg-gray-50 dark:bg-gray-800/50",
        label: "中性",
      };
  }
}

/**
 * V2 结构化摘要渲染组件
 */
function StructuredSummaryRenderer({
  data,
  className,
}: {
  data: StructuredSummary;
  className?: string;
}) {
  const sentimentData = getSentimentIcon(data.sentiment);

  return (
    <div
      className={cn(
        "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 space-y-4",
        className,
      )}
    >
      {/* TL;DR - 核心主旨 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm text-blue-500">
            <Lightbulb className="size-4" />
          </span>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            核心主旨
          </h4>
        </div>
        <div className="border-l-4 border-blue-500 dark:border-blue-400 pl-3 py-2 bg-white/60 dark:bg-slate-800/50 rounded-r-lg">
          <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
            {data.tldr}
          </p>
        </div>
      </div>

      {/* Key Points - 关键要点 */}
      {data.key_points.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm text-emerald-500">
              <List className="size-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              关键价值点
            </h4>
          </div>
          <ul className="space-y-2 ml-1">
            {data.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items - 行动项（仅教程类显示） */}
      {data.action_items && data.action_items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm text-amber-500">
              <CheckSquare className="size-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              行动步骤
            </h4>
          </div>
          <ul className="space-y-1.5 ml-1">
            {data.action_items.map((action, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-slate-600 dark:text-slate-400"
              >
                <span className="text-amber-500 mt-1">▸</span>
                <span className="text-sm leading-relaxed">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta Info - 元信息栏 */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
        {/* 情感倾向 */}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
            sentimentData.colorClass,
          )}
        >
          {sentimentData.icon}
          {sentimentData.label}
        </span>

        {/* 阅读时间 */}
        {data.reading_time > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="size-3" />
            {data.reading_time} 分钟
          </span>
        )}

        {/* 关键词标签 */}
        {data.keywords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="size-3 text-slate-400" />
            {data.keywords.slice(0, 5).map((keyword, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Component - 自动检测格式并渲染
// ============================================================

/**
 * AI 摘要渲染组件
 * 采用卡片式结构化布局，层次分明，便于阅读
 *
 * 自动检测摘要格式：
 * - JSON 格式：使用 StructuredSummaryRenderer
 * - 纯文本格式：使用智能解析后渲染
 */
export function SummaryRenderer({ summary, className }: SummaryRendererProps) {
  // 尝试解析为 JSON 结构化摘要
  if (isStructuredSummary(summary)) {
    const structured = parseStructuredSummary(summary);
    if (structured) {
      return (
        <StructuredSummaryRenderer data={structured} className={className} />
      );
    }
  }

  // 回退到纯文本解析（V1 逻辑）
  const sections = parseSummary(summary);

  // 如果解析失败或只有一个段落，降级到简单卡片渲染
  if (sections.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50",
          className,
        )}
      >
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {summary}
        </p>
      </div>
    );
  }

  // 如果只有一个普通段落（无结构化内容），也使用简单卡片渲染
  if (sections.length === 1 && sections[0].type === "paragraph") {
    return (
      <div
        className={cn(
          "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50",
          className,
        )}
      >
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {sections[0].content}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 space-y-3",
        className,
      )}
    >
      {sections.map((section, idx) => {
        // 标题
        if (section.type === "heading" && section.title) {
          const isCore = isCoreSection(section.title);
          return (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-2 pt-2 first:pt-0",
                isCore && "pb-0.5",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm",
                  section.iconData?.colorClass,
                )}
              >
                {section.iconData?.icon}
              </span>
              <h4
                className={cn(
                  "text-sm font-semibold tracking-wide",
                  isCore
                    ? "text-slate-800 dark:text-slate-200"
                    : "text-slate-500 dark:text-slate-400 uppercase",
                )}
              >
                {section.title}
              </h4>
            </div>
          );
        }

        // 列表 - 带编号圆点样式
        if (section.type === "list" && section.items) {
          return (
            <ul key={idx} className="space-y-2 ml-1">
              {section.items.map((item, i) => {
                // 去除文本开头的序号前缀（如 "1）"、"2."、"①" 等）
                const cleanItem = item
                  .replace(/^[\d①②③④⑤⑥⑦⑧⑨⑩]+[）\)\.、\s]+/, "")
                  .trim();
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {cleanItem}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // 引用块
        if (section.type === "quote" && section.content) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-blue-400 dark:border-blue-500 pl-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-r-lg text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed"
            >
              {section.content}
            </blockquote>
          );
        }

        // 普通段落 - 核心主旨后的内容突出显示
        if (section.type === "paragraph" && section.content) {
          // 检查前一个 section 是否是核心主旨
          const prevSection = idx > 0 ? sections[idx - 1] : null;
          const isAfterCore =
            prevSection?.type === "heading" &&
            prevSection.title &&
            isCoreSection(prevSection.title);

          if (isAfterCore) {
            return (
              <div
                key={idx}
                className="border-l-4 border-blue-500 dark:border-blue-400 pl-3 py-2 bg-white/60 dark:bg-slate-800/50 rounded-r-lg"
              >
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {section.content}
                </p>
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed ml-1"
            >
              {section.content}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
