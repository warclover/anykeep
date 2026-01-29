/**
 * 智能分类 v5.0 - Context Anchor 服务
 *
 * 功能说明：
 * - 提取书签的上下文锚点（系列、作者、来源、主题）
 * - 查找相似的上下文锚点
 * - 将书签关联到锚点
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type {
  AnchorType,
  ContextAnchor,
  ExtractedAnchor,
  SimilarAnchor,
  AnchorExtractionParams,
  AnchorLinkResult,
} from "./types";

export class ContextAnchorService {
  private supabase: SupabaseClient<Database>;
  private logger: LoggerService;

  constructor(supabase: SupabaseClient<Database>, logger: LoggerService) {
    this.supabase = supabase;
    this.logger = logger.child({ service: "ContextAnchorService" });
  }

  /**
   * 提取书签的上下文锚点
   */
  async extractContextAnchor(
    params: AnchorExtractionParams,
  ): Promise<ExtractedAnchor | null> {
    try {
      this.logger.info("Extracting context anchor", {
        bookmarkId: String(params.bookmarkId),
        url: params.url,
      });

      // 1. 从 URL 提取来源锚点
      const sourceAnchor = this.extractSourceFromUrl(params.url);
      if (sourceAnchor) {
        return sourceAnchor;
      }

      // 2. 从标题提取系列锚点
      const seriesAnchor = this.extractSeriesFromTitle(params.title);
      if (seriesAnchor) {
        return seriesAnchor;
      }

      // 3. 从内容提取主题锚点（如果有内容）
      if (params.content) {
        const topicAnchor = await this.extractTopicFromContent(
          params.content,
          params.embedding,
        );
        if (topicAnchor) {
          return topicAnchor;
        }
      }

      this.logger.debug("No context anchor extracted", {
        bookmarkId: String(params.bookmarkId),
      });

      return null;
    } catch (error) {
      this.logger.error(
        "Failed to extract context anchor",
        error instanceof Error ? error : new Error(String(error)),
        { params },
      );
      return null;
    }
  }

  /**
   * 从 URL 提取来源锚点
   */
  private extractSourceFromUrl(url: string): ExtractedAnchor | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, "");

      // 常见来源映射
      const sourceMap: Record<string, string> = {
        "github.com": "GitHub",
        "stackoverflow.com": "Stack Overflow",
        "medium.com": "Medium",
        "dev.to": "DEV Community",
        "youtube.com": "YouTube",
        "bilibili.com": "Bilibili",
        "zhihu.com": "知乎",
        "juejin.cn": "掘金",
        "csdn.net": "CSDN",
      };

      const sourceName = sourceMap[hostname] || hostname;

      return {
        anchorType: "source",
        anchorName: sourceName,
        anchorMetadata: {
          hostname,
          url: urlObj.origin,
        },
        confidence: 0.9,
      };
    } catch {
      return null;
    }
  }

  /**
   * 从标题提取系列锚点
   */
  private extractSeriesFromTitle(title: string): ExtractedAnchor | null {
    // 匹配常见的系列模式
    const patterns = [
      /(.+?)\s*[（(]?\s*(?:第|Part|Episode|EP)\s*(\d+)\s*[）)]?/i,
      /(.+?)\s*[-–—]\s*(?:第|Part|Episode|EP)\s*(\d+)/i,
      /(.+?)\s*\d+\s*[：:]\s*/,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const seriesName = match[1].trim();
        return {
          anchorType: "series",
          anchorName: seriesName,
          anchorMetadata: {
            pattern: pattern.source,
          },
          confidence: 0.8,
        };
      }
    }

    return null;
  }

  /**
   * 从内容提取主题锚点（使用向量相似度）
   */
  private async extractTopicFromContent(
    content: string,
    _embedding: number[],
  ): Promise<ExtractedAnchor | null> {
    // 简单的关键词提取（实际应该使用 LLM）
    const keywords = this.extractKeywords(content);
    if (keywords.length === 0) {
      return null;
    }

    const topicName = keywords.slice(0, 3).join(", ");

    return {
      anchorType: "topic",
      anchorName: topicName,
      anchorMetadata: {
        keywords,
      },
      confidence: 0.6,
    };
  }

  /**
   * 简单的关键词提取
   */
  private extractKeywords(content: string): string[] {
    // 这里使用简单的词频统计
    // 实际应该使用 TF-IDF 或 LLM
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const freq: Record<string, number> = {};
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * 查找相似的上下文锚点
   */
  async findSimilarAnchors(
    embedding: number[],
    anchorType?: AnchorType,
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<SimilarAnchor[]> {
    try {
      this.logger.debug("Finding similar anchors", {
        anchorType,
        limit,
        threshold,
      });

      // 获取当前用户ID
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await this.supabase.rpc(
        "find_similar_context_anchors",
        {
          p_user_id: user.id,
          p_query_embedding: embedding as unknown as string,
          p_similarity_threshold: threshold,
          p_limit: limit,
        },
      );

      if (error) {
        throw new Error(`Failed to find similar anchors: ${error.message}`);
      }

      return (data || []).map((row) => ({
        anchorId: row.anchor_id,
        anchorType: row.anchor_type as AnchorType,
        anchorName: row.anchor_name,
        anchorMetadata: row.anchor_metadata as Record<string, unknown>,
        bookmarkCount: row.bookmark_count,
        similarity: parseFloat(row.similarity.toString()),
      }));
    } catch (error) {
      this.logger.error(
        "Failed to find similar anchors",
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  /**
   * 将书签关联到锚点
   */
  async linkBookmarkToAnchor(
    bookmarkId: number,
    extractedAnchor: ExtractedAnchor,
    embedding: number[],
  ): Promise<AnchorLinkResult> {
    try {
      this.logger.info("Linking bookmark to anchor", {
        bookmarkId: String(bookmarkId),
        anchorType: extractedAnchor.anchorType,
        anchorName: extractedAnchor.anchorName,
      });

      // 1. 查找是否已存在相同的锚点
      const { data: existingAnchor, error: findError } = await this.supabase
        .from("context_anchors")
        .select("id, anchor_name")
        .eq("anchor_type", extractedAnchor.anchorType)
        .eq("anchor_name", extractedAnchor.anchorName)
        .single();

      let anchorId: number;
      let isNewAnchor = false;

      if (findError && findError.code !== "PGRST116") {
        throw new Error(`Failed to find existing anchor: ${findError.message}`);
      }

      if (existingAnchor) {
        // 使用现有锚点
        anchorId = existingAnchor.id;
        this.logger.debug("Using existing anchor", { anchorId });
      } else {
        // 获取当前用户ID
        const {
          data: { user },
        } = await this.supabase.auth.getUser();
        if (!user) {
          throw new Error("User not authenticated");
        }

        // 创建新锚点
        const { data: newAnchor, error: createError } = await this.supabase
          .from("context_anchors")
          .insert({
            user_id: user.id,
            anchor_type: extractedAnchor.anchorType,
            anchor_name: extractedAnchor.anchorName,
            anchor_metadata: extractedAnchor.anchorMetadata as unknown as Json,
            embedding: embedding as unknown as string,
          })
          .select("id, anchor_name")
          .single();

        if (createError || !newAnchor) {
          throw new Error(`Failed to create anchor: ${createError?.message}`);
        }

        anchorId = newAnchor.id;
        isNewAnchor = true;
        this.logger.debug("Created new anchor", { anchorId });
      }

      // 2. 关联书签到锚点
      // NOTE: context_anchor_id 列尚未添加到 bookmarks 表，暂时跳过关联
      // TODO: 创建迁移添加 context_anchor_id 列后启用此功能
      // const { error: linkError } = await this.supabase
      //   .from("bookmarks")
      //   .update({ context_anchor_id: anchorId })
      //   .eq("id", bookmarkId);
      //
      // if (linkError) {
      //   throw new Error(`Failed to link bookmark: ${linkError.message}`);
      // }

      this.logger.warn(
        "context_anchor_id column not yet available, skipping bookmark link",
        {
          bookmarkId: String(bookmarkId),
          anchorId,
        },
      );

      this.logger.info("Bookmark linked to anchor successfully", {
        bookmarkId: String(bookmarkId),
        anchorId,
        isNewAnchor,
      });

      return {
        success: true,
        anchorId,
        anchorName: extractedAnchor.anchorName,
        isNewAnchor,
      };
    } catch (error) {
      this.logger.error(
        "Failed to link bookmark to anchor",
        error instanceof Error ? error : new Error(String(error)),
        { bookmarkId: String(bookmarkId) },
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 获取锚点详情
   */
  async getAnchorById(anchorId: number): Promise<ContextAnchor | null> {
    try {
      const { data, error } = await this.supabase
        .from("context_anchors")
        .select("*")
        .eq("id", anchorId)
        .single();

      if (error || !data) {
        throw new Error(`Failed to get anchor: ${error?.message}`);
      }

      return {
        id: data.id,
        userId: data.user_id,
        anchorType: data.anchor_type as AnchorType,
        anchorName: data.anchor_name,
        anchorMetadata: data.anchor_metadata as Record<string, unknown>,
        embedding: data.embedding as number[] | null,
        bookmarkCount: data.bookmark_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      this.logger.error(
        "Failed to get anchor",
        error instanceof Error ? error : new Error(String(error)),
        { anchorId },
      );
      return null;
    }
  }
}
