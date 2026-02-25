/**
 * 文件夹命名生成器
 *
 * 从聚类书签中生成语义化的文件夹名称
 * 使用统一的命名规则（naming-rules.ts）
 *
 * @module ai-generator/folder/folder-name-generator
 * @version 2.0.0
 * @since 2026-02-25 统一命名规则优化
 */

import { logger } from "@/lib/logger";
import { generateWithAI } from "../api/deepseek-client";
import { FOLDER_NAMING_RULES } from "@/lib/classification/constants/naming-rules";
import {
  sanitizeFolderName,
  generateFallbackName,
} from "@/lib/classification/utils/folder-name-sanitizer";
import type {
  GenerateFolderNameRequest,
  GenerateFolderNameResult,
} from "../types";

/**
 * 从聚类的书签中生成语义化的文件夹名称
 *
 * 用于 V4.2 智能分拣功能，当系统检测到缓存池中有相似书签时自动生成文件夹建议
 *
 * @param request - 包含聚类书签的标题、标签和摘要信息
 * @returns 文件夹名称和命名理由
 */
export async function generateFolderNameFromBookmarks(
  request: GenerateFolderNameRequest,
): Promise<GenerateFolderNameResult> {
  const { titles, tags, summaries, count } = request;

  const titlesContext = titles.slice(0, 10).join("\n- ");
  const tagsContext = tags.slice(0, 20).join(", ");
  const summariesContext = summaries
    .slice(0, 5)
    .map((s) => s.slice(0, 200))
    .join("\n---\n");

  // 使用统一的 Prompt 模板
  const prompt = `你是一个智能收藏夹命名助手。根据以下聚类的书签内容，为这组书签生成一个简洁且有语义的文件夹名称。

${FOLDER_NAMING_RULES}

## 书签信息

**数量**: ${count} 个书签

**标题列表**:
- ${titlesContext}

**标签**:
${tagsContext}

**部分摘要**:
${summariesContext}

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

    const cleaned = response.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.name || typeof parsed.name !== "string") {
      throw new Error("Invalid response: missing name");
    }

    // 使用统一的清洗管道
    const sanitization = sanitizeFolderName(parsed.name, {
      tags,
      title: titles[0],
    });

    if (sanitization.usedFallback || sanitization.wasSanitized) {
      logger.info(
        {
          originalName: parsed.name,
          sanitizedName: sanitization.name,
          appliedRules: sanitization.appliedRules,
          usedFallback: sanitization.usedFallback,
        },
        "[FolderNameGenerator] Name sanitized",
      );
    }

    return {
      name: sanitization.name,
      reason: sanitization.usedFallback
        ? "AI 命名无效，使用智能回退"
        : parsed.reason || "基于内容相似性自动生成",
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "generateFolderNameFromBookmarks: Failed to generate folder name",
    );

    // 使用统一的回退策略
    const fallbackName = generateFallbackName(tags, titles[0]);

    return {
      name: fallbackName,
      reason: "AI 生成失败，使用智能回退",
    };
  }
}
