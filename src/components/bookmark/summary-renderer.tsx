/**
 * AI 摘要渲染组件
 * 智能解析纯文本摘要，提供结构化视觉呈现
 */

import { Lightbulb, List, Target, Info, Sparkles } from "lucide-react";
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
  icon?: React.ReactNode;
  content?: string;
  items?: string[];
}

/**
 * 根据标题文本返回对应图标
 */
function getIconForHeading(text: string): React.ReactNode {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("核心") || lowerText.includes("主旨")) {
    return <Lightbulb className="size-4 text-blue-500" />;
  }
  if (lowerText.includes("关键") || lowerText.includes("信息")) {
    return <List className="size-4 text-green-500" />;
  }
  if (
    lowerText.includes("适用") ||
    lowerText.includes("场景") ||
    lowerText.includes("价值")
  ) {
    return <Target className="size-4 text-purple-500" />;
  }
  if (lowerText.includes("要点") || lowerText.includes("步骤")) {
    return <Sparkles className="size-4 text-orange-500" />;
  }

  return <Info className="size-4 text-gray-500" />;
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
  // 匹配模式: "关键信息点：" 或 "适用场景：" 等
  const sectionRegex =
    /(核心主旨|关键信息点?|适用场景|价值|要点|步骤|方法论?|总结)[：:]/g;

  // 查找所有标记位置
  const matches = [...summary.matchAll(sectionRegex)];

  if (matches.length === 0) {
    // 没有找到结构化标记，按换行符分割
    return parsePlainText(summary);
  }

  // 有结构化标记，按标记分割
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    const matchStart = match.index!;
    const title = match[1];

    // 提取前一段内容（如果有）
    if (matchStart > lastIndex) {
      const prevContent = summary.substring(lastIndex, matchStart).trim();
      if (prevContent) {
        // 这是第一段（核心描述），去除可能的句号
        const cleanContent = prevContent.replace(/[。\.]+$/, "");
        sections.push({ type: "paragraph", content: cleanContent });
      }
    }

    // 添加标题
    sections.push({
      type: "heading",
      title,
      icon: getIconForHeading(title),
    });

    // 提取此标记后的内容（到下一个标记或结尾）
    const contentStart = matchStart + match[0].length;
    const nextMatch = matches[idx + 1];
    const contentEnd = nextMatch ? nextMatch.index! : summary.length;
    const content = summary.substring(contentStart, contentEnd).trim();

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
 * AI 摘要渲染组件
 */
export function SummaryRenderer({ summary, className }: SummaryRendererProps) {
  const sections = parseSummary(summary);

  // 如果解析失败或只有一个段落，降级到简单渲染
  if (sections.length === 0) {
    return (
      <p
        className={cn(
          "text-gray-600 dark:text-gray-400 leading-relaxed",
          className,
        )}
      >
        {summary}
      </p>
    );
  }

  // 如果只有一个普通段落（无结构化内容），也使用简单渲染
  if (sections.length === 1 && sections[0].type === "paragraph") {
    return (
      <p
        className={cn(
          "text-gray-600 dark:text-gray-400 leading-relaxed",
          className,
        )}
      >
        {sections[0].content}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {sections.map((section, idx) => {
        // 标题
        if (section.type === "heading") {
          return (
            <div key={idx} className="flex items-center gap-2 mt-4 first:mt-0">
              {section.icon}
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {section.title}
              </h4>
            </div>
          );
        }

        // 列表
        if (section.type === "list" && section.items) {
          return (
            <ul
              key={idx}
              className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-6"
            >
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="relative pl-0 before:content-['•'] before:absolute before:-left-4 before:text-gray-400"
                >
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        // 引用块（特殊段落，如果包含"建议"、"注意"等关键词）
        if (section.type === "quote" && section.content) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-blue-500 pl-3 text-sm text-gray-700 dark:text-gray-300 italic"
            >
              {section.content}
            </blockquote>
          );
        }

        // 普通段落
        if (section.type === "paragraph" && section.content) {
          return (
            <p
              key={idx}
              className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
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
