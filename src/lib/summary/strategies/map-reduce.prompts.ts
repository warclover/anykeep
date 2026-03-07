/**
 * MapReduce 摘要策略专用 Prompt
 *
 * Map 阶段：提炼各段要点
 * Reduce 阶段：聚合全局摘要
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { NEGATIVE_CONSTRAINTS_LITE } from "../prompts/negative-constraints";

/**
 * Map 阶段 System Prompt
 */
export const MAP_SYSTEM_PROMPT = `你是一位精准的内容分析助手。你的任务是从给定的文本段落中提取核心信息要点。
只提取原文中明确存在的信息，不要推测或编造。
必须输出严格的 JSON 格式，不要任何额外文字或代码块标记。`;

/**
 * 构建 Map 阶段 User Prompt
 *
 * @param chunkContent - 段落内容
 * @param chunkIndex - 段落索引
 * @param totalChunks - 总段落数
 * @param articleTitle - 文章标题（提供上下文）
 */
export function buildMapUserPrompt(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number,
  articleTitle: string,
): string {
  return `【文章标题】${articleTitle}
【当前段落】第 ${chunkIndex + 1}/${totalChunks} 段

${chunkContent}

请提取本段核心内容，输出 JSON：
{
  "key_points": ["要点1", "要点2"],
  "entities_mentioned": ["文中提到的实体名称"]
}

要求：
- key_points 不超过 3 个，每个要点包含具体信息
- entities_mentioned 仅列出文中明确出现的人名、公司、技术、产品等
${NEGATIVE_CONSTRAINTS_LITE}`;
}

/**
 * Reduce 阶段 System Prompt
 */
export const REDUCE_SYSTEM_PROMPT = `你是一位专业的内容编辑，擅长将多个段落的要点信息整合为一篇完整的结构化摘要。
你需要：
1. 去除重复信息
2. 按重要性排序
3. 生成一句话总结（TLDR）
4. 整合为连贯的关键要点列表
必须输出严格的 JSON 格式，不要任何额外文字或代码块标记。`;

/**
 * 构建 Reduce 阶段 User Prompt
 *
 * @param chunkSummaries - 各段要点汇总
 * @param articleTitle - 文章标题
 * @param totalWordCount - 原文总字数（估算）
 */
export function buildReduceUserPrompt(
  chunkSummaries: Array<{ chunkIndex: number; keyPoints: string[] }>,
  articleTitle: string,
  totalWordCount?: number,
): string {
  const summaryList = chunkSummaries
    .map(
      (cs) =>
        `--- 第 ${cs.chunkIndex + 1} 段 ---\n${cs.keyPoints.map((p) => `- ${p}`).join("\n")}`,
    )
    .join("\n\n");

  const readingTimeEstimate = totalWordCount
    ? Math.ceil(totalWordCount / 400)
    : 5;

  return `以下是一篇长文各段落的核心要点摘录。请基于这些要点，生成完整的结构化摘要。

【文章标题】${articleTitle}
${totalWordCount ? `【原文字数】约 ${totalWordCount} 字` : ""}

【各段要点】
${summaryList}

请整合上述信息，输出完整的 JSON 摘要：
{
  "tldr": "一句话总结（不超过50字），直击核心价值",
  "key_points": [
    "关键要点1（去重后的核心信息）",
    "关键要点2",
    "关键要点3"
  ],
  "keywords": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "sentiment": "positive|neutral|negative",
  "reading_time": ${readingTimeEstimate},
  "action_items": []
}

【要求】
- tldr 不超过 50 字，直接说明核心价值
- key_points 3-5 个，每个包含具体信息，不要空泛概述
- keywords 5 个，至少 1 个领域标签 + 1 个主题标签
- 如果原文是教程/指南类，action_items 列出 3-5 个可执行步骤
- 所有信息必须来自上述要点，不要编造`;
}
