/**
 * Tag Matcher Service
 * V4.2 标签精确匹配服务
 *
 * @description 基于标签的快速路径匹配
 * - 精确标签匹配
 * - 同义词扩展
 * - 文件夹标签关联
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { FAST_PATH_THRESHOLDS } from "@/lib/trust-mode/config";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 标签匹配结果
 */
export interface TagMatchResult {
  /** 是否找到匹配 */
  found: boolean;
  /** 建议的文件夹 ID */
  suggestedFolderId?: number;
  /** 匹配的文件夹名称 */
  folderName?: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 匹配的标签 */
  matchedTags?: string[];
  /** 匹配详情 */
  reason: string;
}

/**
 * 文件夹标签缓存项
 */
interface FolderTagCacheItem {
  folderId: number;
  folderName: string;
  tags: string[];
  bookmarkCount: number;
  lastUpdated: number;
}

// ============================================================================
// 同义词映射
// ============================================================================

/**
 * 常见同义词映射表
 */
const SYNONYM_MAP: Record<string, string[]> = {
  // 技术类
  "前端": ["frontend", "前端开发", "web前端", "前端技术"],
  "后端": ["backend", "后端开发", "服务端", "服务器端"],
  "全栈": ["fullstack", "full-stack", "全栈开发"],
  "人工智能": ["AI", "ai", "机器学习", "ML", "深度学习", "神经网络"],
  "编程": ["programming", "coding", "开发", "代码"],
  "javascript": ["js", "JS", "JavaScript"],
  "typescript": ["ts", "TS", "TypeScript"],
  "python": ["Python", "py"],
  "react": ["React", "reactjs", "React.js"],
  "vue": ["Vue", "vuejs", "Vue.js"],
  "node": ["nodejs", "Node.js", "node.js"],

  // 设计类
  "设计": ["design", "UI", "UX", "UI/UX"],
  "产品": ["product", "产品设计", "产品经理", "PM"],

  // 商业类
  "创业": ["startup", "创业公司", "entrepreneurship"],
  "投资": ["investment", "投资理财", "理财"],
  "管理": ["management", "管理学", "团队管理"],

  // 生活类
  "健康": ["health", "健身", "养生"],
  "旅行": ["travel", "旅游", "出行"],
  "美食": ["food", "烹饪", "美食推荐"],
  "阅读": ["reading", "书籍", "读书"],
};

// ============================================================================
// 标签匹配器
// ============================================================================

/**
 * 标签匹配器
 */
export class TagMatcher {
  // 文件夹标签缓存
  private folderTagCache: Map<string, FolderTagCacheItem[]> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 分钟缓存

  /**
   * 尝试标签匹配
   */
  async tryTagMatch(
    userId: string,
    tags: string[],
  ): Promise<TagMatchResult> {
    if (!tags || tags.length === 0) {
      return {
        found: false,
        confidence: 0,
        reason: "No tags provided",
      };
    }

    // 标准化标签
    const normalizedTags = this.normalizeTags(tags);

    // 获取用户文件夹的标签关联
    const folderTags = await this.getUserFolderTags(userId);

    if (folderTags.length === 0) {
      return {
        found: false,
        confidence: 0,
        reason: "No folder tags available",
      };
    }

    // 计算每个文件夹的匹配分数
    const matches = folderTags.map((folder) => {
      const matchResult = this.calculateTagMatchScore(normalizedTags, folder.tags);
      return {
        ...folder,
        ...matchResult,
      };
    });

    // 按分数排序
    matches.sort((a, b) => b.score - a.score);

    const bestMatch = matches[0];

    // 检查是否达到阈值
    if (
      bestMatch.score >= FAST_PATH_THRESHOLDS.MIN_TAG_MATCH_SCORE &&
      bestMatch.matchedTags.length >= FAST_PATH_THRESHOLDS.MIN_TAG_MATCHES
    ) {
      // 计算置信度（基于匹配分数和书签数量）
      const baseConfidence = Math.min(85, bestMatch.score);
      const countBonus = Math.min(10, Math.floor(bestMatch.bookmarkCount / 5));
      const confidence = Math.min(95, baseConfidence + countBonus);

      return {
        found: true,
        suggestedFolderId: bestMatch.folderId,
        folderName: bestMatch.folderName,
        confidence,
        matchedTags: bestMatch.matchedTags,
        reason: `Tag match: ${bestMatch.matchedTags.join(", ")} → ${bestMatch.folderName}`,
      };
    }

    return {
      found: false,
      confidence: bestMatch.score,
      matchedTags: bestMatch.matchedTags,
      reason: "Tag match score below threshold",
    };
  }

  /**
   * 获取用户文件夹的标签关联
   */
  private async getUserFolderTags(userId: string): Promise<FolderTagCacheItem[]> {
    // 检查缓存
    const cacheKey = `folder_tags_${userId}`;
    const cached = this.folderTagCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.length > 0 && cached[0].lastUpdated > now - this.cacheExpiry) {
      return cached;
    }

    // 从数据库获取
    const supabase = await createClient();

    // 获取用户文件夹及其书签的标签
    const { data: folders, error: folderError } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_archived", false);

    if (folderError || !folders) {
      return [];
    }

    // 获取每个文件夹的书签标签
    const folderTags: FolderTagCacheItem[] = [];

    for (const folder of folders) {
      // tags 列类型断言
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("tags")
        .eq("folder_id", folder.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(100) as unknown as { data: Array<{ tags: string[] | null }> | null };

      if (bookmarks && bookmarks.length > 0) {
        // 统计标签频率
        const tagFrequency = new Map<string, number>();
        for (const bookmark of bookmarks) {
          const tags = bookmark.tags as string[] | null;
          if (tags) {
            for (const tag of tags) {
              const normalized = tag.toLowerCase().trim();
              tagFrequency.set(normalized, (tagFrequency.get(normalized) || 0) + 1);
            }
          }
        }

        // 取频率最高的标签（至少出现 2 次）
        const topTags = Array.from(tagFrequency.entries())
          .filter(([_, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag]) => tag);

        if (topTags.length > 0) {
          folderTags.push({
            folderId: folder.id,
            folderName: folder.name,
            tags: topTags,
            bookmarkCount: bookmarks.length,
            lastUpdated: now,
          });
        }
      }
    }

    // 更新缓存
    this.folderTagCache.set(cacheKey, folderTags);

    return folderTags;
  }

  /**
   * 计算标签匹配分数
   */
  private calculateTagMatchScore(
    inputTags: string[],
    folderTags: string[],
  ): { score: number; matchedTags: string[] } {
    const matchedTags: string[] = [];
    let score = 0;

    for (const inputTag of inputTags) {
      // 精确匹配
      if (folderTags.includes(inputTag)) {
        matchedTags.push(inputTag);
        score += 30;
        continue;
      }

      // 同义词匹配
      const synonymMatch = this.findSynonymMatch(inputTag, folderTags);
      if (synonymMatch) {
        matchedTags.push(`${inputTag}≈${synonymMatch}`);
        score += 20;
        continue;
      }

      // 部分匹配（包含关系）
      const partialMatch = folderTags.find(
        (ft) => ft.includes(inputTag) || inputTag.includes(ft),
      );
      if (partialMatch) {
        matchedTags.push(`${inputTag}~${partialMatch}`);
        score += 10;
      }
    }

    return { score, matchedTags };
  }

  /**
   * 查找同义词匹配
   */
  private findSynonymMatch(tag: string, folderTags: string[]): string | null {
    // 检查 tag 是否有同义词在 folderTags 中
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      const allForms = [key.toLowerCase(), ...synonyms.map((s) => s.toLowerCase())];

      if (allForms.includes(tag)) {
        // 找到该标签的所有形式，检查 folderTags 中是否有任一
        for (const form of allForms) {
          if (folderTags.includes(form)) {
            return form;
          }
        }
      }
    }

    return null;
  }

  /**
   * 标准化标签
   */
  private normalizeTags(tags: string[]): string[] {
    return tags
      .map((tag) => tag.toLowerCase().trim())
      .filter((tag) => tag.length > 0);
  }

  /**
   * 清除用户缓存
   */
  clearCache(userId: string): void {
    this.folderTagCache.delete(`folder_tags_${userId}`);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.folderTagCache.clear();
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const tagMatcher = new TagMatcher();
