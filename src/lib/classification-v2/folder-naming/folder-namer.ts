/**
 * AI 文件夹命名
 *
 * 当分类系统无法匹配到合适的现有文件夹时，
 * 为书签内容生成一个新的文件夹名称建议。
 *
 * 流程：
 * 1. 提取书签核心信息（标题、标签、摘要）
 * 2. 加载用户现有文件夹做 Few-Shot（避免重名）
 * 3. 构建 Prompt + 调用 LLM
 * 4. 验证 + 清洗（禁止词、长度、格式）
 * 5. 失败回退到本地关键词提取
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { callLlm, sanitizeInput } from "../infra/llm";
import { CLASSIFICATION_CONFIG } from "../config";
import {
  FOLDER_NAMING_RULES,
  FORBIDDEN_NAMES,
  FILLER_SUFFIXES,
  CHINESE_STOP_WORDS,
  isForbiddenName,
  isVagueWord,
  isContextualWord,
  calculateEffectiveLength,
} from "../constants";

/** 命名结果 */
export interface FolderNameSuggestion {
  name: string;
  reason: string;
}

/**
 * 为书签内容生成文件夹名称建议
 *
 * @param title - 书签标题
 * @param tags - 书签标签
 * @param summary - 书签摘要（可选）
 * @param userId - 用户 ID（用于加载现有文件夹避免重名）
 */
export async function suggestFolderName(
  title: string,
  tags: string[],
  summary?: string,
  userId?: string,
): Promise<FolderNameSuggestion> {
  try {
    // 1. 加载用户现有文件夹名（Few-Shot + 去重）
    const existingNames = userId ? await loadExistingFolderNames(userId) : [];

    // 2. 构建 Prompt
    const userPrompt = buildNamingPrompt(title, tags, summary, existingNames);

    // 3. 调用 LLM
    const response = await callLlm({
      systemPrompt: FOLDER_NAMING_RULES,
      userPrompt,
      temperature: 0.3,
      maxTokens: 50,
    });

    // 4. 清洗 + 验证
    const cleaned = cleanFolderName(response.content, existingNames);

    if (cleaned) {
      return { name: cleaned, reason: "AI 生成" };
    }

    // 5. LLM 返回不合格，回退到本地策略
    return fallbackNaming(title, tags, existingNames);
  } catch (error) {
    // LLM 调用失败时降级为本地命名策略，不阻塞分类流程
    logger.warn({ error, title }, "FolderNamer: LLM failed, using fallback");
    return fallbackNaming(title, tags, []);
  }
}

// ============================================================================
// Prompt 构建
// ============================================================================

function buildNamingPrompt(
  title: string,
  tags: string[],
  summary: string | undefined,
  existingNames: string[],
): string {
  const parts: string[] = [];

  parts.push(
    `书签标题：${sanitizeInput(title, CLASSIFICATION_CONFIG.llm.titleMaxLen)}`,
  );

  if (tags.length > 0) {
    parts.push(
      `标签：${tags.slice(0, CLASSIFICATION_CONFIG.llm.maxTags).join("、")}`,
    );
  }

  if (summary) {
    parts.push(
      `摘要：${sanitizeInput(summary, CLASSIFICATION_CONFIG.llm.summaryMaxLen)}`,
    );
  }

  if (existingNames.length > 0) {
    const limit = CLASSIFICATION_CONFIG.folderNaming.recentLimit;
    const sample = existingNames.slice(0, limit);
    parts.push(`用户已有文件夹：${sample.join("、")}（不要重复）`);
  }

  parts.push("请为这个书签生成一个合适的文件夹名称。");

  return parts.join("\n");
}

// ============================================================================
// 名称清洗与验证
// ============================================================================

function cleanFolderName(raw: string, existingNames: string[]): string | null {
  // 提取第一行，去除引号和多余空白
  let name = raw.split("\n")[0].trim();
  name = name.replace(/^["'「」『』【】]+|["'「」『』【】]+$/g, "");
  name = name.trim();

  if (!name || name.length === 0) return null;

  // 移除废话后缀
  for (const suffix of FILLER_SUFFIXES) {
    if (name.endsWith(suffix) && name.length > suffix.length) {
      name = name.slice(0, -suffix.length).trim();
    }
  }

  // 验证禁止词
  if (isForbiddenName(name)) return null;

  // 验证上下文依赖词（单独使用）
  if (isContextualWord(name)) return null;

  // 验证过度概括词
  if (isVagueWord(name)) return null;

  // 长度检查
  const { maxLength } = CLASSIFICATION_CONFIG.folderNaming;
  const effectiveLen = calculateEffectiveLength(name);
  if (effectiveLen > maxLength) {
    // 截断到最大长度
    name = truncateToLength(name, maxLength);
  }
  if (effectiveLen < 1) return null;

  // 去重检查（与现有文件夹名不重复）
  const normalized = name.toLowerCase().trim();
  if (existingNames.some((n) => n.toLowerCase().trim() === normalized)) {
    return null;
  }

  return name;
}

function truncateToLength(name: string, maxLen: number): string {
  let length = 0;
  let result = "";

  for (const char of name) {
    const charLen = /[\u4e00-\u9fa5]/.test(char)
      ? 1
      : /[a-zA-Z0-9]/.test(char)
        ? 0.5
        : 0;
    if (length + charLen > maxLen) break;
    length += charLen;
    result += char;
  }

  return result.trim();
}

// ============================================================================
// 本地回退策略
// ============================================================================

function fallbackNaming(
  title: string,
  tags: string[],
  existingNames: string[],
): FolderNameSuggestion {
  const existingSet = new Set(existingNames.map((n) => n.toLowerCase().trim()));

  // 策略 1：从标签中选择最有意义的
  for (const tag of tags) {
    const t = tag.trim();
    if (
      t.length >= 2 &&
      !FORBIDDEN_NAMES.has(t) &&
      !CHINESE_STOP_WORDS.has(t) &&
      !isVagueWord(t) &&
      !existingSet.has(t.toLowerCase())
    ) {
      return { name: t, reason: "从标签提取" };
    }
  }

  // 策略 2：从标题提取关键词
  const keywords = extractKeywords(title);
  for (const kw of keywords) {
    if (!existingSet.has(kw.toLowerCase())) {
      return { name: kw, reason: "从标题提取" };
    }
  }

  // 策略 3：使用第一个标签
  if (tags.length > 0 && tags[0].trim().length >= 2) {
    return { name: tags[0].trim(), reason: "首标签" };
  }

  // 最终回退
  return { name: "新分类", reason: "默认名称" };
}

/**
 * 从标题中提取关键词
 *
 * 简单策略：按非字母数字中文分割，过滤停用词，
 * 优先返回 2-4 字的中文词组。
 */
function extractKeywords(title: string): string[] {
  // 提取中文词组（2-4 字连续中文）
  const chinesePatterns = title.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];

  // 提取英文单词（至少 3 字母）
  const englishPatterns = title.match(/[a-zA-Z]{3,}/g) ?? [];

  const candidates = [...chinesePatterns, ...englishPatterns];

  return candidates.filter(
    (w) =>
      !CHINESE_STOP_WORDS.has(w) && !FORBIDDEN_NAMES.has(w) && !isVagueWord(w),
  );
}

// ============================================================================
// 数据加载
// ============================================================================

async function loadExistingFolderNames(userId: string): Promise<string[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("folders")
      .select("name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(CLASSIFICATION_CONFIG.folderNaming.recentLimit);

    if (error) {
      logger.warn({ error, userId }, "FolderNamer: load folders failed");
      return [];
    }

    return (data ?? []).map((f) => f.name).filter(Boolean);
  } catch {
    return [];
  }
}
