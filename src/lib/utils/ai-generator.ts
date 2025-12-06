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
  const _config = getAISummaryConfig(); // 保留配置引用用于调试

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

    // 如果没有 keywords，从 key_points 提取
    if (tags.length === 0 && parsed.key_points.length > 0) {
      tags = ["收藏", "阅读"];
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
                "你是一个内容分类助手。你的任务是根据内容特征，推荐最合适的文件夹。请严格按照 JSON 格式返回结果。",
            },
            {
              role: "user",
              content: prompt,
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
 * 构建文件夹推荐提示词
 */
function buildFolderRecommendationPrompt(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): string {
  const folderList = existingFolders
    .map((f) => `- ${f.name} (ID: ${f.id})`)
    .join("\n");

  return `请根据以下内容，从现有文件夹中选择最合适的一个，或建议创建新文件夹。

内容信息：
- 标题：${title}
- 摘要：${summary}
- 标签：${tags.join("、")}

现有文件夹：
${folderList || "（暂无文件夹）"}

请以 JSON 格式返回：
{
  "recommendedFolderId": 123,  // 推荐的文件夹 ID，如建议新建则为 null
  "folderName": "文件夹名称",  // 推荐的文件夹名（已有的或建议新建的）
  "confidence": 85,           // 置信度 0-100
  "reason": "推荐理由",       // 简短说明为什么推荐这个文件夹
  "suggestNew": false         // 是否建议新建文件夹
}

要求：
1. 如果现有文件夹中有匹配的，优先推荐现有文件夹
2. 只有内容主题与现有文件夹都不匹配时，才建议新建
3. 建议新建时，给出简洁有意义的文件夹名称
4. 只返回 JSON，不要额外说明`;
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
  // 领域关键词映射表
  const semanticKeywords: Record<string, string[]> = {
    前端: [
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "css",
      "html",
      "web",
      "next.js",
      "nuxt",
      "webpack",
      "vite",
    ],
    后端: [
      "java",
      "python",
      "node",
      "golang",
      "php",
      "api",
      "database",
      "server",
      "spring",
      "django",
      "express",
      "mysql",
      "postgresql",
    ],
    设计: [
      "figma",
      "sketch",
      "ui",
      "ux",
      "用户体验",
      "交互",
      "界面",
      "视觉",
      "adobe",
      "photoshop",
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
    ],
    数据: [
      "分析",
      "sql",
      "pandas",
      "可视化",
      "bi",
      "excel",
      "tableau",
      "统计",
      "机器学习",
    ],
    移动: [
      "ios",
      "android",
      "flutter",
      "react native",
      "swift",
      "kotlin",
      "小程序",
      "移动开发",
    ],
    运维: [
      "docker",
      "kubernetes",
      "devops",
      "ci/cd",
      "linux",
      "部署",
      "监控",
      "nginx",
    ],
    AI: [
      "机器学习",
      "深度学习",
      "chatgpt",
      "openai",
      "神经网络",
      "自然语言",
      "llm",
      "prompt",
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
