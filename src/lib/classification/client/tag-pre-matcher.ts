/**
 * 客户端标签预匹配服务
 *
 * 在客户端本地进行快速标签匹配，减少后端计算
 * 支持：
 * 1. 激进标准化（Vue.js → vuejs）
 * 2. 同义词扩展
 * 3. 精确匹配和部分匹配
 *
 * @module @/lib/classification/client/tag-pre-matcher
 * @version 1.0.0
 * @since 2026-01-23
 */

/**
 * 预匹配结果
 */
export interface PreMatchResult {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配的文件夹 ID */
  folderId: number | null;
  /** 匹配的文件夹名称 */
  folderName: string | null;
  /** 匹配模式 */
  matchMode: "exact" | "normalized" | "partial" | "none";
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 命中的标签 */
  matchedTags: string[];
  /** 是否需要后端校验 */
  needsServerValidation: boolean;
  /** 匹配耗时（毫秒） */
  latencyMs: number;
}

/**
 * 缓存的文件夹信息
 */
export interface CachedFolder {
  /** 文件夹 ID */
  id: number;
  /** 文件夹名称 */
  name: string;
  /** 标准化后的名称 */
  normalizedName: string;
  /** 别名列表（已标准化） */
  aliases: string[];
  /** 核心标签（已标准化） */
  coreTags: string[];
}

/**
 * 预匹配器配置
 */
export interface TagPreMatcherConfig {
  /** 部分匹配最小长度比例 (默认 0.7) */
  partialMatchMinRatio: number;
  /** 精确匹配置信度 (默认 0.98) */
  exactMatchConfidence: number;
  /** 别名匹配置信度 (默认 0.95) */
  aliasMatchConfidence: number;
  /** 部分匹配置信度 (默认 0.6) */
  partialMatchConfidence: number;
  /** 是否启用同义词扩展 (默认 true) */
  enableSynonymExpansion: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TagPreMatcherConfig = {
  partialMatchMinRatio: 0.7,
  exactMatchConfidence: 0.98,
  aliasMatchConfidence: 0.95,
  partialMatchConfidence: 0.6,
  enableSynonymExpansion: true,
};

/**
 * 常见同义词映射表（客户端版本，精简）
 */
const SYNONYM_MAP: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "es6", "es2015"],
  typescript: ["ts"],
  python: ["py", "python3"],
  golang: ["go"],
  kotlin: ["kt"],
  react: ["reactjs"],
  vue: ["vuejs", "vue3"],
  angular: ["angularjs", "ng"],
  node: ["nodejs"],
  next: ["nextjs"],
  nuxt: ["nuxtjs"],
  express: ["expressjs"],
  mongo: ["mongodb"],
  postgres: ["postgresql", "pg"],
  redis: ["redisdb"],
  docker: ["容器"],
  kubernetes: ["k8s"],
  machinelearning: ["ml", "机器学习"],
  deeplearning: ["dl", "深度学习"],
  artificialintelligence: ["ai", "人工智能"],
  frontend: ["前端", "fe"],
  backend: ["后端", "be"],
  fullstack: ["全栈"],
  devops: ["运维"],
  ios: ["苹果", "apple"],
  android: ["安卓"],
};

/**
 * 客户端标签预匹配服务
 */
export class TagPreMatcher {
  private config: TagPreMatcherConfig;
  private synonymLookup: Map<string, string>;

  constructor(config?: Partial<TagPreMatcherConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.synonymLookup = this.buildSynonymLookup();
  }

  /**
   * 构建同义词反向查找表
   */
  private buildSynonymLookup(): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
      lookup.set(canonical, canonical);
      for (const synonym of synonyms) {
        lookup.set(this.normalize(synonym), canonical);
      }
    }

    return lookup;
  }

  /**
   * 激进标准化
   */
  normalize(tag: string): string {
    if (!tag || typeof tag !== "string") {
      return "";
    }

    return (
      tag
        .toLowerCase()
        // 特殊符号转换
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
   * 获取同义词的规范形式
   */
  private getCanonical(normalizedTag: string): string {
    return this.synonymLookup.get(normalizedTag) || normalizedTag;
  }

  /**
   * 扩展标签（包含同义词）
   */
  expandTags(tags: string[]): string[] {
    if (!this.config.enableSynonymExpansion) {
      return tags.map((t) => this.normalize(t)).filter(Boolean);
    }

    const expanded = new Set<string>();

    for (const tag of tags) {
      const normalized = this.normalize(tag);
      if (!normalized) continue;

      expanded.add(normalized);

      // 添加规范形式
      const canonical = this.getCanonical(normalized);
      expanded.add(canonical);

      // 添加同义词
      const synonyms = SYNONYM_MAP[canonical];
      if (synonyms) {
        for (const syn of synonyms) {
          expanded.add(this.normalize(syn));
        }
      }
    }

    return Array.from(expanded);
  }

  /**
   * 执行预匹配
   */
  match(tags: string[], folders: CachedFolder[]): PreMatchResult {
    const startTime = performance.now();

    if (!tags || tags.length === 0 || !folders || folders.length === 0) {
      return this.noMatch(startTime);
    }

    // 扩展标签
    const expandedTags = this.expandTags(tags);
    if (expandedTags.length === 0) {
      return this.noMatch(startTime);
    }

    // 策略 1: 精确匹配（标准化后完全相等）
    const exactMatch = this.matchExact(expandedTags, folders);
    if (exactMatch) {
      return {
        matched: true,
        folderId: exactMatch.folder.id,
        folderName: exactMatch.folder.name,
        matchMode: "exact",
        confidence: this.config.exactMatchConfidence,
        matchedTags: [exactMatch.matchedTag],
        needsServerValidation: false,
        latencyMs: performance.now() - startTime,
      };
    }

    // 策略 2: 别名匹配
    const aliasMatch = this.matchAlias(expandedTags, folders);
    if (aliasMatch) {
      return {
        matched: true,
        folderId: aliasMatch.folder.id,
        folderName: aliasMatch.folder.name,
        matchMode: "normalized",
        confidence: this.config.aliasMatchConfidence,
        matchedTags: [aliasMatch.matchedTag],
        needsServerValidation: false,
        latencyMs: performance.now() - startTime,
      };
    }

    // 策略 3: 部分匹配（需要后端校验）
    const partialMatch = this.matchPartial(expandedTags, folders);
    if (partialMatch) {
      return {
        matched: true,
        folderId: partialMatch.folder.id,
        folderName: partialMatch.folder.name,
        matchMode: "partial",
        confidence: this.config.partialMatchConfidence,
        matchedTags: [partialMatch.matchedTag],
        needsServerValidation: true, // 部分匹配必须后端校验
        latencyMs: performance.now() - startTime,
      };
    }

    return this.noMatch(startTime);
  }

  /**
   * 策略 1: 精确匹配
   */
  private matchExact(
    tags: string[],
    folders: CachedFolder[],
  ): { folder: CachedFolder; matchedTag: string } | null {
    for (const folder of folders) {
      for (const tag of tags) {
        if (tag === folder.normalizedName) {
          return { folder, matchedTag: tag };
        }
      }
    }
    return null;
  }

  /**
   * 策略 2: 别名匹配
   */
  private matchAlias(
    tags: string[],
    folders: CachedFolder[],
  ): { folder: CachedFolder; matchedTag: string } | null {
    for (const folder of folders) {
      for (const tag of tags) {
        if (folder.aliases.includes(tag)) {
          return { folder, matchedTag: tag };
        }
      }
    }
    return null;
  }

  /**
   * 策略 3: 安全的部分匹配
   */
  private matchPartial(
    tags: string[],
    folders: CachedFolder[],
  ): { folder: CachedFolder; matchedTag: string } | null {
    for (const folder of folders) {
      const folderName = folder.normalizedName;
      if (folderName.length < 3) continue;

      for (const tag of tags) {
        if (tag.length < 3) continue;

        // 检查包含关系
        const isContained =
          folderName.includes(tag) || tag.includes(folderName);
        if (!isContained) continue;

        // 长度比例检查
        const shorter = Math.min(tag.length, folderName.length);
        const longer = Math.max(tag.length, folderName.length);
        const ratio = shorter / longer;

        if (ratio >= this.config.partialMatchMinRatio) {
          return { folder, matchedTag: tag };
        }
      }
    }
    return null;
  }

  /**
   * 核心标签匹配
   */
  matchCoreTags(
    tags: string[],
    folders: CachedFolder[],
  ): { folder: CachedFolder; matchedTags: string[]; score: number } | null {
    const expandedTags = this.expandTags(tags);
    let bestMatch: {
      folder: CachedFolder;
      matchedTags: string[];
      score: number;
    } | null = null;

    for (const folder of folders) {
      if (folder.coreTags.length === 0) continue;

      const matchedTags = expandedTags.filter((tag) =>
        folder.coreTags.some(
          (ct) => ct === tag || ct.includes(tag) || tag.includes(ct),
        ),
      );

      if (matchedTags.length > 0) {
        const score = matchedTags.length / folder.coreTags.length;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { folder, matchedTags, score };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 返回无匹配结果
   */
  private noMatch(startTime: number): PreMatchResult {
    return {
      matched: false,
      folderId: null,
      folderName: null,
      matchMode: "none",
      confidence: 0,
      matchedTags: [],
      needsServerValidation: true,
      latencyMs: performance.now() - startTime,
    };
  }

  /**
   * 批量预匹配（用于批量导入场景）
   */
  matchBatch(
    items: Array<{ id: string; tags: string[] }>,
    folders: CachedFolder[],
  ): Map<string, PreMatchResult> {
    const results = new Map<string, PreMatchResult>();

    for (const item of items) {
      results.set(item.id, this.match(item.tags, folders));
    }

    return results;
  }

  /**
   * 获取匹配统计
   */
  getMatchStats(results: Map<string, PreMatchResult>): {
    total: number;
    matched: number;
    byMode: Record<string, number>;
    avgLatencyMs: number;
    needsServerValidation: number;
  } {
    const stats = {
      total: results.size,
      matched: 0,
      byMode: {} as Record<string, number>,
      avgLatencyMs: 0,
      needsServerValidation: 0,
    };

    let totalLatency = 0;

    for (const result of results.values()) {
      if (result.matched) {
        stats.matched++;
        stats.byMode[result.matchMode] =
          (stats.byMode[result.matchMode] || 0) + 1;
      }
      if (result.needsServerValidation) {
        stats.needsServerValidation++;
      }
      totalLatency += result.latencyMs;
    }

    stats.avgLatencyMs = stats.total > 0 ? totalLatency / stats.total : 0;

    return stats;
  }
}

// 导出单例实例
export const tagPreMatcher = new TagPreMatcher();
