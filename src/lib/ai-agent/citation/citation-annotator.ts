/**
 * 引用标注器
 *
 * 在 AI 响应文本中插入引用标注 [^N]
 * 支持序数引用识别（如"第一篇"、"第二条"）
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  Citation,
  CitationAnnotationResult,
  OrdinalPattern,
} from "./types";
import { CHINESE_ORDINAL_MAP } from "./types";

// ============================================================================
// 序数识别模式
// ============================================================================

/**
 * 中文序数模式
 * 匹配：第一篇、第二条、第三个、第1篇、第2条等
 */
const CHINESE_ORDINAL_PATTERNS: OrdinalPattern[] = [
  {
    // 匹配：第一篇/条/个/项/段
    pattern: /第([一二三四五六七八九十])(?:篇|条|个|项|段|则|章)/g,
    extractOrdinal: (match) => CHINESE_ORDINAL_MAP[match[1]] || 0,
  },
  {
    // 匹配：第1篇/条/个/项/段
    pattern: /第(\d+)(?:篇|条|个|项|段|则|章)/g,
    extractOrdinal: (match) => parseInt(match[1], 10),
  },
  {
    // 匹配：首篇/条
    pattern: /(?:首|头)(?:篇|条)/g,
    extractOrdinal: () => 1,
  },
  {
    // 匹配：第一/二/三个搜索结果
    pattern: /第([一二三四五六七八九十])(?:个)?(?:搜索)?结果/g,
    extractOrdinal: (match) => CHINESE_ORDINAL_MAP[match[1]] || 0,
  },
  {
    // 匹配：第1/2/3个搜索结果
    pattern: /第(\d+)(?:个)?(?:搜索)?结果/g,
    extractOrdinal: (match) => parseInt(match[1], 10),
  },
];

// ============================================================================
// CitationAnnotator 类
// ============================================================================

/**
 * 引用标注器
 *
 * 识别文本中的序数引用，并替换为 [^N] 格式
 */
export class CitationAnnotator {
  /**
   * 在文本中标注引用
   *
   * @param text - 原始文本
   * @param citations - 可用的引用列表
   * @param options - 标注选项
   * @returns 标注结果
   */
  annotate(
    text: string,
    citations: Citation[],
    options: {
      /** 是否保留原文 */
      preserveOriginal?: boolean;
      /** 最大引用编号 */
      maxIndex?: number;
    } = {},
  ): CitationAnnotationResult {
    const { preserveOriginal = false, maxIndex = citations.length } = options;

    if (citations.length === 0) {
      return {
        annotatedText: text,
        usedCitations: [],
        matchCount: 0,
        hasNewCitations: false,
      };
    }

    const usedCitations = new Set<number>();
    let annotatedText = text;
    let matchCount = 0;

    // 按模式匹配并替换
    for (const patternDef of CHINESE_ORDINAL_PATTERNS) {
      // 重置正则状态，避免多次调用时 lastIndex 保持旧值
      patternDef.pattern.lastIndex = 0;

      annotatedText = annotatedText.replace(
        patternDef.pattern,
        (match, ...args) => {
          // args 的最后两个参数是 offset 和 string
          const argsArray = args as unknown[];
          const offset = argsArray[argsArray.length - 2] as number;
          const fullString = argsArray[argsArray.length - 1] as string;

          // 检查是否已有引用标注（避免重复标注）
          const afterMatch = fullString.substring(offset + match.length);
          if (/^\[\^\d+\]/.test(afterMatch)) {
            return match; // 已有标注，保持原样
          }

          // 提取序数
          const regexMatch = [match, ...args.slice(0, -2)] as RegExpMatchArray;
          const ordinal = patternDef.extractOrdinal(regexMatch);

          // 验证序数有效性
          if (ordinal <= 0 || ordinal > maxIndex) {
            return match; // 保持原样
          }

          // 查找对应引用
          const citation = citations.find((c) => c.index === ordinal);
          if (!citation) {
            return match; // 保持原样
          }

          usedCitations.add(ordinal);
          matchCount++;

          // 生成替换文本
          if (preserveOriginal) {
            return `${match}[^${ordinal}]`;
          } else {
            return `${match}[^${ordinal}]`;
          }
        },
      );
    }

    return {
      annotatedText,
      usedCitations: Array.from(usedCitations).sort((a, b) => a - b),
      matchCount,
      hasNewCitations: usedCitations.size > 0,
    };
  }

  /**
   * 检测文本中的序数引用
   *
   * @param text - 待检测文本
   * @returns 检测到的序数列表
   */
  detectOrdinals(text: string): number[] {
    const ordinals = new Set<number>();

    for (const patternDef of CHINESE_ORDINAL_PATTERNS) {
      // 重置正则状态
      patternDef.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = patternDef.pattern.exec(text)) !== null) {
        const ordinal = patternDef.extractOrdinal(match);
        if (ordinal > 0) {
          ordinals.add(ordinal);
        }
      }
    }

    return Array.from(ordinals).sort((a, b) => a - b);
  }

  /**
   * 检查文本是否已包含引用标记
   *
   * @param text - 待检查文本
   * @returns 是否包含引用标记
   */
  hasExistingCitations(text: string): boolean {
    return /\[\^(\d+)\]/.test(text);
  }

  /**
   * 提取文本中已有的引用编号
   *
   * @param text - 待提取文本
   * @returns 引用编号列表
   */
  extractExistingCitations(text: string): number[] {
    const citations = new Set<number>();
    const pattern = /\[\^(\d+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      citations.add(parseInt(match[1], 10));
    }

    return Array.from(citations).sort((a, b) => a - b);
  }

  /**
   * 移除文本中的引用标记
   *
   * @param text - 待处理文本
   * @returns 处理后的文本
   */
  removeCitations(text: string): string {
    return text.replace(/\[\^(\d+)\]/g, "");
  }

  /**
   * 规范化引用标记
   * 确保引用编号连续且从 1 开始
   *
   * @param text - 待规范化文本
   * @returns 规范化结果
   */
  normalizeCitations(text: string): {
    normalizedText: string;
    mapping: Map<number, number>;
  } {
    const existingCitations = this.extractExistingCitations(text);
    const mapping = new Map<number, number>();

    // 建立新旧编号映射
    existingCitations.forEach((oldIndex, i) => {
      mapping.set(oldIndex, i + 1);
    });

    // 替换文本中的引用
    const normalizedText = text.replace(/\[\^(\d+)\]/g, (_, indexStr) => {
      const oldIndex = parseInt(indexStr, 10);
      const newIndex = mapping.get(oldIndex);
      return newIndex !== undefined ? `[^${newIndex}]` : `[^${indexStr}]`;
    });

    return { normalizedText, mapping };
  }
}

// ============================================================================
// 单例实例
// ============================================================================

/** 全局引用标注器实例 */
let globalAnnotator: CitationAnnotator | null = null;

/**
 * 获取全局引用标注器实例
 */
export function getCitationAnnotator(): CitationAnnotator {
  if (!globalAnnotator) {
    globalAnnotator = new CitationAnnotator();
  }
  return globalAnnotator;
}
