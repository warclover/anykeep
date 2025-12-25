/**
 * 文件夹命名生成器
 *
 * 从聚类书签中生成语义化的文件夹名称
 *
 * @module ai-generator/folder/folder-name-generator
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import { generateWithAI } from "../api/deepseek-client";
import { extractDominantTopic } from "./semantic-matcher";
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

    const cleaned = response.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.name || typeof parsed.name !== "string") {
      throw new Error("Invalid response: missing name");
    }

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

    const fallbackName = extractDominantTopic(titles, tags);

    return {
      name: fallbackName || "待整理",
      reason: "AI 生成失败，使用关键词提取",
    };
  }
}
