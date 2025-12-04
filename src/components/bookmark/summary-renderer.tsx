/**
 * AI 摘要渲染组件
 * 智能解析纯文本摘要，提供结构化视觉呈现
 */

import { Lightbulb, List, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (lowerText.includes("要点") || lowerText.includes("步骤")) {
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
 * 解析纯文本摘要，识别结构化内容
 * 支持多行文本和单行连续文本两种格式
 */
function parseSummary(summary: string): Section[] {
  const sections: Section[] = [];

  // 步骤 1: 先尝试识别结构化标记，分割成段落
  // 匹配模式支持两种格式：
  // - "关键价值点：" 或 "核心主旨：" (标记+冒号)
  // - "核心主旨是" 或 "关键信息点包括：" (标记+是/包括)
  const sectionRegex =
    /(核心主旨|关键价值点?|关键信息点?|价值|要点|步骤|方法论?|总结)(?:[：:]|(?:是|包括[：:]))/g;

  // 查找所有标记位置
  const matches = [...summary.matchAll(sectionRegex)];

  if (matches.length === 0) {
    // 没有找到结构化标记，按换行符分割
    return parsePlainText(summary);
  }

  // 有结构化标记，按标记分割
  let lastIndex = 0;
  let leadingContent = ""; // 保存前导段落，用于合并到核心主旨

  matches.forEach((match, idx) => {
    const matchStart = match.index!;
    const title = match[1];
    const isCore = title.includes("核心") || title.includes("主旨");

    // 提取前一段内容（如果有）
    if (matchStart > lastIndex) {
      const prevContent = summary.substring(lastIndex, matchStart).trim();
      if (prevContent) {
        // 如果下一个是核心主旨，保存前导内容用于合并
        if (isCore && sections.length === 0) {
          leadingContent = prevContent.replace(/[，,]+$/, "");
        } else {
          // 非核心主旨前的内容，作为独立段落
          const cleanContent = prevContent.replace(/[。\.]+$/, "");
          sections.push({ type: "paragraph", content: cleanContent });
        }
      }
    }

    // 添加标题（将"关键信息点"自动转换为"关键价值点"显示）
    const displayTitle = title.replace("关键信息点", "关键价值点");
    sections.push({
      type: "heading",
      title: displayTitle,
      iconData: getIconForHeading(title),
    });

    // 提取此标记后的内容（到下一个标记或结尾）
    const contentStart = matchStart + match[0].length;
    const nextMatch = matches[idx + 1];
    const contentEnd = nextMatch ? nextMatch.index! : summary.length;
    let content = summary.substring(contentStart, contentEnd).trim();

    // 如果是核心主旨且有前导内容，合并它们
    if (isCore && leadingContent) {
      content = leadingContent + "，" + content;
      leadingContent = ""; // 清空，避免重复使用
    }

    // 解析内容（可能是列表或段落）
    if (content) {
      const listItems = parseListContent(content);
      if (listItems.length > 0) {
        sections.push({ type: "list", items: listItems });
      } else {
        // 去除末尾的句号
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

/**
 * AI 摘要渲染组件
 * 采用卡片式结构化布局，层次分明，便于阅读
 */
export function SummaryRenderer({ summary, className }: SummaryRendererProps) {
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
        <p className="text-slate-700 dark:text-slate-300 leading-7">
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
        <p className="text-slate-700 dark:text-slate-300 leading-7">
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
                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
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
              className="border-l-4 border-blue-400 dark:border-blue-500 pl-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-r-lg text-slate-700 dark:text-slate-300 italic leading-relaxed"
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
                <p className="text-[15px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {section.content}
                </p>
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-slate-700 dark:text-slate-300 leading-7 ml-1"
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
