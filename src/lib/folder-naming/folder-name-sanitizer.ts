/**
 * 文件夹名称清洗管道
 *
 * 对 AI 生成的文件夹名称进行后处理清洗，确保：
 * 1. 去除无效字符和格式
 * 2. 移除废话后缀和动词前缀
 * 3. 规范化空格
 * 4. 长度控制
 * 5. 黑名单检测
 * 6. 智能回退
 *
 * @version 1.0.0
 * @since 2026-02-25
 */

import { logger } from "@/lib/logger";
import {
  FILLER_SUFFIXES,
  VERB_PREFIXES,
  FILLER_WORDS,
  REDUNDANT_MODIFIERS,
  NAME_LENGTH_CONFIG,
  CHINESE_STOP_WORDS,
  isForbiddenNameA,
  isVagueWord,
  isContextualWord,
  calculateEffectiveLength,
  isNameLengthValid,
} from "./naming-rules";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 清洗结果
 */
export interface SanitizationResult {
  /** 清洗后的名称 */
  name: string;
  /** 原始名称 */
  originalName: string;
  /** 是否进行了清洗 */
  wasSanitized: boolean;
  /** 应用的清洗规则 */
  appliedRules: string[];
  /** 是否使用了回退 */
  usedFallback: boolean;
  /** 回退原因 */
  fallbackReason?: string;
}

/**
 * 清洗配置
 */
export interface SanitizationConfig {
  /** 标签列表（用于回退） */
  tags?: string[];
  /** 书签标题（用于关键词提取回退） */
  title?: string;
  /** 最大长度（默认 8） */
  maxLength?: number;
  /** 是否启用严格模式（A 类黑名单强制拦截） */
  strictMode?: boolean;
}

// ============================================================================
// 核心清洗函数
// ============================================================================

/**
 * 清洗文件夹名称
 *
 * 执行 7 步清洗流程：
 * 0. 原始黑名单检查（在清洗前先检查原始名称）
 * 1. 去除引号
 * 2. 去除废话后缀
 * 3. 去除动词前缀
 * 4. 空格规范化
 * 5. 长度截断
 * 6. 黑名单检测
 */
export function sanitizeFolderName(
  name: string,
  config: SanitizationConfig = {},
): SanitizationResult {
  const {
    tags = [],
    title = "",
    maxLength = NAME_LENGTH_CONFIG.max,
    strictMode = true,
  } = config;

  let result = name.trim();
  const appliedRules: string[] = [];
  const originalName = result;

  // 步骤 0：原始黑名单检查（在清洗前先检查）
  // 这确保如 "待整理" 这样的黑名单词不会被错误地清洗成非黑名单词
  if (isForbiddenNameA(originalName)) {
    const fallback = generateFallbackName(tags, title);
    return {
      name: fallback,
      originalName,
      wasSanitized: true,
      appliedRules: ["early_blacklist_check"],
      usedFallback: true,
      fallbackReason: `名称 "${originalName}" 在黑名单中`,
    };
  }

  // 步骤 1：去除引号和包裹字符
  const afterQuotes = removeQuotes(result);
  if (afterQuotes !== result) {
    appliedRules.push("remove_quotes");
    result = afterQuotes;
  }

  // 步骤 2：去除废话后缀
  const afterSuffixes = removeFillerSuffixes(result);
  if (afterSuffixes !== result) {
    appliedRules.push("remove_suffixes");
    result = afterSuffixes;
  }

  // 步骤 3：去除动词前缀
  const afterPrefixes = removeVerbPrefixes(result);
  if (afterPrefixes !== result) {
    appliedRules.push("remove_prefixes");
    result = afterPrefixes;
  }

  // 步骤 4：去除冗余修饰词
  const afterModifiers = removeRedundantModifiers(result);
  if (afterModifiers !== result) {
    appliedRules.push("remove_modifiers");
    result = afterModifiers;
  }

  // 步骤 5：空格规范化
  const afterSpaces = normalizeSpaces(result);
  if (afterSpaces !== result) {
    appliedRules.push("normalize_spaces");
    result = afterSpaces;
  }

  // 步骤 6：长度截断
  if (calculateEffectiveLength(result) > maxLength) {
    const afterTruncate = truncateName(result, maxLength);
    if (afterTruncate !== result) {
      appliedRules.push("truncate_length");
      result = afterTruncate;
    }
  }

  // 步骤 7：黑名单检测和回退
  const finalResult = checkAndFallback(result, {
    tags,
    title,
    strictMode,
  });

  if (finalResult.usedFallback) {
    return {
      name: finalResult.name,
      originalName,
      wasSanitized: finalResult.name !== originalName,
      appliedRules: [...appliedRules, "fallback"],
      usedFallback: true,
      fallbackReason: finalResult.reason,
    };
  }

  const wasSanitized = result !== originalName;

  if (wasSanitized) {
    logger.debug(
      {
        originalName,
        sanitizedName: result,
        appliedRules,
      },
      "[FolderNameSanitizer] Name sanitized",
    );
  }

  return {
    name: result,
    originalName,
    wasSanitized,
    appliedRules,
    usedFallback: false,
  };
}

// ============================================================================
// 清洗步骤函数
// ============================================================================

/**
 * 步骤 1：去除引号和包裹字符
 */
function removeQuotes(name: string): string {
  return name
    .replace(/^["']+|["']+$/g, "") // 首尾引号
    .replace(/^[「」『』【】《》〈〉]|["''「」『』【】《》〈〉]$/g, "") // 中文引号
    .trim();
}

/**
 * 步骤 2：去除废话后缀
 */
function removeFillerSuffixes(name: string): string {
  let result = name;

  // 按长度降序排列，优先匹配更长的后缀
  const sortedSuffixes = [...FILLER_SUFFIXES].sort(
    (a, b) => b.length - a.length,
  );

  for (const suffix of sortedSuffixes) {
    if (result.endsWith(suffix) && result.length > suffix.length) {
      // 确保去除后缀后不会产生孤立的空格
      result = result.slice(0, -suffix.length).trim();
    }
  }

  return result;
}

/**
 * 步骤 3：去除动词前缀
 */
function removeVerbPrefixes(name: string): string {
  let result = name;

  // 按长度降序排列，优先匹配更长的前缀
  const sortedPrefixes = [...VERB_PREFIXES].sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (result.startsWith(prefix) && result.length > prefix.length) {
      // 去除前缀后的空格
      result = result.slice(prefix.length).replace(/^\s+/, "");
    }
  }

  return result;
}

/**
 * 步骤 4：去除冗余修饰词
 */
function removeRedundantModifiers(name: string): string {
  let result = name;

  const sortedModifiers = [...REDUNDANT_MODIFIERS].sort(
    (a, b) => b.length - a.length,
  );

  for (const modifier of sortedModifiers) {
    // 去除开头的修饰词
    if (result.startsWith(modifier) && result.length > modifier.length) {
      result = result.slice(modifier.length).replace(/^\s+/, "");
    }
  }

  return result;
}

/**
 * 步骤 5：空格规范化
 *
 * - 中英文间确保恰好一个空格
 * - 合并多个连续空格
 * - 去除首尾空格
 */
function normalizeSpaces(name: string): string {
  let result = name;

  // 中英文间加空格：React学习 → React 学习
  result = result.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, "$1 $2");
  result = result.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, "$1 $2");

  // 合并多个空格
  result = result.replace(/\s+/g, " ");

  // 去除首尾空格
  result = result.trim();

  return result;
}

/**
 * 步骤 6：长度截断
 *
 * 优先移除修饰词来缩短，实在不行才直接截断
 */
function truncateName(name: string, maxLength: number): string {
  // 如果有效长度已经在范围内，直接返回
  if (calculateEffectiveLength(name) <= maxLength) {
    return name;
  }

  // 尝试移除口水词来缩短
  let result = name;

  // 移除 FILLER_WORDS
  for (const filler of FILLER_WORDS) {
    if (result.includes(filler)) {
      result = result.replace(new RegExp(filler, "g"), "").trim();
      result = normalizeSpaces(result);
      if (calculateEffectiveLength(result) <= maxLength) {
        return result;
      }
    }
  }

  // 如果仍然过长，按空格分割取前面部分
  const parts = result.split(/\s+/);
  if (parts.length > 1) {
    // 从后往前移除部分，直到长度合适
    while (
      parts.length > 1 &&
      calculateEffectiveLength(parts.join(" ")) > maxLength
    ) {
      parts.pop();
    }
    result = parts.join(" ");
    if (calculateEffectiveLength(result) <= maxLength) {
      return result;
    }
  }

  // 最后手段：直接截断（按字符）
  // 注意：需要考虑中英文混合的情况
  let truncated = "";
  let effectiveLen = 0;

  for (const char of name) {
    const charLen = /[\u4e00-\u9fa5]/.test(char) ? 1 : 0.5;
    if (effectiveLen + charLen > maxLength) {
      break;
    }
    truncated += char;
    effectiveLen += charLen;
  }

  return truncated.trim() || name.slice(0, maxLength);
}

// ============================================================================
// 黑名单检测和回退
// ============================================================================

/**
 * 步骤 7：黑名单检测和回退
 */
function checkAndFallback(
  name: string,
  config: {
    tags: string[];
    title: string;
    strictMode: boolean;
  },
): { name: string; usedFallback: boolean; reason?: string } {
  const { tags, title, strictMode } = config;
  const trimmedName = name.trim();

  // 检查 A 类黑名单
  if (isForbiddenNameA(trimmedName)) {
    const fallback = generateFallbackName(tags, title);
    return {
      name: fallback,
      usedFallback: true,
      reason: `名称 "${trimmedName}" 在黑名单中`,
    };
  }

  // 检查过度概括词（单独使用）
  if (strictMode && isVagueWord(trimmedName)) {
    const fallback = generateFallbackName(tags, title);
    return {
      name: fallback,
      usedFallback: true,
      reason: `名称 "${trimmedName}" 过于概括`,
    };
  }

  // 检查上下文依赖词（单独使用）
  if (strictMode && isContextualWord(trimmedName)) {
    const fallback = generateFallbackName(tags, title);
    return {
      name: fallback,
      usedFallback: true,
      reason: `名称 "${trimmedName}" 需要上下文`,
    };
  }

  // 检查空名称
  if (!trimmedName) {
    const fallback = generateFallbackName(tags, title);
    return {
      name: fallback,
      usedFallback: true,
      reason: "名称为空",
    };
  }

  return { name: trimmedName, usedFallback: false };
}

// ============================================================================
// 回退策略
// ============================================================================

/**
 * 生成回退名称
 *
 * 多级回退策略：
 * 1. 前 2 个最频繁标签组合
 * 2. 第一个非泛化标签
 * 3. 标题关键词提取
 * 4. 时间戳回退（最终兜底）
 */
export function generateFallbackName(tags: string[], title: string): string {
  // 优先级 1：前 2 个最频繁标签组合
  if (tags.length >= 2) {
    const validTags = tags
      .filter((t) => !isVagueWord(t) && !isContextualWord(t))
      .slice(0, 2);

    if (validTags.length >= 2) {
      const combined = validTags.join(" ");
      if (combined.length <= NAME_LENGTH_CONFIG.max) {
        return combined;
      }
    }

    // 优先级 2：第一个非泛化标签
    const nonVagueTag = tags.find(
      (t) => !isVagueWord(t) && !isContextualWord(t),
    );
    if (nonVagueTag && nonVagueTag.length <= NAME_LENGTH_CONFIG.max) {
      return nonVagueTag;
    }
  } else if (tags.length === 1) {
    // 只有一个标签时，检查是否有效
    const tag = tags[0];
    if (
      !isVagueWord(tag) &&
      !isContextualWord(tag) &&
      tag.length <= NAME_LENGTH_CONFIG.max
    ) {
      return tag;
    }
  }

  // 优先级 3：标题关键词提取
  const keywords = extractKeywords(title);
  if (keywords.length > 0) {
    const keyword = keywords[0];
    if (keyword.length <= NAME_LENGTH_CONFIG.max) {
      return keyword;
    }
  }

  // 优先级 4：时间戳回退（最终兜底）
  return generateTimestampFallback();
}

/**
 * 从标题提取关键词
 */
export function extractKeywords(title: string): string[] {
  if (!title) return [];

  // 移除标点符号
  const cleaned = title.replace(
    /[，。！？、；：""''【】《》\(\)\[\]（）\s]/g,
    " ",
  );

  // 分词（按空格分割）
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 6)
    .filter((w) => !CHINESE_STOP_WORDS.has(w))
    .filter((w) => !/^\d+$/.test(w)); // 过滤纯数字

  // 返回有意义的词
  return [...new Set(words)].slice(0, 3);
}

/**
 * 生成时间戳回退名称
 *
 * 格式：收藏 MMDD
 */
export function generateTimestampFallback(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `收藏 ${month}${day}`;
}

// ============================================================================
// 验证函数
// ============================================================================

/**
 * 验证文件夹名称
 *
 * 返回验证结果和问题列表
 */
export function validateFolderName(name: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 检查空名称
  if (!name || !name.trim()) {
    issues.push("名称不能为空");
    return { valid: false, issues };
  }

  const trimmed = name.trim();

  // 检查黑名单
  if (isForbiddenNameA(trimmed)) {
    issues.push(`"${trimmed}" 是保留名称，不可使用`);
  }

  // 检查过度概括
  if (isVagueWord(trimmed)) {
    issues.push(`"${trimmed}" 过于概括，请使用更具体的名称`);
  }

  // 检查长度
  if (!isNameLengthValid(trimmed)) {
    const effectiveLen = calculateEffectiveLength(trimmed);
    if (effectiveLen < NAME_LENGTH_CONFIG.optimal.min) {
      issues.push(
        `名称过短（建议 ${NAME_LENGTH_CONFIG.optimal.min}-${NAME_LENGTH_CONFIG.max} 字）`,
      );
    } else if (effectiveLen > NAME_LENGTH_CONFIG.max) {
      issues.push(
        `名称过长（建议 ${NAME_LENGTH_CONFIG.optimal.min}-${NAME_LENGTH_CONFIG.max} 字）`,
      );
    }
  }

  // 检查特殊字符
  if (/[^\w\s\u4e00-\u9fa5\-]/.test(trimmed)) {
    issues.push("名称包含特殊字符");
  }

  // 检查前后空格
  if (name !== trimmed) {
    issues.push("名称包含前后空格");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
