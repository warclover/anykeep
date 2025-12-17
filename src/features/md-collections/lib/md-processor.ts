/**
 * MD 收藏功能 - Markdown 预处理器
 * P2-007: Markdown 内容收藏
 */

import { createHash } from "crypto";
import type { MdPreprocessResult } from "../types";

/**
 * 预处理 Markdown 内容用于 AI 分析
 * - 提取标题
 * - 统计字数和代码块
 * - 替换代码块为占位符（减少 token）
 */
export function preprocessMarkdownForAI(content: string): MdPreprocessResult {
  let processedText = content;

  // 1. 提取标题（第一个 # 开头的行）
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const extractedTitle = titleMatch ? titleMatch[1].trim() : null;

  // 2. 统计代码块
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const codeBlockCount = codeBlocks.length;

  // 3. 替换代码块为占位符（减少 AI 处理 token）
  processedText = processedText.replace(
    /```(\w+)?\n[\s\S]*?```/g,
    (_, lang) => `[代码块: ${lang || "代码"}]`,
  );

  // 4. 替换行内代码
  processedText = processedText.replace(/`[^`]+`/g, "[代码]");

  // 5. 计算字数
  const pureText = processedText
    .replace(/\[代码块:.*?\]/g, "")
    .replace(/\[代码\]/g, "")
    .trim();

  const wordCount = countWords(pureText);
  const readingTimeMinutes = Math.ceil(wordCount / 200); // 假设阅读速度 200 字/分钟

  return {
    processedText: processedText.trim(),
    metadata: {
      wordCount,
      codeBlockCount,
      readingTimeMinutes,
      extractedTitle,
    },
  };
}

/**
 * 统计字数（支持中英文混合）
 */
export function countWords(text: string): number {
  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 统计英文单词
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return chineseChars + englishWords;
}

/**
 * 计算内容的 SHA-256 哈希值（用于去重）
 */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 从 Markdown 内容中提取标题
 */
export function extractTitle(content: string): string | null {
  // 尝试匹配 # 标题
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // 尝试匹配第一行非空文本
  const firstLine = content.trim().split("\n")[0];
  if (firstLine && firstLine.length <= 100) {
    return firstLine.replace(/^#+\s*/, "").trim();
  }

  return null;
}

/**
 * 截断内容用于预览
 */
export function truncateContent(
  content: string,
  maxLength: number = 200,
): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength).trim() + "...";
}

/**
 * 验证 Markdown 内容
 */
export function validateMarkdownContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || typeof content !== "string") {
    return { valid: false, error: "内容不能为空" };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "内容不能为空" };
  }

  if (trimmed.length > 100 * 1024) {
    return { valid: false, error: "内容超过 100KB 限制" };
  }

  return { valid: true };
}

/**
 * 清理 Markdown 内容（移除潜在危险内容）
 */
export function sanitizeMarkdownContent(content: string): string {
  let sanitized = content;

  // 移除 script 标签
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, "");

  // 移除 on* 事件属性
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");

  // 移除 javascript: 协议
  sanitized = sanitized.replace(/javascript:/gi, "");

  return sanitized;
}

/**
 * 生成摘要片段（用于搜索结果展示）
 */
export function generateSnippet(
  content: string,
  query: string,
  maxLength: number = 200,
): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // 尝试找到查询词的位置
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    // 未找到，返回开头部分
    return truncateContent(content, maxLength);
  }

  // 在查询词周围截取
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + query.length + 150);

  let snippet = content.substring(start, end);

  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < content.length) {
    snippet = snippet + "...";
  }

  return snippet;
}
