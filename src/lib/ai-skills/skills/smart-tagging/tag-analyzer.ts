/**
 * 标签分析工具
 *
 * 用于分析书签内容并生成标签建议
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type {
  TagSuggestion,
  BookmarkTagSuggestion,
  MergedTag,
  RemovedTag,
  TagStatistics,
} from "./types";
import { SMART_TAGGING_CONFIG } from "./types";

/**
 * 书签数据类型
 */
export interface BookmarkData {
  id: number;
  title: string;
  url: string;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
  platform?: string | null;
  tags?: Array<{ name: string }>;
}

/**
 * 标签分析器
 */
export class TagAnalyzer {
  private stopWords: Set<string>;
  private techKeywords: Set<string>;

  constructor() {
    this.stopWords = new Set(
      SMART_TAGGING_CONFIG.STOP_WORDS.map((w) => w.toLowerCase()),
    );
    this.techKeywords = new Set(
      SMART_TAGGING_CONFIG.TECH_KEYWORDS.map((w) => w.toLowerCase()),
    );
  }

  /**
   * 为单个书签生成标签建议
   */
  generateSuggestions(
    bookmark: BookmarkData,
    existingVocabulary: Set<string>,
    maxTags: number,
    useExisting: boolean,
  ): BookmarkTagSuggestion {
    const suggestions: TagSuggestion[] = [];
    const currentTags = bookmark.tags?.map((t) => t.name) || [];
    const currentTagsSet = new Set(currentTags.map((t) => t.toLowerCase()));

    // 1. 从 AI 标签获取建议
    if (bookmark.ai_tags && bookmark.ai_tags.length > 0) {
      bookmark.ai_tags.forEach((tag) => {
        if (!currentTagsSet.has(tag.toLowerCase())) {
          suggestions.push({
            tag,
            confidence: 0.9,
            reason: "AI 自动生成",
            source: "ai",
          });
        }
      });
    }

    // 2. 从平台获取标签
    if (bookmark.platform) {
      const platformTags =
        SMART_TAGGING_CONFIG.PLATFORM_TAG_MAP[
          bookmark.platform.toLowerCase() as keyof typeof SMART_TAGGING_CONFIG.PLATFORM_TAG_MAP
        ];
      if (platformTags) {
        platformTags.forEach((tag) => {
          if (!currentTagsSet.has(tag.toLowerCase())) {
            suggestions.push({
              tag,
              confidence: 0.7,
              reason: `来自平台 ${bookmark.platform}`,
              source: "platform",
            });
          }
        });
      }
    }

    // 3. 从标题提取关键词
    const titleKeywords = this.extractKeywords(bookmark.title);
    titleKeywords.forEach((keyword) => {
      if (!currentTagsSet.has(keyword.toLowerCase())) {
        const confidence = this.calculateConfidence(
          keyword,
          existingVocabulary,
          useExisting,
        );
        if (confidence >= SMART_TAGGING_CONFIG.CONFIDENCE_THRESHOLD) {
          suggestions.push({
            tag: keyword,
            confidence,
            reason: "从标题提取",
            source: "title",
          });
        }
      }
    });

    // 4. 从摘要提取关键词
    if (bookmark.ai_summary) {
      const summaryKeywords = this.extractKeywords(bookmark.ai_summary);
      summaryKeywords.forEach((keyword) => {
        if (
          !currentTagsSet.has(keyword.toLowerCase()) &&
          !suggestions.some(
            (s) => s.tag.toLowerCase() === keyword.toLowerCase(),
          )
        ) {
          const confidence =
            this.calculateConfidence(keyword, existingVocabulary, useExisting) *
            0.8; // 摘要关键词置信度稍低
          if (confidence >= SMART_TAGGING_CONFIG.CONFIDENCE_THRESHOLD) {
            suggestions.push({
              tag: keyword,
              confidence,
              reason: "从摘要提取",
              source: "summary",
            });
          }
        }
      });
    }

    // 5. 匹配现有标签词汇
    if (useExisting) {
      existingVocabulary.forEach((existingTag) => {
        const lowerTag = existingTag.toLowerCase();
        if (
          !currentTagsSet.has(lowerTag) &&
          !suggestions.some((s) => s.tag.toLowerCase() === lowerTag) &&
          this.isTagRelevant(existingTag, bookmark)
        ) {
          suggestions.push({
            tag: existingTag,
            confidence: 0.6,
            reason: "匹配现有标签词汇",
            source: "existing",
          });
        }
      });
    }

    // 去重并排序
    const uniqueSuggestions = this.deduplicateAndRank(suggestions);

    return {
      bookmarkId: bookmark.id,
      bookmarkTitle: bookmark.title,
      currentTags,
      suggestedTags: uniqueSuggestions.slice(0, maxTags),
    };
  }

  /**
   * 提取关键词
   */
  extractKeywords(text: string): string[] {
    if (!text) return [];

    const keywords: string[] = [];

    // 提取英文单词
    const englishWords =
      text.match(/[a-zA-Z][a-zA-Z0-9./-]*[a-zA-Z0-9]/g) || [];
    englishWords.forEach((word) => {
      const lower = word.toLowerCase();
      if (
        lower.length >= 2 &&
        !this.stopWords.has(lower) &&
        (this.techKeywords.has(lower) || lower.length >= 4)
      ) {
        // 保持原始大小写（如 React, Vue）
        keywords.push(this.normalizeCase(word));
      }
    });

    // 提取中文词组（2-4字）
    const chineseText = text.replace(/[a-zA-Z0-9\s]+/g, "");
    const chineseWords = this.extractChineseKeywords(chineseText);
    keywords.push(...chineseWords);

    return [...new Set(keywords)];
  }

  /**
   * 提取中文关键词
   */
  private extractChineseKeywords(text: string): string[] {
    const keywords: string[] = [];
    const invalidChars = /[，。、！？""''：；（）【】《》\s\d]/;

    // 基于常见技术词汇匹配
    const techPatterns = [
      /前端/g,
      /后端/g,
      /全栈/g,
      /架构/g,
      /设计模式/g,
      /微服务/g,
      /数据库/g,
      /缓存/g,
      /性能优化/g,
      /安全/g,
      /测试/g,
      /部署/g,
      /运维/g,
      /算法/g,
      /数据结构/g,
      /机器学习/g,
      /深度学习/g,
      /人工智能/g,
      /云计算/g,
      /容器/g,
      /编程/g,
      /开发/g,
      /框架/g,
      /工具/g,
      /教程/g,
      /入门/g,
      /进阶/g,
      /实战/g,
      /源码/g,
      /原理/g,
    ];

    techPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    });

    // 提取 2-4 字词组
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= text.length - len; i++) {
        const word = text.slice(i, i + len);
        if (!invalidChars.test(word) && !this.stopWords.has(word)) {
          // 只保留不包含已有关键词子串的词
          if (!keywords.some((k) => k.includes(word) || word.includes(k))) {
            keywords.push(word);
          }
        }
      }
    }

    return [...new Set(keywords)].slice(0, 10);
  }

  /**
   * 规范化大小写
   */
  private normalizeCase(word: string): string {
    const lower = word.toLowerCase();

    // 已知的正确大小写
    const knownCases: Record<string, string> = {
      react: "React",
      vue: "Vue",
      angular: "Angular",
      javascript: "JavaScript",
      typescript: "TypeScript",
      python: "Python",
      java: "Java",
      nodejs: "Node.js",
      nextjs: "Next.js",
      docker: "Docker",
      kubernetes: "Kubernetes",
      graphql: "GraphQL",
      mongodb: "MongoDB",
      postgresql: "PostgreSQL",
      mysql: "MySQL",
      redis: "Redis",
      github: "GitHub",
      gitlab: "GitLab",
      aws: "AWS",
      gcp: "GCP",
      azure: "Azure",
      api: "API",
      css: "CSS",
      html: "HTML",
      sql: "SQL",
      nosql: "NoSQL",
      rest: "REST",
      grpc: "gRPC",
      webrtc: "WebRTC",
      webpack: "Webpack",
      vite: "Vite",
      eslint: "ESLint",
      prettier: "Prettier",
    };

    return knownCases[lower] || word;
  }

  /**
   * 计算标签置信度
   */
  private calculateConfidence(
    keyword: string,
    existingVocabulary: Set<string>,
    useExisting: boolean,
  ): number {
    let confidence = 0.5;

    // 技术关键词加分
    if (this.techKeywords.has(keyword.toLowerCase())) {
      confidence += 0.3;
    }

    // 匹配现有词汇加分
    if (useExisting && existingVocabulary.has(keyword.toLowerCase())) {
      confidence += 0.2;
    }

    // 长度合适加分
    if (keyword.length >= 3 && keyword.length <= 15) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 检查标签是否与书签相关
   */
  private isTagRelevant(tag: string, bookmark: BookmarkData): boolean {
    const lowerTag = tag.toLowerCase();
    const searchText =
      `${bookmark.title} ${bookmark.ai_summary || ""}`.toLowerCase();

    // 直接包含
    if (searchText.includes(lowerTag)) {
      return true;
    }

    // 部分匹配（对于长标签）
    if (lowerTag.length >= 4) {
      const words = searchText.split(/\s+/);
      return words.some(
        (word) => word.includes(lowerTag) || lowerTag.includes(word),
      );
    }

    return false;
  }

  /**
   * 去重并排序建议
   */
  private deduplicateAndRank(suggestions: TagSuggestion[]): TagSuggestion[] {
    const tagMap = new Map<string, TagSuggestion>();

    suggestions.forEach((s) => {
      const key = s.tag.toLowerCase();
      const existing = tagMap.get(key);
      if (!existing || existing.confidence < s.confidence) {
        tagMap.set(key, s);
      }
    });

    return Array.from(tagMap.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  /**
   * 规范化标签库
   */
  normalizeTagLibrary(
    allTags: Array<{ tag: string; count: number; bookmarkIds: number[] }>,
    options: { mergeSimilar: boolean; removeRare: boolean },
  ): { merged: MergedTag[]; removed: RemovedTag[] } {
    const merged: MergedTag[] = [];
    const removed: RemovedTag[] = [];

    // 合并相似标签
    if (options.mergeSimilar) {
      const groups = this.groupSimilarTags(allTags);
      groups.forEach((group) => {
        if (group.length > 1) {
          // 选择最常用的作为规范形式
          const sorted = group.sort((a, b) => b.count - a.count);
          const normalized = sorted[0].tag;
          const originals = sorted.slice(1).map((t) => t.tag);
          const affectedBookmarks = sorted
            .slice(1)
            .reduce((sum, t) => sum + t.count, 0);

          if (originals.length > 0) {
            merged.push({
              original: originals,
              normalized,
              affectedBookmarks,
            });
          }
        }
      });
    }

    // 移除稀有标签
    if (options.removeRare) {
      allTags.forEach((t) => {
        if (t.count === 1) {
          removed.push({
            tag: t.tag,
            reason: "仅使用一次，建议移除或合并",
          });
        }
      });
    }

    return { merged, removed };
  }

  /**
   * 分组相似标签
   */
  private groupSimilarTags(
    tags: Array<{ tag: string; count: number }>,
  ): Array<Array<{ tag: string; count: number }>> {
    const groups: Array<Array<{ tag: string; count: number }>> = [];
    const assigned = new Set<string>();

    tags.forEach((tag) => {
      if (assigned.has(tag.tag)) return;

      const group = [tag];
      assigned.add(tag.tag);

      // 查找相似标签
      tags.forEach((other) => {
        if (assigned.has(other.tag)) return;
        if (this.areTagsSimilar(tag.tag, other.tag)) {
          group.push(other);
          assigned.add(other.tag);
        }
      });

      groups.push(group);
    });

    return groups;
  }

  /**
   * 检查两个标签是否相似
   */
  private areTagsSimilar(tag1: string, tag2: string): boolean {
    const lower1 = tag1.toLowerCase();
    const lower2 = tag2.toLowerCase();

    // 完全相同（仅大小写不同）
    if (lower1 === lower2) return true;

    // 一个是另一个的子串
    if (lower1.includes(lower2) || lower2.includes(lower1)) {
      // 长度差异不能太大
      const lengthRatio =
        Math.min(tag1.length, tag2.length) / Math.max(tag1.length, tag2.length);
      if (lengthRatio >= 0.7) return true;
    }

    // 编辑距离相似度
    const distance = this.levenshteinDistance(lower1, lower2);
    const maxLength = Math.max(lower1.length, lower2.length);
    const similarity = 1 - distance / maxLength;

    return similarity >= 0.8;
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 生成标签统计
   */
  generateStatistics(
    allTags: Array<{ tag: string; count: number }>,
    newSuggestions: string[],
  ): TagStatistics {
    const sortedTags = [...allTags].sort((a, b) => b.count - a.count);

    return {
      totalUniqueTags: allTags.length,
      topTags: sortedTags.slice(0, 20),
      suggestedNewTags: [...new Set(newSuggestions)].slice(0, 10),
    };
  }
}

/**
 * 默认标签分析器实例
 */
export const tagAnalyzer = new TagAnalyzer();
