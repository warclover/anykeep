/**
 * 文件夹推荐器
 *
 * 基于 AI 和规则的文件夹推荐
 *
 * @module ai-generator/folder/folder-recommender
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import type { FolderRecommendation, ExistingFolder } from "../types";
import {
  calculateSemanticSimilarity,
  extractKeyword,
} from "./semantic-matcher";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

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
export function generateFallbackFolderRecommendation(
  title: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): FolderRecommendation {
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
        break;
      } else if (folderNameLower.includes(tagLower)) {
        score += 50;
        matchDetails.push(`标签"${tag}"部分匹配`);
      } else if (
        tagLower.includes(folderNameLower) &&
        folderNameLower.length > 1
      ) {
        score += 40;
        matchDetails.push(`文件夹名包含在标签"${tag}"中`);
      }
    }

    // 1.5. 关键词级别匹配
    const matchedKeywords = new Set<string>();
    for (const tag of tags) {
      const tagWords = tag
        .toLowerCase()
        .split(/[\s\-_]+/)
        .filter((w) => w.length >= 2);

      for (const word of tagWords) {
        if (word.length >= 3 && folderNameLower.includes(word)) {
          if (!matchedKeywords.has(word)) {
            matchedKeywords.add(word);
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

    // 2. 标题关键词匹配
    const titleWords = title
      .toLowerCase()
      .split(/[\s,，、]+/)
      .filter((w) => w.length > 1);
    let titleMatchCount = 0;
    for (const word of titleWords) {
      if (folderNameLower.includes(word)) {
        score += 15;
        titleMatchCount++;
        if (titleMatchCount >= 2) break;
      }
    }
    if (titleMatchCount > 0) {
      matchDetails.push(`标题关键词匹配(${titleMatchCount}个)`);
    }

    // 3. 语义相似度匹配
    const semanticScore = calculateSemanticSimilarity(folderNameLower, tags);
    if (semanticScore > 0) {
      score += semanticScore;
      matchDetails.push(`语义关联匹配`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = folder;
      matchReason = matchDetails.join("；");
    }
  }

  if (bestMatch && bestScore >= 40) {
    return {
      folderId: bestMatch.id,
      folderName: bestMatch.name,
      confidence: Math.min(95, bestScore),
      reason: matchReason || "基于标签匹配",
      suggestNew: false,
    };
  }

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
 * 推荐文件夹
 *
 * 基于内容和现有文件夹列表，AI 推荐最合适的文件夹
 */
export async function recommendFolder(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): Promise<FolderRecommendation> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

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

    const response = await fetch(DEEPSEEK_API_URL, {
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
        temperature: 0.3,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(10000),
    });

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
