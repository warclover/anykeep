/**
 * AI 摘要解析逻辑
 * 纯函数，支持 V1 纯文本格式的智能解析
 *
 * 从 summary-renderer.tsx 提取
 */

import { Lightbulb, List, Sparkles, Info } from "lucide-react";
import { createElement } from "react";

// =============================================================================
// 类型定义
// =============================================================================

export type SectionType = "heading" | "list" | "paragraph" | "quote";

export interface SectionIconData {
  icon: React.ReactNode;
  colorClass: string;
}

export interface Section {
  type: SectionType;
  title?: string;
  iconData?: SectionIconData;
  content?: string;
  items?: string[];
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 根据标题文本返回对应图标和样式
 */
export function getIconForHeading(text: string): SectionIconData {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("核心") || lowerText.includes("主旨")) {
    return {
      icon: createElement(Lightbulb, { className: "size-4" }),
      colorClass: "text-blue-500",
    };
  }
  if (
    lowerText.includes("关键") ||
    lowerText.includes("价值") ||
    lowerText.includes("信息")
  ) {
    return {
      icon: createElement(List, { className: "size-4" }),
      colorClass: "text-emerald-500",
    };
  }
  if (
    lowerText.includes("要点") ||
    lowerText.includes("步骤") ||
    lowerText.includes("要点步骤")
  ) {
    return {
      icon: createElement(Sparkles, { className: "size-4" }),
      colorClass: "text-amber-500",
    };
  }

  return {
    icon: createElement(Info, { className: "size-4" }),
    colorClass: "text-slate-400",
  };
}

/**
 * 判断是否为核心主旨类型的标题
 */
export function isCoreSection(title: string): boolean {
  const lowerText = title.toLowerCase();
  return lowerText.includes("核心") || lowerText.includes("主旨");
}

// =============================================================================
// 解析逻辑
// =============================================================================

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
 */
function extractNumberedItems(
  summary: string,
): { coreContent: string; items: string[] } | null {
  const firstNumberMatch = summary.match(/\d+[）\)\.、]/);
  if (!firstNumberMatch || firstNumberMatch.index === undefined) {
    return null;
  }

  const firstPos = firstNumberMatch.index;
  const coreContent = summary.substring(0, firstPos).trim();
  const listPart = summary.substring(firstPos);

  const splits = listPart.split(/(?=\d+[）\)\.、])/);

  const items: string[] = [];
  for (const part of splits) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const content = trimmed.replace(/^\d+[）\)\.、]\s*/, "").trim();
    if (content) {
      items.push(content.replace(/[；;。]$/, ""));
    }
  }

  return items.length >= 2 ? { coreContent, items } : null;
}

/**
 * 解析没有结构化标记的纯文本（回退方案）
 */
function parsePlainText(summary: string): Section[] {
  const sections: Section[] = [];
  const lines = summary.split("\n").filter((line) => line.trim());

  if (lines.length <= 1) {
    return [{ type: "paragraph", content: summary.trim() }];
  }

  let currentListItems: string[] = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    const listMatch = trimmedLine.match(
      /^[\-\•\*]\s+(.*)|^(\d+)[\.、\)]\s+(.*)/,
    );
    if (listMatch) {
      const item = listMatch[1] || listMatch[3];
      currentListItems.push(item);
      return;
    }

    if (currentListItems.length > 0) {
      sections.push({ type: "list", items: [...currentListItems] });
      currentListItems = [];
    }

    if (trimmedLine) {
      sections.push({ type: "paragraph", content: trimmedLine });
    }
  });

  if (currentListItems.length > 0) {
    sections.push({ type: "list", items: [...currentListItems] });
  }

  return sections;
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

    const displayTitle = title.replace("关键信息点", "关键价值点");
    sections.push({
      type: "heading",
      title: displayTitle,
      iconData: getIconForHeading(title),
    });

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
 * 智能解析摘要文本，自动识别结构
 * 支持两种模式：
 * 1. 显式标记模式：包含"核心主旨："等标记
 * 2. 隐式结构模式：第一句话 + 数字编号列表
 */
export function parseSummary(summary: string): Section[] {
  const sections: Section[] = [];

  // 步骤 1: 尝试识别显式结构化标记
  const sectionRegex =
    /(核心主旨|关键价值点?|关键信息点?|要点步骤|价值|要点|步骤|方法论?|总结)(?:[：:]|(?:是|包括[：:]))/g;
  const explicitMatches = [...summary.matchAll(sectionRegex)];

  if (explicitMatches.length > 0) {
    return parseWithExplicitMarkers(summary, explicitMatches);
  }

  // 步骤 2: 尝试智能解析（第一句话 + 数字编号列表）
  const extractResult = extractNumberedItems(summary);

  if (extractResult) {
    const { coreContent, items } = extractResult;

    if (coreContent) {
      sections.push({
        type: "heading",
        title: "核心主旨",
        iconData: getIconForHeading("核心主旨"),
      });
      sections.push({
        type: "paragraph",
        content: coreContent.replace(/[。\.]+$/, ""),
      });
    }

    sections.push({
      type: "heading",
      title: "关键价值点",
      iconData: getIconForHeading("关键价值点"),
    });

    sections.push({ type: "list", items });

    return sections;
  }

  // 步骤 3: 回退到纯文本解析
  return parsePlainText(summary);
}
