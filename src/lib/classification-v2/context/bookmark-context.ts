/**
 * BookmarkContext 构建器
 *
 * 将原始分类请求标准化为 BookmarkContext。
 * 包含输入清洗、截断、标签规范化。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import type { ClassifyRequest, BookmarkContext } from "../types";
import { CLASSIFICATION_CONFIG } from "../config";
import { generateEmbedding, buildEmbeddingText } from "@/lib/embedding";

const { titleMaxLen, summaryMaxLen, maxTags } = CLASSIFICATION_CONFIG.llm;

/**
 * 从分类请求构建标准化的书签上下文
 */
export async function buildBookmarkContext(
  request: ClassifyRequest,
): Promise<BookmarkContext> {
  const title = sanitizeText(request.title, titleMaxLen);
  const summary = request.summary
    ? sanitizeText(request.summary, summaryMaxLen)
    : undefined;
  const tags = normalizeTags(request.tags ?? [], maxTags);
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedTags = tags.map((t) => t.toLowerCase().trim());

  // 生成 embedding
  const embeddingText = buildEmbeddingText(title, summary, tags);
  const embedding = await generateEmbedding(embeddingText);

  return {
    bookmarkId: request.bookmarkId,
    title,
    url: request.url,
    summary,
    tags,
    embedding,
    normalizedTitle,
    normalizedTags,
  };
}

/**
 * 清洗文本：移除控制字符、截断
 */
function sanitizeText(text: string, maxLen: number): string {
  // 移除控制字符和零宽字符
  const cleaned = text

    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "")
    .trim();

  // 截断
  if (cleaned.length > maxLen) {
    return cleaned.slice(0, maxLen);
  }
  return cleaned;
}

/**
 * 标签标准化：去重、清洗、截断
 */
function normalizeTags(tags: string[], max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const cleaned = tag.trim();
    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) continue;

    seen.add(lower);
    result.push(cleaned);

    if (result.length >= max) break;
  }

  return result;
}
