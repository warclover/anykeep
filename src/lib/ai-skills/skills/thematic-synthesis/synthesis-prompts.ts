/**
 * 主题合成器 LLM Prompt 模板
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { SynthesisDepthMode } from "@/lib/synthesis";

// ============================================
// 深度模式配置
// ============================================

interface DepthModeConfig {
  overviewWords: [number, number];
  maxConsensus: number;
  maxDivergence: number;
  maxBlindSpots: number;
  analysisDepth: string;
}

export const DEPTH_MODE_CONFIGS: Record<SynthesisDepthMode, DepthModeConfig> = {
  quick: {
    overviewWords: [50, 150],
    maxConsensus: 3,
    maxDivergence: 2,
    maxBlindSpots: 2,
    analysisDepth: "简要",
  },
  standard: {
    overviewWords: [300, 500],
    maxConsensus: 7,
    maxDivergence: 4,
    maxBlindSpots: 4,
    analysisDepth: "深入",
  },
  academic: {
    overviewWords: [800, 1200],
    maxConsensus: 10,
    maxDivergence: 5,
    maxBlindSpots: 5,
    analysisDepth: "学术级详细",
  },
};

// ============================================
// 主题分析 Prompt
// ============================================

export const TOPIC_ANALYSIS_PROMPT = `你是一位资深的知识管理专家，擅长从多个信息源中识别核心主题和关系模式。

## 任务
分析以下 {count} 篇收藏内容，识别其共同主题和结构。

## 输入内容
{documents}

## 分析要求
1. 识别 2-5 个核心主题群（Topic Clusters）
2. 提取关键实体（人物、概念、技术、组织等）
3. 分析内容的领域分布和时间特征

## 输出格式（严格 JSON）
\`\`\`json
{
  "topicClusters": [
    {
      "id": "cluster_1",
      "name": "主题名称（2-6字）",
      "description": "主题描述（一句话）",
      "relatedBookmarkIds": ["id1", "id2"],
      "weight": 0.8,
      "keywords": ["关键词1", "关键词2"]
    }
  ],
  "keyEntities": [
    {
      "name": "实体名称",
      "type": "person|concept|technology|organization|event",
      "mentions": 5,
      "relatedClusters": ["cluster_1"]
    }
  ],
  "domainSummary": "领域概述（一句话）"
}
\`\`\`

只输出 JSON，不要有任何其他解释。`;

// ============================================
// 概述与共识生成 Prompt
// ============================================

export const SYNTHESIS_PROMPT = `你是一位专业的内容综合专家，擅长从多个来源中提炼核心观点和共识。

## 任务
基于以下 {count} 篇关于「{topic}」的内容，生成综合概述和核心共识点。

## 主题分析
{topicAnalysis}

## 输入内容
{documents}

## 生成要求
1. 概述：{overviewWordsMin}-{overviewWordsMax} 字，涵盖主要发现
2. 共识点：提取 3-{maxConsensus} 个多来源支持的观点
3. 每个共识点需标注来源和置信度

## 置信度评估标准
- 0.9-1.0: 多个来源明确支持，无争议
- 0.7-0.9: 多数来源支持，有细节差异
- 0.5-0.7: 部分来源支持，需要验证

## 输出格式（严格 JSON）
\`\`\`json
{
  "overview": "综合概述内容...",
  "consensus": [
    {
      "point": "共识观点描述（一句话）",
      "confidence": 0.85,
      "sources": [
        {
          "bookmarkId": "id1",
          "title": "来源标题",
          "quote": "支持此观点的原文片段（可选，不超过50字）"
        }
      ],
      "reasoning": "为什么这是共识（简短说明）"
    }
  ]
}
\`\`\`

只输出 JSON，不要有任何其他解释。`;

// ============================================
// 分歧检测 Prompt
// ============================================

export const DIVERGENCE_PROMPT = `你是一位批判性思维专家，擅长识别不同来源之间的观点差异和潜在冲突。

## 任务
分析以下关于「{topic}」的内容，识别观点分歧。

## 已识别的共识
{consensusPoints}

## 输入内容
{documents}

## 分析要求
1. 寻找相互矛盾或对立的观点
2. 识别隐含的假设差异
3. 对每个分歧提供中立分析
4. 最多识别 {maxDivergence} 个分歧点

## 分歧类型
- 事实分歧：对事实的描述不一致
- 解释分歧：对同一现象的解释不同
- 价值分歧：基于不同价值判断
- 方法分歧：推荐的做法不同

## 输出格式（严格 JSON）
\`\`\`json
{
  "divergence": [
    {
      "topic": "分歧话题（2-10字）",
      "type": "factual|interpretation|value|method",
      "point_a": "观点A描述",
      "point_b": "观点B描述",
      "sources_a": [
        {"bookmarkId": "id1", "title": "来源标题"}
      ],
      "sources_b": [
        {"bookmarkId": "id2", "title": "来源标题"}
      ],
      "analysis": "客观分析为什么会有这种分歧（2-3句话）"
    }
  ]
}
\`\`\`

如果没有明显分歧，返回空数组。只输出 JSON，不要有任何其他解释。`;

// ============================================
// 盲区发现 Prompt
// ============================================

export const BLINDSPOT_PROMPT = `你是一位研究方法论专家，擅长识别信息收集中的缺口和盲区。

## 任务
分析以下关于「{topic}」的内容，发现知识盲区和研究机会。

## 已识别的共识与分歧
共识：{consensusPoints}
分歧：{divergencePoints}

## 输入内容摘要
来源数量：{sourceCount}
平台分布：{platformDistribution}
主题分布：{topicClusters}

## 分析维度
1. **覆盖缺口**：哪些相关子话题完全未被涉及？
2. **视角缺失**：是否缺少某类观点（如学术 vs 实践、乐观 vs 谨慎）？
3. **时效盲区**：是否缺少最新发展的信息？
4. **深度不足**：哪些话题只被浅尝辄止？

## 输出格式（严格 JSON）
\`\`\`json
{
  "blindSpots": [
    {
      "topic": "盲区话题（2-10字）",
      "type": "coverage|perspective|recency|depth",
      "description": "盲区描述（一句话）",
      "suggestion": "建议补充的内容方向",
      "search_keywords": ["建议搜索关键词1", "关键词2"]
    }
  ]
}
\`\`\`

最多返回 {maxBlindSpots} 个盲区。只输出 JSON，不要有任何其他解释。`;

// ============================================
// Prompt 构建函数
// ============================================

interface BookmarkForPrompt {
  id: string;
  title: string;
  content: string;
  platform: string;
}

/**
 * 构建主题分析 Prompt
 */
export function buildTopicAnalysisPrompt(
  bookmarks: BookmarkForPrompt[],
): string {
  const documents = bookmarks
    .map(
      (b, i) => `### 【${i + 1}】${b.title} [ID: ${b.id}]
平台：${b.platform}
内容：${b.content}`,
    )
    .join("\n\n---\n\n");

  return TOPIC_ANALYSIS_PROMPT.replace(
    "{count}",
    String(bookmarks.length),
  ).replace("{documents}", documents);
}

/**
 * 构建概述与共识 Prompt
 */
export function buildSynthesisPrompt(
  bookmarks: BookmarkForPrompt[],
  topic: string,
  topicAnalysis: string,
  depthMode: SynthesisDepthMode,
): string {
  const config = DEPTH_MODE_CONFIGS[depthMode];
  const documents = bookmarks
    .map(
      (b, i) => `### 【${i + 1}】${b.title} [ID: ${b.id}]
${b.content}`,
    )
    .join("\n\n---\n\n");

  return SYNTHESIS_PROMPT.replace("{count}", String(bookmarks.length))
    .replace("{topic}", topic)
    .replace("{topicAnalysis}", topicAnalysis)
    .replace("{documents}", documents)
    .replace("{overviewWordsMin}", String(config.overviewWords[0]))
    .replace("{overviewWordsMax}", String(config.overviewWords[1]))
    .replace("{maxConsensus}", String(config.maxConsensus));
}

/**
 * 构建分歧检测 Prompt
 */
export function buildDivergencePrompt(
  bookmarks: BookmarkForPrompt[],
  topic: string,
  consensusPoints: string,
  depthMode: SynthesisDepthMode,
): string {
  const config = DEPTH_MODE_CONFIGS[depthMode];
  const documents = bookmarks
    .map(
      (b, i) =>
        `【${i + 1}】${b.title} [ID: ${b.id}]: ${b.content.substring(0, 500)}`,
    )
    .join("\n\n");

  return DIVERGENCE_PROMPT.replace("{topic}", topic)
    .replace("{consensusPoints}", consensusPoints)
    .replace("{documents}", documents)
    .replace("{maxDivergence}", String(config.maxDivergence));
}

/**
 * 构建盲区发现 Prompt
 */
export function buildBlindspotPrompt(
  topic: string,
  consensusPoints: string,
  divergencePoints: string,
  sourceCount: number,
  platformDistribution: Record<string, number>,
  topicClusters: string,
  depthMode: SynthesisDepthMode,
): string {
  const config = DEPTH_MODE_CONFIGS[depthMode];

  const platformStr = Object.entries(platformDistribution)
    .map(([p, c]) => `${p}: ${c}篇`)
    .join(", ");

  return BLINDSPOT_PROMPT.replace("{topic}", topic)
    .replace("{consensusPoints}", consensusPoints)
    .replace("{divergencePoints}", divergencePoints)
    .replace("{sourceCount}", String(sourceCount))
    .replace("{platformDistribution}", platformStr)
    .replace("{topicClusters}", topicClusters)
    .replace("{maxBlindSpots}", String(config.maxBlindSpots));
}
