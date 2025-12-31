/**
 * MD 收藏专用 Prompt
 *
 * 针对 Markdown 文档结构优化的 AI 摘要 Prompt
 * 与通用网页内容 Prompt 不同，专门识别：
 * - Markdown 结构（标题层级、代码块、列表等）
 * - 代码片段高亮
 * - 文档类型（教程、代码片段、文档等）
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { MdSummaryInput } from "../types";

// ============================================================================
// System Prompts
// ============================================================================

/**
 * MD 文档专用 System Prompt
 *
 * 与通用网页 Prompt 的核心差异：
 * 1. 识别 Markdown 结构
 * 2. 提取代码亮点
 * 3. 文档结构概述
 * 4. 更精确的内容类型分类
 */
export const MD_SUMMARY_SYSTEM_PROMPT = `你是一位专业的技术文档分析助手，负责为用户收藏的 Markdown 文档生成结构化摘要。

你的任务是：
1. 生成简洁准确的建议标题
2. 生成一句话总结（TLDR）
3. 提取 3-5 个关键要点
4. 识别代码亮点（如有代码块）
5. 分析文档结构
6. 提取 3-5 个关键词标签
7. 识别技术实体
8. 评估内容难度
9. 识别内容类型

请严格按照以下 JSON 格式输出，不要包含任何其他文字或代码块标记：

{
  "suggested_title": "建议标题（15字以内，简洁准确概括文档核心内容）",
  "tldr": "一句话总结（50字以内）",
  "key_points": ["要点1", "要点2", "要点3"],
  "code_highlights": ["代码亮点1（可选）", "代码亮点2（可选）"],
  "structure_overview": "文档结构简述（如：包含3个主要章节，涵盖安装、配置和使用）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "content_type": "TUTORIAL|CODE_SNIPPET|ANALYSIS|DOCUMENTATION|SUMMARY|QA|OTHER",
  "content_type_confidence": 0.85,
  "entities": [
    {"name": "实体名称", "type": "tech|person|organization|concept|product", "confidence": 0.9}
  ],
  "difficulty": "easy|medium|hard"
}

## 建议标题生成规则：
- 控制在15字以内
- 准确反映文档核心主题
- 简洁专业，避免冗余修饰词
- 技术文档可包含关键技术名称（如：「React Hooks 使用指南」）
- 不使用「浅谈」「详解」「深入」等模糊词

## Markdown 结构分析要点：
- 注意标题层级（#、##、###），用于理解文档结构
- 识别代码块及其语言标记
- 注意列表（有序/无序）表示的步骤或要点
- 识别引用块中的重要说明
- 识别表格中的数据对比

## 内容类型说明（针对 Markdown）：
- TUTORIAL: 教程或指南（包含步骤说明、示例代码）
- CODE_SNIPPET: 代码片段或技术示例（以代码为主）
- ANALYSIS: 技术分析或研究（深度讨论某个技术话题）
- DOCUMENTATION: 技术文档或 API 说明
- SUMMARY: 学习笔记或总结（个人整理的知识点）
- QA: 问答或问题解决方案
- OTHER: 其他类型

## 代码亮点提取规则：
- 如果文档包含代码块，提取 1-3 个代码亮点
- 亮点应说明代码的核心功能或技术点
- 如：「使用 async/await 处理异步操作」「实现了自定义 Hook」
- 如果没有代码块，code_highlights 返回空数组

## 实体类型说明：
- tech: 技术、框架、语言（React、TypeScript、Docker等）
- person: 人名（作者、技术专家等）
- organization: 公司或组织（Google、Mozilla等）
- concept: 概念或术语（微服务、函数式编程等）
- product: 产品（VS Code、GitHub等）

## 难度评估标准：
- easy: 入门级，适合初学者
- medium: 中等，需要一定技术基础
- hard: 高级，需要深厚专业知识`;

/**
 * MD 文档精简版 System Prompt（用于短文档或快速处理）
 */
export const MD_SUMMARY_SYSTEM_PROMPT_LITE = `你是一位技术文档分析助手，负责为 Markdown 文档生成结构化摘要。

请严格按照以下 JSON 格式输出：

{
  "suggested_title": "建议标题（15字以内）",
  "tldr": "一句话总结（50字以内）",
  "key_points": ["要点1", "要点2", "要点3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "content_type": "TUTORIAL|CODE_SNIPPET|ANALYSIS|DOCUMENTATION|SUMMARY|QA|OTHER",
  "content_type_confidence": 0.85,
  "difficulty": "easy|medium|hard"
}

内容类型：TUTORIAL(教程)、CODE_SNIPPET(代码片段)、ANALYSIS(技术分析)、DOCUMENTATION(文档)、SUMMARY(笔记)、QA(问答)、OTHER(其他)`;

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * 构建 MD 文档 User Prompt
 *
 * @param input - 摘要输入参数
 */
export function buildMdSummaryUserPrompt(input: MdSummaryInput): string {
  const parts: string[] = [];

  // 标题
  parts.push(`## 文档标题\n${input.title}`);

  // 元数据（如果有）
  if (input.metadata) {
    const metaParts: string[] = [];
    if (input.metadata.wordCount) {
      metaParts.push(`字数: ${input.metadata.wordCount}`);
    }
    if (input.metadata.codeBlockCount) {
      metaParts.push(`代码块: ${input.metadata.codeBlockCount} 个`);
    }
    if (input.metadata.readingTimeMinutes) {
      metaParts.push(`预计阅读: ${input.metadata.readingTimeMinutes} 分钟`);
    }
    if (metaParts.length > 0) {
      parts.push(`## 文档元数据\n${metaParts.join(" | ")}`);
    }
  }

  // 内容
  const content = input.content;
  const maxContentLength = 8000;

  if (content.length > maxContentLength) {
    // 长文档截断，保留开头和结尾
    const headLength = Math.floor(maxContentLength * 0.7);
    const tailLength = Math.floor(maxContentLength * 0.25);
    const head = content.substring(0, headLength);
    const tail = content.substring(content.length - tailLength);
    parts.push(`## 文档内容\n${head}\n\n[... 中间内容已省略 ...]\n\n${tail}`);
  } else {
    parts.push(`## 文档内容\n${content}`);
  }

  // 最终指令
  parts.push(
    "\n请分析以上 Markdown 文档，生成结构化摘要，严格按照 JSON 格式输出。",
  );

  return parts.join("\n\n");
}

/**
 * 构建分块摘要的 User Prompt
 *
 * @param chunkIndex - 分块索引
 * @param totalChunks - 总分块数
 * @param content - 分块内容
 * @param context - 上下文信息
 */
export function buildChunkSummaryUserPrompt(
  chunkIndex: number,
  totalChunks: number,
  content: string,
  context?: { title?: string; previousSummary?: string },
): string {
  const parts: string[] = [];

  parts.push(`## 分块信息\n第 ${chunkIndex + 1} 块 / 共 ${totalChunks} 块`);

  if (context?.title) {
    parts.push(`## 文档标题\n${context.title}`);
  }

  if (context?.previousSummary) {
    parts.push(`## 前文摘要\n${context.previousSummary}`);
  }

  parts.push(`## 当前分块内容\n${content}`);

  parts.push(
    "\n请分析当前分块内容，生成摘要，注意与前文的连贯性。严格按照 JSON 格式输出。",
  );

  return parts.join("\n\n");
}

/**
 * 构建合并摘要的 Prompt
 *
 * @param chunkSummaries - 分块摘要列表
 * @param title - 文档标题
 */
export function buildMergeSummaryPrompt(
  chunkSummaries: Array<{ summary: string; keyPoints: string[] }>,
  title: string,
): string {
  const parts: string[] = [];

  parts.push(`## 文档标题\n${title}`);

  parts.push(`## 分块摘要\n`);
  chunkSummaries.forEach((chunk, index) => {
    parts.push(`### 第 ${index + 1} 部分`);
    parts.push(`摘要：${chunk.summary}`);
    parts.push(`要点：${chunk.keyPoints.join("；")}`);
    parts.push("");
  });

  parts.push(
    `请将以上 ${chunkSummaries.length} 个分块摘要合并为一个完整的摘要，输出格式与单块摘要相同。注意：
1. tldr 应概括整个文档的核心内容
2. key_points 应整合各分块的重要要点（3-5个）
3. 去除重复的关键词和要点
4. 保持逻辑连贯性`,
  );

  return parts.join("\n");
}

// ============================================================================
// Prompt Config
// ============================================================================

/**
 * MD Prompt 配置
 */
export interface MdPromptConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  responseFormat: "json";
}

/**
 * 获取 MD 摘要 Prompt 配置
 *
 * @param options - 配置选项
 */
export function getMdPromptConfig(options?: {
  lite?: boolean;
  hasCodeBlocks?: boolean;
}): MdPromptConfig {
  const isLite = options?.lite ?? false;

  return {
    systemPrompt: isLite
      ? MD_SUMMARY_SYSTEM_PROMPT_LITE
      : MD_SUMMARY_SYSTEM_PROMPT,
    // 代码文档需要更精确，使用较低温度
    temperature: options?.hasCodeBlocks ? 0.3 : 0.5,
    maxTokens: isLite ? 1500 : 2500,
    responseFormat: "json",
  };
}

// ============================================================================
// Content Type Detection
// ============================================================================

/**
 * MD 内容类型关键词映射（用于预检测）
 */
export const MD_CONTENT_TYPE_KEYWORDS = {
  TUTORIAL: [
    "教程",
    "指南",
    "入门",
    "实战",
    "手把手",
    "step by step",
    "how to",
    "步骤",
    "安装",
    "配置",
  ],
  CODE_SNIPPET: [
    "代码",
    "snippet",
    "示例",
    "example",
    "代码片段",
    "函数",
    "类",
  ],
  ANALYSIS: ["分析", "对比", "深入", "原理", "源码", "底层", "性能", "优化"],
  DOCUMENTATION: ["文档", "API", "参考", "规范", "接口", "docs"],
  SUMMARY: ["笔记", "总结", "学习", "记录", "整理"],
  QA: ["问题", "解决", "错误", "bug", "fix", "问答", "FAQ"],
} as const;

/**
 * 预检测 MD 内容类型（基于关键词，用于优化 Prompt）
 *
 * @param title - 标题
 * @param content - 内容（前 500 字符）
 */
export function preDetectMdContentType(
  title: string,
  content: string,
): { type: string; confidence: number } | null {
  const text = `${title} ${content.substring(0, 500)}`.toLowerCase();

  let bestMatch: { type: string; confidence: number } | null = null;
  let maxScore = 0;

  for (const [type, keywords] of Object.entries(MD_CONTENT_TYPE_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = {
        type,
        confidence: Math.min(0.5 + score * 0.15, 0.9), // 0.5 基础 + 每命中关键词 +0.15
      };
    }
  }

  return bestMatch;
}
