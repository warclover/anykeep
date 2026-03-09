/**
 * AI 响应解析器
 *
 * 解析 DeepSeek API 返回的 JSON 响应
 *
 * @module ai-generator/api/response-parser
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import { isSummaryComplete } from "@/lib/utils/content-extractor";
import {
  safeParseJson,
  type StructuredSummary,
} from "@/lib/summary/types/ai-summary";
import type { AIGenerateResult } from "../types";

/**
 * 解析 V2 结构化 JSON 响应
 *
 * V2 输出格式：
 * {
 *   "tldr": "一句话总结",
 *   "key_points": ["要点1", "要点2"],
 *   "keywords": ["标签1", "标签2"],
 *   "sentiment": "positive|neutral|negative",
 *   "reading_time": 5,
 *   "action_items": ["步骤1", "步骤2"]
 * }
 */
export function parseAIResponseV2(content: string): AIGenerateResult {
  try {
    const cleaned = content
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = safeParseJson<StructuredSummary>(cleaned);

    if (!parsed) {
      logger.warn(
        {
          rawContent: cleaned.substring(0, 200),
          action: "parse_v2_json_failed",
        },
        "AI Generator: V2 JSON parse failed, falling back to V1",
      );
      return parseAIResponse(content);
    }

    if (!parsed.tldr || !Array.isArray(parsed.key_points)) {
      logger.warn(
        {
          hasTldr: !!parsed.tldr,
          hasKeyPoints: Array.isArray(parsed.key_points),
          action: "parse_v2_invalid_structure",
        },
        "AI Generator: V2 structure invalid, falling back to V1",
      );
      return parseAIResponse(content);
    }

    // 兼容 API 返回 keywords 或 tags 字段（部分模型会返回 tags）
    const rawTags = Array.isArray(parsed.keywords)
      ? parsed.keywords
      : Array.isArray((parsed as unknown as { tags?: unknown }).tags)
        ? (parsed as unknown as { tags: unknown[] }).tags
        : [];
    const tags = rawTags
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, 5);

    const summaryJson = JSON.stringify({
      tldr: parsed.tldr,
      key_points: parsed.key_points.filter(
        (p): p is string => typeof p === "string",
      ),
      keywords: tags,
      sentiment: parsed.sentiment || "neutral",
      reading_time:
        typeof parsed.reading_time === "number" ? parsed.reading_time : 5,
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.filter((a): a is string => typeof a === "string")
        : undefined,
    });

    logger.info(
      {
        tldrLength: parsed.tldr.length,
        keyPointsCount: parsed.key_points.length,
        tagsCount: tags.length,
        hasActionItems: !!parsed.action_items?.length,
        action: "parse_v2_success",
      },
      "AI Generator: V2 JSON parsed successfully",
    );

    return {
      summary: summaryJson,
      tags,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content.substring(0, 200),
        action: "parse_v2_error",
      },
      "AI Generator: V2 parse error, falling back to V1",
    );
    return parseAIResponse(content);
  }
}

/**
 * 解析 V1 AI 返回的内容（传统纯文本格式）
 */
export function parseAIResponse(content: string): AIGenerateResult {
  try {
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleaned);

    if (!result.summary || typeof result.summary !== "string") {
      throw new Error("Invalid summary format");
    }

    if (!Array.isArray(result.tags) || result.tags.length === 0) {
      throw new Error("Invalid tags format");
    }

    const tags = (result.tags as unknown[])
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tags.length === 0) {
      throw new Error("No valid tags found");
    }

    const trimmedSummary = result.summary.trim();

    if (!isSummaryComplete(trimmedSummary)) {
      logger.warn(
        {
          summaryLength: trimmedSummary.length,
          lastChars: trimmedSummary.slice(-20),
          action: "summary_incomplete_detected",
        },
        "AI Generator: Summary may be truncated",
      );
    }

    return {
      summary: trimmedSummary,
      tags: tags.slice(0, 5),
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
        action: "parse_ai_response",
      },
      "AI Generator: Parse response error",
    );
    throw new Error("解析 AI 响应失败");
  }
}
