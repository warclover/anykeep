/**
 * 回退内容生成器
 *
 * 当 AI 服务不可用时的规则化回退方案
 *
 * @module ai-generator/content/fallback-generator
 * @version 1.0.0
 */

import type { AIGenerateResult } from "../types";

/**
 * 根据原文字数计算摘要上限
 *
 * - < 1000 字：100-200 字摘要
 * - 1000-5000 字：300-500 字摘要
 * - > 5000 字：500-800 字摘要
 */
export function getSummaryLimit(contentLength: number): {
  min: number;
  max: number;
} {
  if (contentLength < 1000) {
    return { min: 100, max: 200 };
  } else if (contentLength <= 5000) {
    return { min: 300, max: 500 };
  } else {
    return { min: 500, max: 800 };
  }
}

/**
 * 生成基于规则的简单摘要和标签（回退方案）
 *
 * 根据内容长度动态调整摘要上限
 */
export function generateFallbackContent(
  title: string,
  description?: string,
  content?: string,
): AIGenerateResult {
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { max } = getSummaryLimit(contentLength);

  let summary = title;

  if (description && description.length > title.length) {
    summary =
      description.length > max
        ? description.substring(0, max) + "..."
        : description;
  }

  const tags: string[] = [];
  const keywords = [
    "学习",
    "技术",
    "产品",
    "设计",
    "运营",
    "营销",
    "管理",
    "创业",
    "投资",
    "生活",
  ];

  keywords.forEach((keyword) => {
    if (title.includes(keyword) || description?.includes(keyword)) {
      tags.push(keyword);
    }
  });

  // 无匹配关键词时不写入无意义的通用标签（如「收藏」「阅读」），保持空数组由用户或后续重试补充
  // if (tags.length === 0) { tags.push("收藏", "阅读"); } — 已移除

  return {
    summary: summary.substring(0, max),
    tags: tags.slice(0, 5),
  };
}
