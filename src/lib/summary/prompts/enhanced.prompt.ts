/**
 * Enhanced Summary Prompt (v3.0)
 *
 * 增强版摘要 Prompt，支持实体提取、关键数据、难度评估
 *
 * @version 3.0.0
 * @since 2025-12-14
 */

import type { ContentType as EnhancedContentType } from "@/lib/classification/types/ai-summary";
import type { EnhancedModeConfig } from "@/lib/classification/config/ai-summary-config";

// 使用增强版内容类型（支持更多类型）
type ContentType = EnhancedContentType;

/**
 * 增强版 System Prompt
 *
 * 包含实体提取、关键数据提取、难度评估的完整指令
 */
export const ENHANCED_SYSTEM_PROMPT = `你是一位专业的内容分析助手，负责为用户收藏的文章生成结构化摘要。

你的任务是：
1. 生成一句话总结（TLDR）
2. 提取 3-5 个关键要点
3. 提取 3-5 个关键词标签
4. 识别文中提及的重要实体（人名、公司、技术、概念等）
5. 提取关键数据（数字、统计、指标等）
6. 评估内容难度
7. 识别内容类型
8. 分析情感倾向

请严格按照以下 JSON 格式输出，不要包含任何其他文字或代码块标记：

{
  "tldr": "一句话总结（50字以内）",
  "key_points": ["要点1", "要点2", "要点3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "sentiment": "positive|neutral|negative",
  "reading_time": 5,
  "entities": [
    {"name": "实体名称", "type": "person|company|tech|concept|product|place|other", "confidence": 0.9}
  ],
  "key_data": [
    {"label": "数据标签", "value": "数值", "unit": "单位（可选）", "context": "上下文说明（可选）"}
  ],
  "difficulty": "easy|medium|hard",
  "content_type": "article|tutorial|news|opinion|reference|video|tool|case_study|unknown",
  "action_items": ["可选的行动建议1", "可选的行动建议2"]
}

## 实体类型说明：
- person: 人名（作者、专家、历史人物等）
- company: 公司或组织（Google、微软、OpenAI等）
- tech: 技术或框架（React、Python、Kubernetes等）
- concept: 概念或术语（机器学习、微服务、函数式编程等）
- product: 产品（iPhone、ChatGPT、VS Code等）
- place: 地点（硅谷、北京、AWS区域等）
- other: 其他重要实体

## 关键数据说明：
- 提取文中出现的重要数字、统计数据、性能指标等
- 必须包含数值的具体含义（label）和数值本身（value）
- 如果有单位（如 ms、%、MB），请填写 unit 字段
- context 用于提供额外的说明（可选）

## 难度评估标准：
- easy: 入门级，无需专业背景，适合所有读者
- medium: 中等，需要一定基础知识，适合有一定经验的读者
- hard: 高级，需要深厚专业知识，适合专家

## 内容类型说明：
- article: 一般性文章或博客
- tutorial: 教程或指南（包含步骤说明）
- news: 新闻报道或资讯
- opinion: 观点文章或评论
- reference: 参考文档或 API 文档
- video: 视频内容描述
- tool: 工具介绍或评测
- case_study: 案例分析
- unknown: 无法确定`;

/**
 * 精简版 System Prompt（用于部分功能禁用时）
 */
export const ENHANCED_SYSTEM_PROMPT_LITE = `你是一位专业的内容分析助手，负责为用户收藏的文章生成结构化摘要。

你的任务是：
1. 生成一句话总结（TLDR）
2. 提取 3-5 个关键要点
3. 提取 3-5 个关键词标签
4. 识别文中提及的重要实体
5. 分析情感倾向

请严格按照以下 JSON 格式输出，不要包含任何其他文字或代码块标记：

{
  "tldr": "一句话总结（50字以内）",
  "key_points": ["要点1", "要点2", "要点3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "sentiment": "positive|neutral|negative",
  "reading_time": 5,
  "entities": [
    {"name": "实体名称", "type": "person|company|tech|concept|product|place|other", "confidence": 0.9}
  ]
}`;

/**
 * 增强版 Prompt 配置
 */
export interface EnhancedPromptConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  responseFormat: "json";
}

/**
 * 获取增强版 Prompt 配置
 *
 * @param contentType - 内容类型
 * @param enhancedConfig - 增强模式配置
 */
export function getEnhancedPromptConfig(
  contentType: ContentType = "article",
  enhancedConfig?: EnhancedModeConfig,
): EnhancedPromptConfig {
  // 根据配置决定使用完整版还是精简版 Prompt
  const useFullPrompt =
    enhancedConfig?.extractKeyData || enhancedConfig?.evaluateDifficulty;

  // 根据内容类型调整温度
  const temperatureMap: Record<ContentType, number> = {
    article: 0.5,
    tutorial: 0.3, // 教程需要更精确
    news: 0.4,
    opinion: 0.6,
    reference: 0.2, // 参考文档需要最精确
    video: 0.5,
    tool: 0.3,
    case_study: 0.4,
    unknown: 0.5,
  };

  return {
    systemPrompt: useFullPrompt
      ? ENHANCED_SYSTEM_PROMPT
      : ENHANCED_SYSTEM_PROMPT_LITE,
    temperature: temperatureMap[contentType] ?? 0.5,
    maxTokens: 2500, // 增强版需要更多输出空间
    responseFormat: "json",
  };
}

/**
 * 构建增强版 User Prompt
 *
 * @param title - 文章标题
 * @param description - 文章描述
 * @param content - 文章内容
 * @param existingFolderNames - 现有文件夹名称（用于标签参考）
 * @param enhancedConfig - 增强模式配置
 */
export function buildEnhancedUserPrompt(
  title: string,
  description: string | undefined,
  content: string | undefined,
  existingFolderNames?: string[],
  enhancedConfig?: EnhancedModeConfig,
): string {
  const parts: string[] = [];

  // 标题
  parts.push(`## 文章标题\n${title}`);

  // 描述（如果有）
  if (description) {
    parts.push(`## 文章描述\n${description}`);
  }

  // 内容（如果有）
  if (content) {
    // 限制内容长度，避免超过 Token 限制
    const maxContentLength = 8000;
    const truncatedContent =
      content.length > maxContentLength
        ? content.substring(0, maxContentLength) + "\n\n[内容已截断...]"
        : content;

    parts.push(`## 文章内容\n${truncatedContent}`);
  }

  // 现有文件夹（用于标签参考）
  if (existingFolderNames && existingFolderNames.length > 0) {
    parts.push(
      `## 现有分类（可参考用于生成相关标签）\n${existingFolderNames.join("、")}`,
    );
  }

  // 配置说明
  const configInstructions: string[] = [];

  if (enhancedConfig) {
    if (enhancedConfig.maxEntities) {
      configInstructions.push(
        `- 最多提取 ${enhancedConfig.maxEntities} 个实体`,
      );
    }
    if (enhancedConfig.maxKeyData) {
      configInstructions.push(
        `- 最多提取 ${enhancedConfig.maxKeyData} 条关键数据`,
      );
    }
    if (enhancedConfig.entityConfidenceThreshold) {
      configInstructions.push(
        `- 实体置信度阈值: ${enhancedConfig.entityConfidenceThreshold}（低于此值请不要输出）`,
      );
    }
    if (!enhancedConfig.extractEntities) {
      configInstructions.push("- 不需要提取实体，entities 字段返回空数组");
    }
    if (!enhancedConfig.extractKeyData) {
      configInstructions.push("- 不需要提取关键数据，key_data 字段返回空数组");
    }
    if (!enhancedConfig.evaluateDifficulty) {
      configInstructions.push(
        '- 不需要评估难度，difficulty 字段返回 "unknown"',
      );
    }
    if (!enhancedConfig.identifyContentType) {
      configInstructions.push(
        '- 不需要识别内容类型，content_type 字段返回 "unknown"',
      );
    }
  }

  if (configInstructions.length > 0) {
    parts.push(`## 特殊要求\n${configInstructions.join("\n")}`);
  }

  // 最终指令
  parts.push(
    "\n请根据以上内容生成结构化摘要，严格按照 JSON 格式输出，不要包含任何额外的解释或代码块标记。",
  );

  return parts.join("\n\n");
}

/**
 * 内容类型关键词映射（用于辅助识别）
 */
export const CONTENT_TYPE_KEYWORDS: Record<ContentType, string[]> = {
  article: ["文章", "博客", "分享", "随笔"],
  tutorial: [
    "教程",
    "指南",
    "入门",
    "实战",
    "手把手",
    "step by step",
    "how to",
  ],
  news: ["新闻", "报道", "资讯", "发布", "宣布", "最新"],
  opinion: ["观点", "评论", "思考", "我认为", "个人看法"],
  reference: ["文档", "API", "参考", "手册", "规范", "docs"],
  video: ["视频", "播客", "YouTube", "B站", "bilibili"],
  tool: ["工具", "软件", "推荐", "效率", "神器"],
  case_study: ["案例", "实践", "经验", "复盘", "总结"],
  unknown: [],
};
