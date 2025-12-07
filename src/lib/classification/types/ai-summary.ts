/**
 * AI Summary Types
 *
 * 结构化 AI 摘要类型定义
 *
 * @version 2.0.0
 * @since 2025-12-06
 */

/**
 * 情感倾向枚举
 */
export type Sentiment = "positive" | "neutral" | "negative";

/**
 * 结构化 AI 摘要结果
 *
 * 新版 JSON 格式，包含丰富的语义字段
 */
export interface StructuredSummary {
  /**
   * 一句话总结 (TL;DR)
   * ≤50 字，直击核心价值
   */
  tldr: string;

  /**
   * 关键要点列表
   * 3-5 个核心信息点
   */
  key_points: string[];

  /**
   * 核心关键词/标签
   * 5 个标签，用于搜索和分类
   */
  keywords: string[];

  /**
   * 情感倾向
   * 帮助用户快速判断内容基调
   */
  sentiment: Sentiment;

  /**
   * 预计阅读时间（分钟）
   */
  reading_time: number;

  /**
   * 可执行行动项（仅教程类内容）
   * 如果内容包含教程或建议，列出可执行步骤
   */
  action_items?: string[];
}

/**
 * AI 摘要存储格式
 *
 * 兼容旧版纯文本和新版 JSON
 */
export interface AISummaryData {
  /**
   * 格式版本
   * - 1: 纯文本格式（旧版）
   * - 2: JSON 结构化格式（新版）
   */
  version: 1 | 2;

  /**
   * 摘要内容
   * - version 1: 纯文本字符串
   * - version 2: StructuredSummary 对象
   */
  content: string | StructuredSummary;
}

/**
 * 判断摘要是否为新版 JSON 格式
 *
 * 检测逻辑：
 * 1. 尝试 JSON 解析
 * 2. 验证必须字段存在
 */
export function isStructuredSummary(summary: string): boolean {
  if (!summary || typeof summary !== "string") {
    return false;
  }

  // 快速检测：不以 { 开头的肯定不是 JSON
  const trimmed = summary.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    // 验证必须字段
    return (
      typeof parsed.tldr === "string" &&
      Array.isArray(parsed.key_points) &&
      Array.isArray(parsed.keywords)
    );
  } catch {
    return false;
  }
}

/**
 * 解析结构化摘要
 *
 * @param summary - 摘要字符串（可能是纯文本或 JSON）
 * @returns 解析结果，失败返回 null
 */
export function parseStructuredSummary(
  summary: string,
): StructuredSummary | null {
  if (!summary || typeof summary !== "string") {
    return null;
  }

  const trimmed = summary.trim();

  // 尝试 JSON 解析
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);

      // 验证并规范化字段
      if (typeof parsed.tldr === "string" && Array.isArray(parsed.key_points)) {
        return {
          tldr: parsed.tldr,
          key_points: parsed.key_points.filter(
            (p: unknown) => typeof p === "string",
          ),
          keywords: Array.isArray(parsed.keywords)
            ? parsed.keywords.filter((k: unknown) => typeof k === "string")
            : [],
          sentiment: validateSentiment(parsed.sentiment),
          reading_time:
            typeof parsed.reading_time === "number" ? parsed.reading_time : 5,
          action_items: Array.isArray(parsed.action_items)
            ? parsed.action_items.filter((a: unknown) => typeof a === "string")
            : undefined,
        };
      }
    } catch {
      // JSON 解析失败，返回 null
    }
  }

  return null;
}

/**
 * 验证情感值
 */
function validateSentiment(value: unknown): Sentiment {
  if (value === "positive" || value === "neutral" || value === "negative") {
    return value;
  }
  return "neutral";
}

/**
 * 获取 AI 摘要的显示文本
 *
 * 支持新版 JSON 格式（提取 tldr）和旧版纯文本格式
 * 用于卡片预览、列表视图等场景
 *
 * @param aiSummary - AI 摘要字符串（可能是 JSON 或纯文本）
 * @returns 显示用的摘要文本，如果无法解析则返回 null
 *
 * @example
 * ```typescript
 * const summary = getDisplaySummary(bookmark.ai_summary);
 * if (summary) {
 *   // 显示摘要
 * }
 * ```
 */
export function getDisplaySummary(
  aiSummary: string | null | undefined,
): string | null {
  if (!aiSummary) return null;

  // 尝试解析为结构化摘要（JSON 格式）
  const structured = parseStructuredSummary(aiSummary);
  if (structured) {
    return structured.tldr;
  }

  // 旧版纯文本格式，直接返回
  return aiSummary;
}

/**
 * 将结构化摘要转换为纯文本格式
 *
 * 用于兼容旧版显示逻辑
 *
 * @param structured - 结构化摘要
 * @returns 纯文本摘要
 */
export function structuredToText(structured: StructuredSummary): string {
  const parts: string[] = [];

  // TL;DR 作为核心主旨
  parts.push(structured.tldr);

  // 关键要点转换为编号列表
  if (structured.key_points.length > 0) {
    const pointsList = structured.key_points
      .map((point, idx) => `${idx + 1}）${point}`)
      .join("；");
    parts.push(pointsList);
  }

  return parts.join("。");
}

/**
 * 解码 HTML 实体
 * AI 输出有时会包含 HTML 编码的字符
 */
function decodeHtmlEntities(str: string): string {
  return (
    str
      // 十六进制编码 \x26quot; -> "
      .replace(/\\x26quot;/g, '"')
      .replace(/\\x26amp;/g, "&")
      .replace(/\\x26lt;/g, "<")
      .replace(/\\x26gt;/g, ">")
      // HTML 实体编码 &quot; -> "
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      // 处理 Unicode 编码的引号
      .replace(/\\u0026quot;/g, '"')
      .replace(/\\u0026/g, "&")
  );
}

/**
 * 尝试修复不完整的 JSON
 *
 * AI 有时会输出不完整的 JSON，尝试修复常见问题：
 * 1. 缺少结尾的 }
 * 2. 字符串未闭合
 * 3. 数组未闭合
 * 4. HTML 实体编码
 */
export function tryFixJson(jsonString: string): string {
  let fixed = jsonString.trim();

  // 移除可能的 markdown 代码块标记
  fixed = fixed.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");

  // 解码 HTML 实体
  fixed = decodeHtmlEntities(fixed);

  // 计算括号平衡
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;

  // 补充缺失的括号
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += "]";
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += "}";
  }

  // 尝试修复未闭合的字符串
  // 检查最后一个字符
  const lastChar = fixed[fixed.length - 1];
  if (lastChar !== "}" && lastChar !== "]" && lastChar !== '"') {
    // 可能字符串未闭合
    const lastQuoteIndex = fixed.lastIndexOf('"');
    const colonAfterQuote = fixed.indexOf(":", lastQuoteIndex);
    if (colonAfterQuote === -1 && lastQuoteIndex > 0) {
      // 可能是值未闭合
      fixed += '"';
    }
  }

  return fixed;
}

/**
 * 安全解析 JSON，带修复尝试
 *
 * @param jsonString - 可能不完整的 JSON 字符串
 * @returns 解析结果或 null
 */
export function safeParseJson<T>(jsonString: string): T | null {
  // 第一次尝试：直接解析
  try {
    return JSON.parse(jsonString.trim());
  } catch {
    // 继续尝试修复
  }

  // 第二次尝试：解码 HTML 实体后解析
  try {
    const decoded = decodeHtmlEntities(jsonString.trim());
    return JSON.parse(decoded);
  } catch {
    // 继续尝试修复
  }

  // 第三次尝试：完整修复后解析
  try {
    const fixed = tryFixJson(jsonString);
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}
