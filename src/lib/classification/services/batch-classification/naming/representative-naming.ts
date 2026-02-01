/**
 * L3 代表元命名服务
 *
 * 从每簇选取核心 + 边界样本，生成最具概括性的名称
 *
 * @module classification/batch-classification/naming/representative-naming
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { BatchCluster, BookmarkWithEmbedding } from "../types";

// ============================================
// 命名配置
// ============================================

export interface NamingConfig {
  /** 核心样本数量 */
  coreCount: number;
  /** 边界样本数量 */
  edgeCount: number;
  /** 最大名称长度 */
  maxNameLength: number;
  /** 是否使用 AI 命名 */
  useAiNaming: boolean;
}

export const DEFAULT_NAMING_CONFIG: NamingConfig = {
  coreCount: 3,
  edgeCount: 2,
  maxNameLength: 20,
  useAiNaming: true,
};

// ============================================
// 代表元命名服务
// ============================================

/**
 * 代表元命名服务
 *
 * 功能：
 * 1. 选取核心样本（最靠近质心）
 * 2. 选取边界样本（最远离质心）
 * 3. 生成概括性名称
 */
export class RepresentativeNamingService {
  private config: NamingConfig;

  constructor(config: NamingConfig = DEFAULT_NAMING_CONFIG) {
    this.config = config;
  }

  /**
   * 为簇生成名称
   */
  async generateClusterName(
    cluster: BatchCluster,
    bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): Promise<{ name: string; confidence: number; reason: string }> {
    // 1. 获取代表性样本
    const representatives = this.getRepresentativeSamples(cluster, bookmarkMap);

    // 2. 尝试从原始路径提取名称
    const pathBasedName = this.extractNameFromPaths(
      representatives.all,
      bookmarkMap,
    );
    if (pathBasedName) {
      return {
        name: pathBasedName,
        confidence: 0.8,
        reason: "基于原始文件夹路径",
      };
    }

    // 3. 从标题提取关键词
    const keywordName = this.extractNameFromTitles(
      representatives.all,
      bookmarkMap,
    );
    if (keywordName) {
      return {
        name: keywordName,
        confidence: 0.6,
        reason: "基于标题关键词",
      };
    }

    // 4. 使用域名作为备选
    const domainName = this.extractNameFromDomains(
      representatives.all,
      bookmarkMap,
    );
    if (domainName) {
      return {
        name: domainName,
        confidence: 0.4,
        reason: "基于主要域名",
      };
    }

    // 5. 默认名称
    return {
      name: `分类 ${cluster.index + 1}`,
      confidence: 0.2,
      reason: "默认编号",
    };
  }

  /**
   * 获取代表性样本
   */
  getRepresentativeSamples(
    cluster: BatchCluster,
    bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): {
    core: BookmarkWithEmbedding[];
    edge: BookmarkWithEmbedding[];
    all: BookmarkWithEmbedding[];
  } {
    const coreBookmarks = cluster.representatives.core
      .map((id) => bookmarkMap.get(id))
      .filter((b): b is BookmarkWithEmbedding => b !== undefined);

    const edgeBookmarks = cluster.representatives.edge
      .map((id) => bookmarkMap.get(id))
      .filter((b): b is BookmarkWithEmbedding => b !== undefined);

    return {
      core: coreBookmarks,
      edge: edgeBookmarks,
      all: [...coreBookmarks, ...edgeBookmarks],
    };
  }

  /**
   * 从原始路径提取名称
   */
  private extractNameFromPaths(
    bookmarks: BookmarkWithEmbedding[],
    _bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): string | null {
    const pathCounts = new Map<string, number>();

    for (const bookmark of bookmarks) {
      if (bookmark.originalPath) {
        const parts = bookmark.originalPath.split("/").filter(Boolean);
        // 取最后一级文件夹名
        const folderName = parts[parts.length - 1];
        if (folderName && folderName.length <= this.config.maxNameLength) {
          pathCounts.set(folderName, (pathCounts.get(folderName) || 0) + 1);
        }
      }
    }

    // 找出出现最多的文件夹名
    let maxCount = 0;
    let bestName: string | null = null;

    for (const [name, count] of pathCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestName = name;
      }
    }

    // 至少要有一半的书签来自同一文件夹
    if (bestName && maxCount >= bookmarks.length / 2) {
      return bestName;
    }

    return null;
  }

  /**
   * 从标题提取关键词
   */
  private extractNameFromTitles(
    bookmarks: BookmarkWithEmbedding[],
    _bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): string | null {
    const wordCounts = new Map<string, number>();

    for (const bookmark of bookmarks) {
      const words = this.extractKeywords(bookmark.title);
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // 找出出现最多的关键词
    const sortedWords = Array.from(wordCounts.entries())
      .filter(([word]) => word.length >= 2 && word.length <= 10)
      .sort((a, b) => b[1] - a[1]);

    if (sortedWords.length > 0 && sortedWords[0][1] >= 2) {
      return sortedWords[0][0];
    }

    return null;
  }

  /**
   * 从域名提取名称
   */
  private extractNameFromDomains(
    bookmarks: BookmarkWithEmbedding[],
    _bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): string | null {
    const domainCounts = new Map<string, number>();

    for (const bookmark of bookmarks) {
      const domain = bookmark.meaningfulDomain || bookmark.domain;
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }

    // 找出出现最多的域名
    let maxCount = 0;
    let bestDomain: string | null = null;

    for (const [domain, count] of domainCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestDomain = domain;
      }
    }

    if (bestDomain && maxCount >= bookmarks.length / 2) {
      // 简化域名为可读名称
      return this.domainToReadableName(bestDomain);
    }

    return null;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(title: string): string[] {
    // 移除常见停用词
    const stopWords = new Set([
      "的",
      "是",
      "在",
      "了",
      "和",
      "与",
      "或",
      "等",
      "及",
      "之",
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "at",
      "by",
      "from",
      "how",
      "what",
      "why",
      "when",
      "where",
      "which",
      "who",
    ]);

    // 中英文分词
    const words = title
      .toLowerCase()
      .split(/[\s\-_|:：,，.。!！?？(（)）\[\]【】<>《》\/\\]+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));

    return words;
  }

  /**
   * 域名转可读名称
   */
  private domainToReadableName(domain: string): string {
    // github.com/facebook -> GitHub Facebook
    // zhihu.com -> 知乎

    const domainNames: Record<string, string> = {
      "github.com": "GitHub",
      "gitlab.com": "GitLab",
      "stackoverflow.com": "Stack Overflow",
      "zhihu.com": "知乎",
      "juejin.cn": "掘金",
      "bilibili.com": "B站",
      "medium.com": "Medium",
      "dev.to": "Dev.to",
    };

    for (const [key, name] of Object.entries(domainNames)) {
      if (domain.includes(key)) {
        // 处理子路径，如 github.com/facebook
        const parts = domain.split("/");
        if (parts.length > 1) {
          return `${name} - ${parts[1]}`;
        }
        return name;
      }
    }

    // 默认：取域名主体
    return domain.replace(/\.(com|cn|org|net|io)$/, "");
  }

  /**
   * 生成 AI 命名 Prompt
   */
  generateNamingPrompt(
    coreItems: BookmarkWithEmbedding[],
    edgeItems: BookmarkWithEmbedding[],
  ): string {
    const coreList = coreItems.map((s) => `- ${s.title}`).join("\n");
    const edgeList = edgeItems.map((s) => `- ${s.title}`).join("\n");

    return `以下是一组相关收藏的代表样本：

【核心内容】
${coreList}

【边界内容】
${edgeList}

请用 2-5 个字给这组收藏起一个文件夹名称。
要求：概括核心主题，兼顾边界内容。
只输出名称，不要解释。`;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NamingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================
// 导出单例
// ============================================

export const representativeNamingService = new RepresentativeNamingService();
