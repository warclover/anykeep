/**
 * MD 内容分块器
 *
 * 智能分块 Markdown 文档，用于处理超长文档：
 * 1. 保持代码块完整（不在代码块中间断开）
 * 2. 优先按标题分割（保持语义完整）
 * 3. 超长段落按字符数分割（保留上下文重叠）
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type {
  ContentChunk,
  ChunkOptions,
  ChunkResult,
  ChunkSummary,
} from "./types";
import {
  DEFAULT_CHUNK_MAX_CHARS,
  DEFAULT_CHUNK_MIN_CHARS,
  DEFAULT_CHUNK_OVERLAP_CHARS,
} from "./types";

// ============================================================================
// 正则表达式
// ============================================================================

/** 代码块匹配（包括语言标记） */
const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;

/** 标题匹配（1-6级） */
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

/** 段落分隔（两个换行） */
const PARAGRAPH_REGEX = /\n\n+/;

// ============================================================================
// 主要导出函数
// ============================================================================

/**
 * 检测内容是否需要分块
 *
 * @param content - Markdown 内容
 * @param maxChars - 最大字符数阈值
 */
export function needsChunking(
  content: string,
  maxChars: number = DEFAULT_CHUNK_MAX_CHARS,
): boolean {
  return content.length > maxChars;
}

/**
 * 智能分块 Markdown 内容
 *
 * @param content - Markdown 内容
 * @param options - 分块选项
 */
export function chunkContent(
  content: string,
  options: ChunkOptions = {},
): ChunkResult {
  const {
    maxChars = DEFAULT_CHUNK_MAX_CHARS,
    minChars = DEFAULT_CHUNK_MIN_CHARS,
    preserveCodeBlocks = true,
    splitByHeading = true,
    overlapChars = DEFAULT_CHUNK_OVERLAP_CHARS,
  } = options;

  // 不需要分块
  if (content.length <= maxChars) {
    return {
      chunks: [
        {
          index: 0,
          content,
          type: "mixed",
          charCount: content.length,
        },
      ],
      totalChars: content.length,
      wasChunked: false,
      strategy: "none",
    };
  }

  // 策略1：尝试按标题分割
  if (splitByHeading) {
    const headingChunks = chunkByHeadings(content, maxChars, minChars);
    if (headingChunks.length > 1) {
      return {
        chunks: headingChunks,
        totalChars: content.length,
        wasChunked: true,
        strategy: "heading",
      };
    }
  }

  // 策略2：按段落分割，保持代码块完整
  const chunks = chunkByParagraphs(
    content,
    maxChars,
    minChars,
    preserveCodeBlocks,
    overlapChars,
  );

  return {
    chunks,
    totalChars: content.length,
    wasChunked: chunks.length > 1,
    strategy: chunks.length > 1 ? "length" : "none",
  };
}

/**
 * 合并分块摘要为完整摘要
 *
 * @param chunkSummaries - 分块摘要列表
 */
export function mergeSummaries(chunkSummaries: ChunkSummary[]): {
  summary: string;
  keyPoints: string[];
  keywords: string[];
} {
  if (chunkSummaries.length === 0) {
    return { summary: "", keyPoints: [], keywords: [] };
  }

  if (chunkSummaries.length === 1) {
    return {
      summary: chunkSummaries[0].summary,
      keyPoints: chunkSummaries[0].keyPoints,
      keywords: chunkSummaries[0].keywords,
    };
  }

  // 合并摘要：取第一个作为主摘要，后续补充
  const summary = chunkSummaries.map((c) => c.summary).join(" ");

  // 合并要点：去重
  const allKeyPoints = chunkSummaries.flatMap((c) => c.keyPoints);
  const uniqueKeyPoints = [...new Set(allKeyPoints)].slice(0, 5);

  // 合并关键词：去重并按出现频率排序
  const keywordCounts = new Map<string, number>();
  for (const chunk of chunkSummaries) {
    for (const keyword of chunk.keywords) {
      const normalized = keyword.toLowerCase();
      keywordCounts.set(normalized, (keywordCounts.get(normalized) || 0) + 1);
    }
  }
  const sortedKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword);

  return {
    summary,
    keyPoints: uniqueKeyPoints,
    keywords: sortedKeywords,
  };
}

// ============================================================================
// 内部辅助函数
// ============================================================================

/**
 * 按标题分割内容
 */
function chunkByHeadings(
  content: string,
  maxChars: number,
  minChars: number,
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  const headingMatches = [...content.matchAll(HEADING_REGEX)];

  if (headingMatches.length === 0) {
    return [];
  }

  // 找出合适的分割点（优先选择 h1, h2, h3）
  const splitPoints: Array<{
    index: number;
    level: number;
    text: string;
    position: number;
  }> = [];

  for (const match of headingMatches) {
    const level = match[1].length;
    if (level <= 3 && match.index !== undefined) {
      // 只用 h1-h3 作为分割点
      splitPoints.push({
        index: match.index,
        level,
        text: match[2],
        position: match.index,
      });
    }
  }

  if (splitPoints.length < 2) {
    return [];
  }

  // 按分割点创建分块
  let currentChunk = "";
  let currentStartIndex = 0;
  let currentHeadingLevel: number | undefined;
  let currentHeadingText: string | undefined;

  for (let i = 0; i < splitPoints.length; i++) {
    const point = splitPoints[i];
    const nextPoint = splitPoints[i + 1];
    const endPosition = nextPoint ? nextPoint.position : content.length;
    const section = content.substring(point.position, endPosition);

    // 检查当前分块是否会超过限制
    if (
      currentChunk.length + section.length > maxChars &&
      currentChunk.length >= minChars
    ) {
      // 保存当前分块
      chunks.push({
        index: chunks.length,
        content: currentChunk.trim(),
        type: "heading",
        charCount: currentChunk.length,
        metadata: {
          headingLevel: currentHeadingLevel,
          headingText: currentHeadingText,
        },
      });

      // 开始新分块
      currentChunk = section;
      currentStartIndex = point.position;
      currentHeadingLevel = point.level;
      currentHeadingText = point.text;
    } else {
      // 继续累积
      if (currentChunk.length === 0) {
        // 第一个分块，包含标题之前的内容
        currentChunk = content.substring(currentStartIndex, endPosition);
        currentHeadingLevel = point.level;
        currentHeadingText = point.text;
      } else {
        currentChunk += section;
      }
    }
  }

  // 添加最后一个分块
  if (currentChunk.length >= minChars) {
    chunks.push({
      index: chunks.length,
      content: currentChunk.trim(),
      type: "heading",
      charCount: currentChunk.length,
      metadata: {
        headingLevel: currentHeadingLevel,
        headingText: currentHeadingText,
      },
    });
  } else if (chunks.length > 0) {
    // 合并到上一个分块
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.content += "\n\n" + currentChunk.trim();
    lastChunk.charCount = lastChunk.content.length;
  }

  return chunks;
}

/**
 * 按段落分割内容，保持代码块完整
 */
function chunkByParagraphs(
  content: string,
  maxChars: number,
  minChars: number,
  preserveCodeBlocks: boolean,
  overlapChars: number,
): ContentChunk[] {
  // 提取并保护代码块
  const codeBlocks: Array<{ placeholder: string; content: string }> = [];
  let processedContent = content;

  if (preserveCodeBlocks) {
    let blockIndex = 0;
    processedContent = content.replace(CODE_BLOCK_REGEX, (match) => {
      const placeholder = `__CODE_BLOCK_${blockIndex}__`;
      codeBlocks.push({ placeholder, content: match });
      blockIndex++;
      return placeholder;
    });
  }

  // 按段落分割
  const paragraphs = processedContent.split(PARAGRAPH_REGEX);
  const chunks: ContentChunk[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const paragraphWithCodeBlocks = restoreCodeBlocks(paragraph, codeBlocks);

    // 检查单个段落是否超过限制
    if (paragraphWithCodeBlocks.length > maxChars) {
      // 先保存当前分块
      if (currentChunk.length >= minChars) {
        chunks.push(createChunk(chunks.length, currentChunk, codeBlocks));
        currentChunk = "";
      }

      // 强制分割超长段落
      const subChunks = forceSplitLongParagraph(
        paragraphWithCodeBlocks,
        maxChars,
        overlapChars,
      );
      for (const subChunk of subChunks) {
        chunks.push({
          index: chunks.length,
          content: subChunk,
          type: "paragraph",
          charCount: subChunk.length,
        });
      }
      continue;
    }

    // 检查是否需要分块
    const potentialChunk = currentChunk
      ? currentChunk + "\n\n" + paragraphWithCodeBlocks
      : paragraphWithCodeBlocks;

    if (potentialChunk.length > maxChars && currentChunk.length >= minChars) {
      // 保存当前分块
      chunks.push(createChunk(chunks.length, currentChunk, codeBlocks));
      // 开始新分块（带重叠）
      currentChunk = addOverlap(
        currentChunk,
        paragraphWithCodeBlocks,
        overlapChars,
      );
    } else {
      currentChunk = potentialChunk;
    }
  }

  // 添加最后一个分块
  if (currentChunk.length > 0) {
    chunks.push(createChunk(chunks.length, currentChunk, codeBlocks));
  }

  return chunks;
}

/**
 * 恢复代码块占位符
 */
function restoreCodeBlocks(
  text: string,
  codeBlocks: Array<{ placeholder: string; content: string }>,
): string {
  let result = text;
  for (const block of codeBlocks) {
    result = result.replace(block.placeholder, block.content);
  }
  return result;
}

/**
 * 创建分块对象
 */
function createChunk(
  index: number,
  content: string,
  codeBlocks: Array<{ placeholder: string; content: string }>,
): ContentChunk {
  const restoredContent = restoreCodeBlocks(content, codeBlocks);
  const hasCode = restoredContent.includes("```");

  return {
    index,
    content: restoredContent.trim(),
    type: hasCode ? "code" : "paragraph",
    charCount: restoredContent.length,
  };
}

/**
 * 强制分割超长段落
 */
function forceSplitLongParagraph(
  paragraph: string,
  maxChars: number,
  overlapChars: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < paragraph.length) {
    let end = start + maxChars;

    // 尝试在句号、换行处断开
    if (end < paragraph.length) {
      const lastPeriod = paragraph.lastIndexOf("。", end);
      const lastNewline = paragraph.lastIndexOf("\n", end);
      const lastBreak = Math.max(lastPeriod, lastNewline);

      if (lastBreak > start + maxChars * 0.5) {
        end = lastBreak + 1;
      }
    }

    chunks.push(paragraph.substring(start, Math.min(end, paragraph.length)));
    start = end - overlapChars; // 带重叠
  }

  return chunks;
}

/**
 * 添加上下文重叠
 */
function addOverlap(
  previousContent: string,
  newContent: string,
  overlapChars: number,
): string {
  if (overlapChars <= 0) {
    return newContent;
  }

  const overlap = previousContent.slice(-overlapChars);
  return overlap + "\n\n" + newContent;
}

// ============================================================================
// 导出
// ============================================================================

export const MdContentChunker = {
  needsChunking,
  chunkContent,
  mergeSummaries,
};
