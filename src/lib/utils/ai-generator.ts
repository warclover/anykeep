/**
 * AI 内容生成工具
 * 使用 DeepSeek API 生成摘要和标签
 *
 * V2 优化：
 * - 内容类型自适应摘要（Article/Tutorial/Video/Tool）
 * - 类型专用 Prompt 模板
 * - 类型专用 API 参数（temperature/max_tokens）
 * - 完整性检测（记录截断警告）
 *
 * V2.1 优化：
 * - 支持 JSON 结构化输出（通过特性开关控制）
 * - 回滚机制（环境变量 AI_SUMMARY_JSON_OUTPUT=false）
 */

import { logger } from "@/lib/logger";
import { isSummaryComplete } from "./content-extractor";
import {
  detectContentType,
  type ContentType,
  type ContentTypeResult,
} from "@/lib/classification/content-type-detector";
import {
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "@/lib/classification/prompts";
import {
  isJsonOutputEnabled,
  getAISummaryConfig,
} from "@/lib/classification/config/ai-summary-config";
import {
  safeParseJson,
  type StructuredSummary,
} from "@/lib/classification/types/ai-summary";

export interface AIGenerateResult {
  summary: string;
  tags: string[];
  contentType?: ContentType; // Detected content type
  contentTypeConfidence?: number; // Detection confidence (0-100)
}

// Re-export ContentType for external use
export type { ContentType } from "@/lib/classification/content-type-detector";

export interface FolderRecommendation {
  folderId: number | null; // null 表示建议新建文件夹
  folderName: string; // 推荐的文件夹名称（已有或建议新建）
  confidence: number; // 置信度 0-100
  reason: string; // 推荐理由
  suggestNew: boolean; // 是否建议新建文件夹
}

interface ExistingFolder {
  id: number;
  name: string;
  topTags?: string[]; // 文件夹的热门标签（用于 AI 理解文件夹内容）
  bookmarkCount?: number; // 文件夹内书签数量
}

interface AIGenerateRequest {
  title: string;
  url?: string; // URL for content type detection
  description?: string;
  content?: string;
  existingFolderNames?: string[]; // 用户现有文件夹名称（用于标签参考）
}

/**
 * 根据原文字数计算摘要上限
 * - < 1000 字：100-200 字摘要
 * - 1000-5000 字：300-500 字摘要
 * - > 5000 字：500-800 字摘要
 */
function getSummaryLimit(contentLength: number): { min: number; max: number } {
  if (contentLength < 1000) {
    return { min: 100, max: 200 };
  } else if (contentLength <= 5000) {
    return { min: 300, max: 500 };
  } else {
    return { min: 500, max: 800 };
  }
}

/**
 * 简单 AI 生成函数
 * 用于 V4.1 分类等场景的简单文本生成
 *
 * @param prompt - 用户 prompt
 * @param options - 生成选项
 * @returns 生成的文本
 */
export async function generateWithAI(
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
  },
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  try {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 100,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("DeepSeek API 返回空内容");
    }

    return content.trim();
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "generateWithAI: API call failed",
    );
    throw error;
  }
}

/**
 * 调用 DeepSeek API 生成摘要和标签
 * V2: 支持内容类型自适应 Prompt
 * V2.1: 支持 JSON 结构化输出（通过配置开关控制）
 */
async function callDeepSeekAPI(
  title: string,
  contentTypeResult: ContentTypeResult,
  description?: string,
  content?: string,
  existingFolderNames?: string[],
): Promise<AIGenerateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  // 检查是否启用 JSON 结构化输出
  const useJsonOutput = isJsonOutputEnabled();

  logger.debug(
    {
      useJsonOutput,
      configVersion: "2.1",
      action: "ai_config_check",
    },
    "AI Generator: Config check",
  );

  // 根据配置选择 V1 或 V2 prompt
  let systemPrompt: string;
  let userPrompt: string;
  let temperature: number;

  if (useJsonOutput) {
    // V2: JSON 结构化输出
    const promptConfigV2 = getPromptConfigV2(contentTypeResult.type);
    systemPrompt = promptConfigV2.systemPrompt;
    userPrompt = buildTypeSpecificPromptV2(
      contentTypeResult.type,
      title,
      description,
      content,
      existingFolderNames,
    );
    temperature = promptConfigV2.temperature;
  } else {
    // V1: 纯文本输出（回滚模式）
    const promptConfig = getPromptConfig(contentTypeResult.type);
    systemPrompt = promptConfig.systemPrompt;
    userPrompt = buildTypeSpecificPrompt(
      contentTypeResult.type,
      title,
      description,
      content,
      existingFolderNames,
    );
    temperature = promptConfig.temperature;
  }

  try {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: temperature,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error("AI 未返回内容");
    }

    // 根据输出模式解析响应
    let result: AIGenerateResult;

    if (useJsonOutput) {
      // V2: 解析结构化 JSON 响应
      result = parseAIResponseV2(aiContent);
    } else {
      // V1: 解析传统 JSON 响应
      result = parseAIResponse(aiContent);
    }

    // 添加内容类型信息
    result.contentType = contentTypeResult.type;
    result.contentTypeConfidence = contentTypeResult.confidence;

    return result;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        {
          error: error.message,
          useJsonOutput,
          action: "deepseek_api_call",
        },
        "AI Generator: DeepSeek API error",
      );
      throw new Error(`AI 生成失败: ${error.message}`);
    }
    throw new Error("AI 生成失败");
  }
}

// ============================================================
// Note: detectContentType, getTagRequirementsByType, and buildPrompt
// have been moved to:
// - src/lib/classification/content-type-detector.ts
// - src/lib/classification/prompts/summary-prompts.ts
// ============================================================

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
 *
 * 存储格式：将完整 JSON 存入 summary 字段，前端自动检测并渲染
 */
function parseAIResponseV2(content: string): AIGenerateResult {
  try {
    // 移除可能的 markdown 代码块标记
    const cleaned = content
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    // 安全解析 JSON（带修复尝试）
    const parsed = safeParseJson<StructuredSummary>(cleaned);

    if (!parsed) {
      logger.warn(
        {
          rawContent: cleaned.substring(0, 200),
          action: "parse_v2_json_failed",
        },
        "AI Generator: V2 JSON parse failed, falling back to V1",
      );
      // 回退到 V1 解析
      return parseAIResponse(content);
    }

    // 验证必要字段
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

    // 提取标签（优先使用 keywords，回退到 key_points 关键词）
    let tags: string[] = [];
    if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
      tags = parsed.keywords
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
        .slice(0, 5);
    }

    // 如果没有 keywords，使用配置中的回退标签
    if (tags.length === 0 && parsed.key_points.length > 0) {
      tags = getAISummaryConfig().fallbackTags;
    }

    // 将完整 JSON 作为 summary 存储（前端会自动检测并渲染）
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
    // 出错时回退到 V1 解析
    return parseAIResponse(content);
  }
}

/**
 * 解析 V1 AI 返回的内容（传统纯文本格式）
 */
function parseAIResponse(content: string): AIGenerateResult {
  try {
    // 移除可能的 markdown 代码块标记
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleaned);

    // 验证结果格式
    if (!result.summary || typeof result.summary !== "string") {
      throw new Error("Invalid summary format");
    }

    if (!Array.isArray(result.tags) || result.tags.length === 0) {
      throw new Error("Invalid tags format");
    }

    // 确保标签是字符串数组
    const tags = (result.tags as unknown[])
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tags.length === 0) {
      throw new Error("No valid tags found");
    }

    const trimmedSummary = result.summary.trim();

    // 检测摘要完整性（仅记录日志，不阻断流程）
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
      tags: tags.slice(0, 5), // 最多5个标签
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

/**
 * 生成基于规则的简单摘要和标签（回退方案）
 * 根据内容长度动态调整摘要上限
 */
function generateFallbackContent(
  title: string,
  description?: string,
  content?: string,
): AIGenerateResult {
  // 计算总内容长度，确定摘要上限
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { max } = getSummaryLimit(contentLength);

  // 简单摘要：使用标题或描述的前 max 个字符
  let summary = title;

  if (description && description.length > title.length) {
    summary =
      description.length > max
        ? description.substring(0, max) + "..."
        : description;
  }

  // 简单标签：从标题中提取关键词
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

  // 如果没有匹配的关键词，使用默认标签
  if (tags.length === 0) {
    tags.push("收藏", "阅读");
  }

  return {
    summary: summary.substring(0, max),
    tags: tags.slice(0, 5),
  };
}

/**
 * 生成 AI 摘要和标签
 * V2: 支持内容类型自适应摘要
 * @param request - 包含标题、URL、描述和内容的请求对象
 * @returns AI 生成的摘要、标签和内容类型
 */
export async function generateAIContent(
  request: AIGenerateRequest,
): Promise<AIGenerateResult> {
  const { title, url, description, content, existingFolderNames } = request;

  // 验证输入
  if (!title || title.trim().length === 0) {
    throw new Error("标题不能为空");
  }

  // 检测内容类型
  const contentTypeResult = detectContentType({
    url,
    title,
    description,
    content,
  });

  try {
    logger.info(
      {
        title,
        url,
        contentType: contentTypeResult.type,
        contentTypeConfidence: contentTypeResult.confidence,
        folderCount: existingFolderNames?.length || 0,
        action: "generate_start",
      },
      "AI Generator: Generating content with type detection",
    );

    const result = await callDeepSeekAPI(
      title,
      contentTypeResult,
      description,
      content,
      existingFolderNames,
    );

    logger.info(
      {
        summary: result.summary.substring(0, 100),
        tagCount: result.tags.length,
        contentType: result.contentType,
        action: "generate_success",
      },
      "AI Generator: Success",
    );
    return result;
  } catch (error) {
    // AI 生成失败时使用回退方案
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        contentType: contentTypeResult.type,
        action: "generate_failed",
      },
      "AI Generator: Failed, using fallback",
    );
    const fallback = generateFallbackContent(title, description, content);

    // 添加内容类型信息到回退结果
    fallback.contentType = contentTypeResult.type;
    fallback.contentTypeConfidence = contentTypeResult.confidence;

    logger.info(
      {
        summary: fallback.summary,
        tagCount: fallback.tags.length,
        contentType: fallback.contentType,
        action: "fallback_used",
      },
      "AI Generator: Fallback",
    );
    return fallback;
  }
}

/**
 * 推荐文件夹
 * 基于内容和现有文件夹列表，AI 推荐最合适的文件夹
 */
export async function recommendFolder(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): Promise<FolderRecommendation> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 如果没有 API Key 或没有现有文件夹，使用智能回退
  if (!apiKey || existingFolders.length === 0) {
    return generateFallbackFolderRecommendation(title, tags, existingFolders);
  }

  try {
    const prompt = buildFolderRecommendationPrompt(
      title,
      summary,
      tags,
      existingFolders,
    );

    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个内容分类专家。你的任务是根据内容特征，从用户现有的文件夹中选择最匹配的一个，或者根据内容生成一个新的、简洁的文件夹名称。请严格按照 JSON 格式返回结果。",
            },
            {
              role: "user",
              content:
                prompt +
                "\n\n注意：如果建议新建文件夹，请根据内容生成一个简洁的名称（2-6个字），严禁使用'内容分类与标签管理'、'待分类'、'未命名'等无意义名称。",
            },
          ],
          temperature: 0.3, // 较低的温度以获得更一致的结果
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(10000), // 10秒超时
      },
    );

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error("AI 未返回内容");
    }

    return parseFolderRecommendation(aiContent, existingFolders);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        action: "folder_recommendation_failed",
      },
      "AI Generator: Folder recommendation failed",
    );
    return generateFallbackFolderRecommendation(title, tags, existingFolders);
  }
}

/**
 * 构建文件夹推荐提示词（增强版：包含文件夹内容描述）
 */
function buildFolderRecommendationPrompt(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): string {
  // 构建增强的文件夹列表（包含 top_tags 帮助 AI 理解文件夹内容）
  const folderList = existingFolders
    .map((f) => {
      const tagsStr =
        f.topTags && f.topTags.length > 0
          ? ` [常见内容: ${f.topTags.slice(0, 4).join(", ")}]`
          : "";
      const countStr =
        f.bookmarkCount && f.bookmarkCount > 0 ? ` (${f.bookmarkCount}篇)` : "";
      return `- ${f.name}${countStr}${tagsStr} (ID: ${f.id})`;
    })
    .join("\n");

  return `请根据以下内容，从现有文件夹中选择最合适的一个，或建议创建新文件夹。

【待分类内容】
- 标题：${title}
- 摘要：${summary || "无"}
- 标签：${tags.join("、") || "无"}

【现有文件夹】（格式：文件夹名 (书签数) [常见内容标签]）
${folderList || "（暂无文件夹）"}

【决策规则】
1. 优先匹配：如果内容标签与某个文件夹的"常见内容"高度相关，优先选择该文件夹
2. 名称匹配：如果内容标签包含文件夹名称的关键词（如标签含"Claude"应匹配"claude 学习"）
3. 新建条件：只有内容主题与所有现有文件夹都不相关时，才建议新建
4. 置信度：匹配程度越高，置信度越高（80-100：强匹配，60-79：中等匹配）

请以 JSON 格式返回：
{
  "recommendedFolderId": 123,  // 推荐的文件夹 ID，如建议新建则为 null
  "folderName": "文件夹名称",  // 推荐的文件夹名（已有的或建议新建的）
  "confidence": 85,           // 置信度 0-100
  "reason": "推荐理由",       // 简短说明为什么推荐这个文件夹
  "suggestNew": false         // 是否建议新建文件夹
}

只返回 JSON，不要额外说明。`;
}

/**
 * 解析文件夹推荐响应
 */
function parseFolderRecommendation(
  content: string,
  existingFolders: ExistingFolder[],
): FolderRecommendation {
  try {
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleaned);

    // 验证推荐的文件夹 ID 是否存在
    let folderId: number | null = null;
    let folderName = result.folderName || "未分类";
    const suggestNew = result.suggestNew === true;

    if (!suggestNew && result.recommendedFolderId) {
      const folder = existingFolders.find(
        (f) => f.id === result.recommendedFolderId,
      );
      if (folder) {
        folderId = folder.id;
        folderName = folder.name;
      }
    }

    return {
      folderId,
      folderName,
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reason: result.reason || "基于内容主题分析",
      suggestNew,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
        action: "parse_folder_recommendation",
      },
      "AI Generator: Parse folder recommendation error",
    );

    // 返回默认推荐
    return {
      folderId: existingFolders[0]?.id || null,
      folderName: existingFolders[0]?.name || "未分类",
      confidence: 30,
      reason: "基于默认规则",
      suggestNew: existingFolders.length === 0,
    };
  }
}

/**
 * 智能回退：基于标签和语义的文件夹推荐算法
 */
function generateFallbackFolderRecommendation(
  title: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): FolderRecommendation {
  // 如果没有文件夹，建议新建
  if (existingFolders.length === 0) {
    const suggestedName = tags[0] || extractKeyword(title) || "我的收藏";
    return {
      folderId: null,
      folderName: suggestedName,
      confidence: 40,
      reason: "暂无文件夹，建议创建新文件夹",
      suggestNew: true,
    };
  }

  // 优化的匹配算法
  let bestMatch: ExistingFolder | null = null;
  let bestScore = 0;
  let matchReason = "";

  for (const folder of existingFolders) {
    const folderNameLower = folder.name.toLowerCase();
    let score = 0;
    const matchDetails: string[] = [];

    // 1. 标签完全匹配（最高权重：80分）
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (folderNameLower === tagLower) {
        score += 80;
        matchDetails.push(`标签"${tag}"完全匹配`);
        break; // 完全匹配后不再计算其他匹配
      } else if (folderNameLower.includes(tagLower)) {
        // 标签部分匹配（权重：50分）
        score += 50;
        matchDetails.push(`标签"${tag}"部分匹配`);
      } else if (
        tagLower.includes(folderNameLower) &&
        folderNameLower.length > 1
      ) {
        // 文件夹名包含在标签中（权重：40分）
        score += 40;
        matchDetails.push(`文件夹名包含在标签"${tag}"中`);
      }
    }

    // 1.5. 关键词级别匹配（新增：解决 "Claude Code" 匹配 "claude 学习" 的问题）
    // 将标签分割成单词，检查文件夹名是否包含这些关键词
    const matchedKeywords = new Set<string>();
    for (const tag of tags) {
      // 分割标签为单词（支持空格、连字符等分隔符）
      const tagWords = tag
        .toLowerCase()
        .split(/[\s\-_]+/)
        .filter((w) => w.length >= 2);

      for (const word of tagWords) {
        // 检查文件夹名是否包含该关键词（至少3个字符以避免误匹配）
        if (word.length >= 3 && folderNameLower.includes(word)) {
          if (!matchedKeywords.has(word)) {
            matchedKeywords.add(word);
            // 关键词匹配权重：35分（首个关键词），后续每个额外 10 分
            const keywordScore = matchedKeywords.size === 1 ? 35 : 10;
            score += keywordScore;
          }
        }
      }
    }
    if (matchedKeywords.size > 0) {
      matchDetails.push(
        `关键词匹配: ${Array.from(matchedKeywords).slice(0, 3).join(", ")}`,
      );
    }

    // 2. 标题关键词匹配（次要权重：15分每个关键词）
    const titleWords = title
      .toLowerCase()
      .split(/[\s,，、]+/)
      .filter((w) => w.length > 1);
    let titleMatchCount = 0;
    for (const word of titleWords) {
      if (folderNameLower.includes(word)) {
        score += 15;
        titleMatchCount++;
        if (titleMatchCount >= 2) break; // 最多计算2个关键词匹配
      }
    }
    if (titleMatchCount > 0) {
      matchDetails.push(`标题关键词匹配(${titleMatchCount}个)`);
    }

    // 3. 语义相似度匹配（基于领域关键词：25分）
    const semanticScore = calculateSemanticSimilarity(folderNameLower, tags);
    if (semanticScore > 0) {
      score += semanticScore;
      matchDetails.push(`语义关联匹配`);
    }

    // 更新最佳匹配
    if (score > bestScore) {
      bestScore = score;
      bestMatch = folder;
      matchReason = matchDetails.join("；");
    }
  }

  // 根据得分决定推荐策略
  if (bestMatch && bestScore >= 40) {
    return {
      folderId: bestMatch.id,
      folderName: bestMatch.name,
      confidence: Math.min(95, bestScore),
      reason: matchReason || "基于标签匹配",
      suggestNew: false,
    };
  }

  // 得分不足，建议新建文件夹
  const suggestedName = tags[0] || extractKeyword(title) || "未分类";
  return {
    folderId: null,
    folderName: suggestedName,
    confidence: 30,
    reason: "没有找到高度匹配的文件夹，建议新建",
    suggestNew: true,
  };
}

/**
 * 计算语义相似度得分
 */
function calculateSemanticSimilarity(
  folderName: string,
  tags: string[],
): number {
  // 领域关键词映射表（2025 年更新版）
  const semanticKeywords: Record<string, string[]> = {
    前端: [
      // 框架
      "react",
      "vue",
      "angular",
      "svelte",
      "solid",
      "qwik",
      // 元框架
      "next.js",
      "nextjs",
      "nuxt",
      "remix",
      "astro",
      "gatsby",
      // 语言
      "javascript",
      "typescript",
      "css",
      "html",
      "sass",
      "less",
      // 构建工具
      "webpack",
      "vite",
      "turbopack",
      "esbuild",
      "rollup",
      "parcel",
      // UI 库
      "tailwind",
      "shadcn",
      "radix",
      "chakra",
      "mui",
      "antd",
      // 包管理
      "npm",
      "pnpm",
      "yarn",
      "bun",
      // 其他
      "web",
      "前端",
      "组件",
      "状态管理",
      "redux",
      "zustand",
      "jotai",
    ],
    后端: [
      // 语言
      "java",
      "python",
      "node",
      "golang",
      "go",
      "rust",
      "php",
      "ruby",
      "c#",
      "dotnet",
      // 运行时
      "nodejs",
      "deno",
      "bun",
      // 框架
      "spring",
      "springboot",
      "django",
      "fastapi",
      "flask",
      "express",
      "nestjs",
      "koa",
      "gin",
      "fiber",
      "actix",
      "axum",
      // 数据库
      "mysql",
      "postgresql",
      "postgres",
      "mongodb",
      "redis",
      "sqlite",
      // ORM
      "prisma",
      "drizzle",
      "typeorm",
      "sequelize",
      "sqlalchemy",
      // BaaS
      "supabase",
      "firebase",
      "appwrite",
      "pocketbase",
      // 其他
      "api",
      "graphql",
      "rest",
      "grpc",
      "微服务",
      "后端",
      "服务端",
    ],
    设计: [
      // 工具
      "figma",
      "sketch",
      "adobe",
      "photoshop",
      "illustrator",
      "xd",
      "canva",
      "framer",
      "principle",
      "protopie",
      // 概念
      "ui",
      "ux",
      "用户体验",
      "交互",
      "界面",
      "视觉",
      "原型",
      "设计系统",
      "design system",
      "组件库",
      "图标",
      "动效",
    ],
    产品: [
      "需求",
      "功能",
      "用户研究",
      "pm",
      "prd",
      "产品经理",
      "竞品",
      "迭代",
      "用户体验",
      "增长",
      "留存",
      "转化",
      "mvp",
      "敏捷",
      "scrum",
      "okr",
      "北极星指标",
      "用户画像",
      "产品规划",
      "路线图",
      "roadmap",
    ],
    数据: [
      // 分析工具
      "sql",
      "pandas",
      "numpy",
      "excel",
      "tableau",
      "powerbi",
      "superset",
      // 数据库
      "clickhouse",
      "duckdb",
      "snowflake",
      "bigquery",
      "databricks",
      // 数据工程
      "spark",
      "flink",
      "kafka",
      "airflow",
      "dbt",
      "etl",
      // 可视化
      "可视化",
      "echarts",
      "d3",
      "plotly",
      // 概念
      "分析",
      "bi",
      "统计",
      "数据分析",
      "数据科学",
      "数据工程",
    ],
    移动: [
      // 原生
      "ios",
      "android",
      "swift",
      "kotlin",
      "swiftui",
      "jetpack compose",
      // 跨平台
      "flutter",
      "react native",
      "expo",
      "capacitor",
      "ionic",
      "tauri",
      // 小程序
      "小程序",
      "微信小程序",
      "uniapp",
      "taro",
      // 概念
      "移动开发",
      "app",
      "移动端",
    ],
    运维: [
      // 容器化
      "docker",
      "kubernetes",
      "k8s",
      "podman",
      "containerd",
      // CI/CD
      "devops",
      "ci/cd",
      "github actions",
      "gitlab ci",
      "jenkins",
      "argocd",
      // 云平台
      "aws",
      "azure",
      "gcp",
      "阿里云",
      "腾讯云",
      "华为云",
      // 基础设施
      "terraform",
      "pulumi",
      "ansible",
      "helm",
      // 边缘/Serverless
      "vercel",
      "cloudflare",
      "netlify",
      "serverless",
      "边缘计算",
      // 服务器
      "linux",
      "nginx",
      "caddy",
      "traefik",
      // 监控
      "prometheus",
      "grafana",
      "监控",
      "日志",
      "elk",
    ],
    AI: [
      // === 基础概念 ===
      "机器学习",
      "深度学习",
      "神经网络",
      "自然语言",
      "nlp",
      "cv",
      "计算机视觉",

      // === 大模型通用术语 ===
      "llm",
      "大模型",
      "大语言模型",
      "生成式ai",
      "aigc",
      "prompt",
      "提示词",

      // === Anthropic/Claude 系列 ===
      "claude",
      "anthropic",
      "claude code",
      "sonnet",
      "opus",
      "haiku",

      // === OpenAI 系列 ===
      "openai",
      "chatgpt",
      "gpt",
      "gpt-4",
      "gpt-4o",
      "gpt-4-turbo",
      "o1",
      "o1-pro",
      "o3",

      // === Google 系列 ===
      "gemini",
      "bard",
      "palm",
      "gemma",
      "google ai",

      // === Meta 系列 ===
      "llama",
      "llama2",
      "llama3",
      "meta ai",

      // === 其他国际模型 ===
      "mistral",
      "mixtral",
      "cohere",
      "perplexity",
      "groq",

      // === 国产大模型 ===
      "deepseek",
      "通义千问",
      "qwen",
      "文心一言",
      "ernie",
      "智谱",
      "glm",
      "chatglm",
      "kimi",
      "moonshot",
      "豆包",
      "字节",
      "讯飞星火",
      "百川",
      "minimax",
      "零一万物",
      "yi",

      // === AI 编程工具 ===
      "copilot",
      "github copilot",
      "cursor",
      "windsurf",
      "cline",
      "aider",
      "tabnine",
      "codeium",
      "replit",
      "v0",
      "bolt",
      "ai编程",
      "ai coding",

      // === AI 开发框架 ===
      "langchain",
      "llamaindex",
      "semantic kernel",
      "autogen",
      "crewai",
      "dify",

      // === RAG 与向量 ===
      "rag",
      "embedding",
      "向量",
      "向量数据库",
      "pinecone",
      "weaviate",
      "milvus",
      "chroma",
      "qdrant",
      "faiss",

      // === Agent 相关 ===
      "ai agent",
      "agent",
      "智能体",
      "mcp",
      "function calling",
      "tool use",
      "autogpt",
      "babyagi",
      "agents",

      // === 训练技术 ===
      "fine-tuning",
      "微调",
      "rlhf",
      "dpo",
      "lora",
      "qlora",
      "peft",
      "sft",
      "预训练",
      "对齐",
      "alignment",

      // === 推理优化 ===
      "量化",
      "quantization",
      "gguf",
      "ggml",
      "ollama",
      "vllm",
      "tgi",
      "推理",
      "inference",
      "本地部署",

      // === 多模态 AI ===
      "多模态",
      "multimodal",
      "vision",
      "图像生成",
      "text-to-image",
      "midjourney",
      "mj",
      "dall-e",
      "stable diffusion",
      "sd",
      "sdxl",
      "flux",
      "comfyui",
      "automatic1111",
      "webui",

      // === AI 视频 ===
      "sora",
      "runway",
      "pika",
      "kling",
      "可灵",
      "ai视频",
      "text-to-video",

      // === AI 语音 ===
      "语音合成",
      "tts",
      "whisper",
      "语音识别",
      "asr",
      "elevenlabs",

      // === AI 应用场景 ===
      "ai助手",
      "智能助手",
      "对话机器人",
      "chatbot",
      "知识库",
      "ai写作",
      "ai绘画",
      "ai视频",
      "ai音乐",
      "ai翻译",
    ],
    // === 新增：学习/教程分类 ===
    学习: [
      "教程",
      "学习",
      "入门",
      "进阶",
      "实战",
      "课程",
      "培训",
      "笔记",
      "总结",
      "指南",
      "手册",
      "文档",
      "博客",
      "视频教程",
      "在线课程",
      "学习路径",
      "知识体系",
    ],
  };

  let maxScore = 0;

  // 遍历每个领域
  for (const [category, keywords] of Object.entries(semanticKeywords)) {
    // 文件夹名是否匹配领域
    if (folderName.includes(category.toLowerCase())) {
      // 检查标签是否包含该领域的关键词
      for (const tag of tags) {
        const tagLower = tag.toLowerCase();
        for (const keyword of keywords) {
          if (tagLower.includes(keyword) || keyword.includes(tagLower)) {
            maxScore = Math.max(maxScore, 25);
            break;
          }
        }
      }
    } else {
      // 文件夹名直接包含关键词
      for (const keyword of keywords) {
        if (folderName.includes(keyword)) {
          // 检查标签是否匹配该领域
          if (
            tags.some((t) => t.toLowerCase().includes(category.toLowerCase()))
          ) {
            maxScore = Math.max(maxScore, 20);
          }
          break;
        }
      }
    }
  }

  return maxScore;
}

/**
 * 从标题提取关键词作为文件夹名建议
 */
function extractKeyword(title: string): string {
  // 常见分类关键词
  const keywords = [
    "前端",
    "后端",
    "编程",
    "技术",
    "AI",
    "人工智能",
    "产品",
    "设计",
    "UI",
    "UX",
    "运营",
    "营销",
    "管理",
    "创业",
    "投资",
    "理财",
    "生活",
    "健康",
    "学习",
    "教程",
    "读书",
    "影视",
    "音乐",
    "游戏",
    "美食",
    "旅行",
    "时尚",
    "科技",
    "新闻",
  ];

  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      return keyword;
    }
  }

  return "";
}

// ============================================
// V4.2 AI 文件夹命名生成
// ============================================

/**
 * 从聚类书签生成文件夹名称的请求参数
 */
export interface GenerateFolderNameRequest {
  titles: string[]; // 聚类中的书签标题
  tags: string[]; // 所有书签的标签（去重后）
  summaries: string[]; // 书签摘要
  count: number; // 书签数量
}

/**
 * 从聚类书签生成文件夹名称的返回结果
 */
export interface GenerateFolderNameResult {
  name: string; // 生成的文件夹名称
  reason: string; // 命名理由
}

/**
 * 从聚类的书签中生成语义化的文件夹名称
 * 用于 V4.2 智能分拣功能，当系统检测到缓存池中有相似书签时自动生成文件夹建议
 *
 * @param request - 包含聚类书签的标题、标签和摘要信息
 * @returns 文件夹名称和命名理由
 */
export async function generateFolderNameFromBookmarks(
  request: GenerateFolderNameRequest,
): Promise<GenerateFolderNameResult> {
  const { titles, tags, summaries, count } = request;

  // 构建上下文信息
  const titlesContext = titles.slice(0, 10).join("\n- ");
  const tagsContext = tags.slice(0, 20).join(", ");
  const summariesContext = summaries
    .slice(0, 5)
    .map((s) => s.slice(0, 200))
    .join("\n---\n");

  const prompt = `你是一个智能收藏夹命名助手。根据以下聚类的书签内容，为这组书签生成一个简洁且有语义的文件夹名称。

## 书签信息

**数量**: ${count} 个书签

**标题列表**:
- ${titlesContext}

**标签**:
${tagsContext}

**部分摘要**:
${summariesContext}

## 要求

1. 名称要简洁（2-6个汉字或等效英文，最多15个字符）
2. 名称要能概括这组书签的共同主题或领域
3. 避免使用过于宽泛的词（如"技术"、"文章"、"学习"）
4. 优先使用领域特定的术语
5. 避免使用标点符号

## 输出格式

请以 JSON 格式返回：
{
  "name": "文件夹名称",
  "reason": "命名理由（简短说明为什么选择这个名称）"
}

只返回 JSON，不要其他内容。`;

  try {
    const response = await generateWithAI(prompt, {
      maxTokens: 150,
      temperature: 0.3,
    });

    // 解析 JSON 响应
    const cleaned = response.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // 验证返回结构
    if (!parsed.name || typeof parsed.name !== "string") {
      throw new Error("Invalid response: missing name");
    }

    // 清理名称（移除特殊字符，限制长度）
    let name = parsed.name.trim().replace(/[^\w\u4e00-\u9fff\s-]/g, "");
    if (name.length > 15) {
      name = name.slice(0, 15);
    }

    return {
      name: name || "未分类",
      reason: parsed.reason || "基于内容相似性自动生成",
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "generateFolderNameFromBookmarks: Failed to generate folder name",
    );

    // 降级策略：尝试从标签中提取主题
    const fallbackName = extractDominantTopic(titles, tags);

    return {
      name: fallbackName || "待整理",
      reason: "AI 生成失败，使用关键词提取",
    };
  }
}

/**
 * 从标题和标签中提取主导主题（降级策略）
 */
function extractDominantTopic(titles: string[], tags: string[]): string {
  // 统计标签频率
  const tagCount = new Map<string, number>();
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    if (normalized.length >= 2 && normalized.length <= 10) {
      tagCount.set(normalized, (tagCount.get(normalized) || 0) + 1);
    }
  }

  // 找出最高频标签
  let maxTag = "";
  let maxCount = 0;
  for (const [tag, count] of tagCount) {
    if (count > maxCount) {
      maxCount = count;
      maxTag = tag;
    }
  }

  if (maxTag) {
    return maxTag;
  }

  // 从标题中提取常见关键词
  const titleText = titles.join(" ");
  const commonKeywords = [
    "前端",
    "后端",
    "React",
    "Vue",
    "Node",
    "Python",
    "AI",
    "机器学习",
    "深度学习",
    "产品",
    "设计",
    "运营",
    "营销",
    "投资",
    "创业",
    "效率",
    "工具",
  ];

  for (const keyword of commonKeywords) {
    if (titleText.includes(keyword)) {
      return keyword;
    }
  }

  return "";
}
