/**
 * 增强型标签标准化器
 *
 * 处理标签的激进标准化，解决 "Vue.js" vs "VueJS"、"Golang" vs "Go" 等匹配问题
 *
 * @module @/lib/classification/v5/classification-pipeline/tag-normalizer
 * @version 1.0.0
 * @since 2026-01-23
 */

import { tagSynonymMapper } from "./tag-synonym-mapper";

/**
 * 标准化结果
 */
export interface NormalizationResult {
  /** 原始标签 */
  original: string;
  /** 标准化后的标签 */
  normalized: string;
  /** 所有变体形式（同义词 + 标准化变体） */
  variants: string[];
}

/**
 * 增强型标签标准化器
 *
 * 功能：
 * 1. 激进标准化：去除所有可能导致不匹配的字符
 * 2. 同义词扩展：结合 TagSynonymMapper 获取所有变体
 * 3. 等价性检查：判断两个标签是否等价
 */
export class TagNormalizer {
  /**
   * 激进标准化
   *
   * 用于匹配比较，去除所有可能导致不匹配的字符
   *
   * @example
   * normalize("Vue.js") // "vuejs"
   * normalize("Next.js") // "nextjs"
   * normalize("C++") // "cpp"
   * normalize("C#") // "csharp"
   * normalize("Node.js") // "nodejs"
   * normalize("React Native") // "reactnative"
   */
  normalize(tag: string): string {
    if (!tag || typeof tag !== "string") {
      return "";
    }

    return (
      tag
        .toLowerCase()
        // 特殊符号转换（必须在去除符号前处理）
        .replace(/\+\+/g, "pp") // C++ → cpp
        .replace(/#/g, "sharp") // C# → csharp
        // 去除所有分隔符
        .replace(/[\s\-_.·/|&@!?()[\]{}'"`,;:]/g, "")
        // 仅保留字母数字和中文
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
        .trim()
    );
  }

  /**
   * 获取标签的所有可能形式
   *
   * 结合同义词映射器，返回标签的所有变体
   */
  getAllVariants(tag: string): NormalizationResult {
    const normalized = this.normalize(tag);
    const synonyms = tagSynonymMapper.getSynonyms(tag);

    const variants = new Set<string>();

    // 添加原始标准化形式
    if (normalized) {
      variants.add(normalized);
    }

    // ���加所有同义词的标准化形式
    for (const synonym of synonyms) {
      const normalizedSynonym = this.normalize(synonym);
      if (normalizedSynonym) {
        variants.add(normalizedSynonym);
      }
    }

    return {
      original: tag,
      normalized,
      variants: Array.from(variants),
    };
  }

  /**
   * 检查两个标签是否等价
   *
   * 等价条件：
   * 1. 标准化后相等
   * 2. 互为同义词
   */
  areEquivalent(tag1: string, tag2: string): boolean {
    if (!tag1 || !tag2) {
      return false;
    }

    const norm1 = this.normalize(tag1);
    const norm2 = this.normalize(tag2);

    // 标准化后直接相等
    if (norm1 === norm2) {
      return true;
    }

    // 检查同义词
    return tagSynonymMapper.areSynonyms(tag1, tag2);
  }

  /**
   * 批量标准化并去重
   */
  normalizeAndDedupe(tags: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const tag of tags) {
      const normalized = this.normalize(tag);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }

    return result;
  }

  /**
   * 扩展标签列表，包含所有变体
   *
   * 用于匹配时扩大召回范围
   */
  expandWithVariants(tags: string[]): string[] {
    const expanded = new Set<string>();

    for (const tag of tags) {
      const result = this.getAllVariants(tag);
      for (const variant of result.variants) {
        expanded.add(variant);
      }
    }

    return Array.from(expanded);
  }

  /**
   * 检查标签是否与目标匹配（包含标准化和同义词检查）
   */
  matches(tag: string, target: string): boolean {
    return this.areEquivalent(tag, target);
  }

  /**
   * 在标签列表中查找与目标等价的标签
   */
  findEquivalentTags(tags: string[], target: string): string[] {
    return tags.filter((tag) => this.areEquivalent(tag, target));
  }

  /**
   * 计算两个标签的相似度（用于部分匹配）
   *
   * @returns 0-1 之间的相似度分数
   */
  calculateSimilarity(tag1: string, tag2: string): number {
    const norm1 = this.normalize(tag1);
    const norm2 = this.normalize(tag2);

    if (!norm1 || !norm2) {
      return 0;
    }

    // 完全相等
    if (norm1 === norm2) {
      return 1.0;
    }

    // 同义词
    if (tagSynonymMapper.areSynonyms(tag1, tag2)) {
      return 0.95;
    }

    // 包含关系
    const isContained = norm1.includes(norm2) || norm2.includes(norm1);
    if (isContained) {
      const shorter = Math.min(norm1.length, norm2.length);
      const longer = Math.max(norm1.length, norm2.length);
      const ratio = shorter / longer;
      // 返回基于长度比例的相似度
      return ratio * 0.8; // 最高 0.8，需要 T0 校验
    }

    return 0;
  }
}

// 导出单例实例
export const tagNormalizer = new TagNormalizer();
