/**
 * Type-Specific Summary Prompts V2
 * JSON 结构化输出版本
 *
 * 从 classification-v1 迁移，去除归档依赖
 *
 * 与 V1 版本的区别：
 * - 输出格式从纯文本升级为 JSON
 * - 增加 tldr、sentiment、reading_time、action_items 字段
 * - 更强的输出格式约束
 *
 * @version 2.0.0
 * @since 2025-12-06
 */

import type { ContentType } from "@/lib/summary/content-type-detector";

/**
 * Summary length configuration
 */
export interface SummaryLengthConfig {
  min: number;
  max: number;
}

/**
 * V2 Prompt configuration
 */
export interface TypePromptConfigV2 {
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  getSummaryLength: (contentLength: number) => SummaryLengthConfig;
}

// ============================================================
// Common JSON Output Schema
// ============================================================

const JSON_OUTPUT_SCHEMA = `{
  "tldr": "核心摘要，不超过150字，概括核心观点及其价值",
  "key_points": [
    "关键要点1",
    "关键要点2",
    "关键要点3"
  ],
  "keywords": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "sentiment": "positive|neutral|negative",
  "reading_time": 5,
  "action_items": ["行动项1", "行动项2"]
}`;

const JSON_OUTPUT_RULES = `【JSON 输出规则】
1. tldr: 核心摘要（≤150字），概括核心观点及其价值
2. key_points: 3-5 个核心信息点，每个要点独立完整
3. keywords: 5 个标签，包含领域、主题、技术栈等
4. sentiment: 判断内容基调（positive/neutral/negative）
5. reading_time: 预计阅读分钟数（根据内容长度估算）
6. action_items: 仅教程类需要，列出可执行步骤；其他类型可省略

【重要约束】
- 必须返回纯 JSON 对象，不要任何额外说明、markdown 包裹或代码块标记
- 确保 JSON 格式严格正确，所有字段名和字符串值使用英文双引号
- 数组元素之间用逗号分隔，最后一个元素后不加逗号`;

// ============================================================
// Article Type Prompt V2
// ============================================================

const ARTICLE_PROMPT_V2: TypePromptConfigV2 = {
  systemPrompt: `你是一个专业的内容编辑，擅长提炼文章核心观点和关键信息。
你的输出必须是严格的 JSON 格式，包含结构化的摘要信息。`,

  userPromptTemplate: `请对以下文章进行深度分析，生成结构化摘要。

【文章信息】
标题：{{title}}
{{#if description}}描述：{{description}}{{/if}}
{{#if content}}
正文内容：
{{content}}
{{/if}}
{{#if folderContext}}
【用户现有文件夹】
{{folderContext}}
（参考生成相关标签）
{{/if}}

【摘要长度】{{min}}-{{max}}字

【文章类摘要要求】
- tldr: 概括文章的核心观点或主要结论
- key_points: 支撑论据、关键数据、重要案例
- keywords: 包含1个领域标签（如"前端开发"）、1-2个主题标签、1个价值标签
- sentiment: 判断作者观点倾向
- action_items: 文章类通常为空数组

${JSON_OUTPUT_RULES}

【返回格式】
${JSON_OUTPUT_SCHEMA}`,

  temperature: 0.7,

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 1000) return { min: 100, max: 200 };
    if (contentLength <= 3000) return { min: 200, max: 350 };
    if (contentLength <= 5000) return { min: 300, max: 500 };
    return { min: 400, max: 700 };
  },
};

// ============================================================
// Tutorial Type Prompt V2
// ============================================================

const TUTORIAL_PROMPT_V2: TypePromptConfigV2 = {
  systemPrompt: `你是一个技术文档专家，擅长总结教程和指南的核心步骤。
你的输出必须是严格的 JSON 格式，重点突出可执行的步骤。`,

  userPromptTemplate: `请对以下教程进行深度分析，生成结构化摘要。

【教程信息】
标题：{{title}}
{{#if description}}描述：{{description}}{{/if}}
{{#if content}}
正文内容：
{{content}}
{{/if}}
{{#if folderContext}}
【用户现有文件夹】
{{folderContext}}
（参考生成相关标签）
{{/if}}

【摘要长度】{{min}}-{{max}}字

【教程类摘要要求】
- tldr: 说明本教程教什么、实现什么目标
- key_points: 3-5 个关键步骤或核心知识点
- keywords: 必须包含具体技术栈（如"React"、"Docker"）+ 学习阶段（"入门"/"进阶"）
- sentiment: 教程类通常为 "neutral"
- action_items: 【重要】列出 3-5 个可执行的行动步骤，具体可操作

${JSON_OUTPUT_RULES}

【返回格式】
${JSON_OUTPUT_SCHEMA}`,

  temperature: 0.3,

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 1000) return { min: 150, max: 250 };
    if (contentLength <= 3000) return { min: 250, max: 400 };
    return { min: 350, max: 550 };
  },
};

// ============================================================
// Video Type Prompt V2
// ============================================================

const VIDEO_PROMPT_V2: TypePromptConfigV2 = {
  systemPrompt: `你是一个视频内容分析师，擅长从视频标题和描述中提炼核心信息。
你的输出必须是严格的 JSON 格式，简洁重点。`,

  userPromptTemplate: `请对以下视频内容进行分析，生成结构化摘要。

【视频信息】
标题：{{title}}
{{#if description}}描述：{{description}}{{/if}}
{{#if content}}
补充信息：
{{content}}
{{/if}}
{{#if folderContext}}
【用户现有文件夹】
{{folderContext}}
（参考生成相关标签）
{{/if}}

【摘要长度】{{min}}-{{max}}字

【视频类摘要要求】
- tldr: 说明这个视频讲什么主题
- key_points: 2-4 个核心信息点（忽略口播广告）
- keywords: 包含视频主题关键词 + 类型标签（"教程"/"评测"/"访谈"）
- sentiment: 判断视频内容基调
- reading_time: 视频类通常填写视频时长（分钟）
- action_items: 如果是教程视频，列出步骤；否则为空

${JSON_OUTPUT_RULES}

【返回格式】
${JSON_OUTPUT_SCHEMA}`,

  temperature: 0.5,

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 500) return { min: 80, max: 150 };
    if (contentLength <= 2000) return { min: 150, max: 250 };
    return { min: 200, max: 350 };
  },
};

// ============================================================
// Tool Type Prompt V2
// ============================================================

const TOOL_PROMPT_V2: TypePromptConfigV2 = {
  systemPrompt: `你是一个产品分析师，擅长评估工具和服务的核心价值。
你的输出必须是严格的 JSON 格式，客观结构化。`,

  userPromptTemplate: `请对以下工具/产品进行分析，生成结构化摘要。

【工具信息】
标题：{{title}}
{{#if description}}描述：{{description}}{{/if}}
{{#if content}}
详细信息：
{{content}}
{{/if}}
{{#if folderContext}}
【用户现有文件夹】
{{folderContext}}
（参考生成相关标签）
{{/if}}

【摘要长度】{{min}}-{{max}}字

【工具类摘要要求】
- tldr: 说明这是什么工具，解决什么问题
- key_points: 3-5 个核心功能或特点，保留定价信息（如有）
- keywords: 必须包含工具类型（"效率工具"/"开发工具"）+ 具体用途 + 平台标签
- sentiment: 通常为 "neutral"（保持客观）
- action_items: 如果是开发工具，可列出快速上手步骤；否则为空

${JSON_OUTPUT_RULES}

【返回格式】
${JSON_OUTPUT_SCHEMA}`,

  temperature: 0.3,

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 500) return { min: 100, max: 180 };
    if (contentLength <= 2000) return { min: 180, max: 300 };
    return { min: 250, max: 400 };
  },
};

// ============================================================
// Prompt Configuration Map
// ============================================================

const PROMPT_CONFIGS_V2: Record<ContentType, TypePromptConfigV2> = {
  article: ARTICLE_PROMPT_V2,
  tutorial: TUTORIAL_PROMPT_V2,
  video: VIDEO_PROMPT_V2,
  tool: TOOL_PROMPT_V2,
};

/**
 * Get V2 prompt configuration for a content type
 */
export function getPromptConfigV2(
  contentType: ContentType,
): TypePromptConfigV2 {
  return PROMPT_CONFIGS_V2[contentType] || PROMPT_CONFIGS_V2.article;
}

/**
 * Build the complete V2 user prompt
 */
export function buildTypeSpecificPromptV2(
  contentType: ContentType,
  title: string,
  description?: string,
  content?: string,
  existingFolderNames?: string[],
): string {
  const config = getPromptConfigV2(contentType);

  // Calculate content length for summary limits
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { min, max } = config.getSummaryLength(contentLength);

  // Build folder context
  let folderContext = "";
  if (existingFolderNames && existingFolderNames.length > 0) {
    const meaningfulFolders = existingFolderNames
      .filter((name) => name.length <= 20 && !name.includes("待整理"))
      .slice(0, 10);

    if (meaningfulFolders.length > 0) {
      folderContext = meaningfulFolders.join("、");
    }
  }

  // Simple template replacement
  let prompt = config.userPromptTemplate
    .replace("{{title}}", title)
    .replace("{{min}}", String(min))
    .replace("{{max}}", String(max));

  // Handle conditional blocks
  if (description) {
    prompt = prompt
      .replace("{{#if description}}", "")
      .replace("{{/if}}", "")
      .replace("{{description}}", description);
  } else {
    prompt = prompt.replace(/\{\{#if description\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  if (content) {
    const truncatedContent = content.substring(0, 5000);
    prompt = prompt
      .replace("{{#if content}}", "")
      .replace("{{/if}}", "")
      .replace("{{content}}", truncatedContent);
  } else {
    prompt = prompt.replace(/\{\{#if content\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  if (folderContext) {
    prompt = prompt
      .replace("{{#if folderContext}}", "")
      .replace("{{/if}}", "")
      .replace("{{folderContext}}", folderContext);
  } else {
    prompt = prompt.replace(
      /\{\{#if folderContext\}\}[\s\S]*?\{\{\/if\}\}/g,
      "",
    );
  }

  return prompt;
}
