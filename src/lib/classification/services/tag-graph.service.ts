/**
 * Tag Graph Service
 * V4.2 标签图谱服务
 *
 * @description 管理标签之间的关系（同义词、相关、父子）
 * - 从分类行为中学习标签关系
 * - 提供同义词扩展
 * - 支持用户自定义同义词
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { BaseSupabaseService } from "./base-supabase.service";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 标签关系类型
 */
export type TagRelationshipType = "synonym" | "related" | "parent";

/**
 * 标签关系来源
 */
export type TagRelationshipSource = "system" | "learned" | "user";

/**
 * 标签关系记录
 */
export interface TagRelationship {
  id: number;
  userId: string;
  relationshipType: TagRelationshipType;
  sourceTag: string;
  targetTag: string;
  weight: number;
  source: TagRelationshipSource;
  coOccurrenceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 相关标签结果
 */
export interface RelatedTag {
  tag: string;
  relationshipType: TagRelationshipType;
  weight: number;
  coOccurrenceCount: number;
}

/**
 * 标签图谱可视化数据
 */
export interface TagGraphData {
  nodes: Array<{
    id: string;
    label: string;
    weight: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: TagRelationshipType;
    weight: number;
  }>;
}

// ============================================================================
// V4.2.4: RPC 响应类型定义（避免 any）
// ============================================================================

/** RPC: tag_relationships 表行类型 */
interface TagRelationshipRow {
  id: number;
  user_id: string;
  relationship_type: string;
  source_tag: string;
  target_tag: string;
  weight: number;
  source: string;
  co_occurrence_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 标签图谱服务
 */
class TagGraphService extends BaseSupabaseService {
  /**
   * 获取标签的同义词
   */
  async getSynonyms(userId: string, tag: string): Promise<string[]> {
    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      const { data, error } = await supabase.rpc("get_tag_synonyms", {
        p_user_id: userId,
        p_tag: tag.toLowerCase(),
      });

      if (error) {
        logger.error({ error, tag }, "Failed to get tag synonyms");
        return [];
      }

      return (data || []).map((row) => row.synonym);
    } catch (error) {
      logger.error({ error, tag }, "Error getting tag synonyms");
      return [];
    }
  }

  /**
   * 获取标签的相关标签
   */
  async getRelatedTags(
    userId: string,
    tag: string,
    limit = 10,
  ): Promise<RelatedTag[]> {
    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      const { data, error } = await supabase.rpc("get_related_tags", {
        p_user_id: userId,
        p_tag: tag.toLowerCase(),
        p_limit: limit,
      });

      if (error) {
        logger.error({ error, tag }, "Failed to get related tags");
        return [];
      }

      return (data || []).map((row) => ({
        tag: row.related_tag,
        relationshipType: row.relationship_type as TagRelationshipType,
        weight: Number(row.weight),
        coOccurrenceCount: row.co_occurrence_count,
      }));
    } catch (error) {
      logger.error({ error, tag }, "Error getting related tags");
      return [];
    }
  }

  /**
   * 从分类行为中学习标签关系
   * @description 当书签被分类到文件夹时，学习书签标签与文件夹标签的关系
   */
  async learnFromClassification(
    userId: string,
    bookmarkTags: string[],
    folderTags: string[],
  ): Promise<void> {
    if (bookmarkTags.length === 0 || folderTags.length === 0) {
      return;
    }

    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      // 为每对书签标签-文件夹标签增加共现计数
      for (const bookmarkTag of bookmarkTags) {
        for (const folderTag of folderTags) {
          // 跳过相同标签
          if (bookmarkTag.toLowerCase() === folderTag.toLowerCase()) {
            continue;
          }

          // 使用 RPC 函数增加共现计数
          const { error } = await supabase.rpc("increment_tag_cooccurrence", {
            p_user_id: userId,
            p_source_tag: bookmarkTag.toLowerCase(),
            p_target_tag: folderTag.toLowerCase(),
            p_relationship_type: "related",
          });

          if (error) {
            logger.warn(
              { error, bookmarkTag, folderTag },
              "Failed to record tag co-occurrence",
            );
          }
        }
      }

      logger.debug(
        {
          userId,
          bookmarkTagCount: bookmarkTags.length,
          folderTagCount: folderTags.length,
        },
        "Learned tag relationships from classification",
      );
    } catch (error) {
      logger.error({ error }, "Error learning tag relationships");
    }
  }

  /**
   * 添加用户定义的同义词
   */
  async addUserSynonym(
    userId: string,
    sourceTag: string,
    targetTag: string,
  ): Promise<boolean> {
    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      const { error } = await supabase.from("tag_relationships").upsert(
        {
          user_id: userId,
          relationship_type: "synonym",
          source_tag: sourceTag.toLowerCase(),
          target_tag: targetTag.toLowerCase(),
          weight: 1.0, // 用户定义的同义词权重最高
          source: "user",
          co_occurrence_count: 0,
        },
        {
          onConflict: "user_id,source_tag,target_tag,relationship_type",
        },
      );

      if (error) {
        logger.error(
          { error, sourceTag, targetTag },
          "Failed to add user synonym",
        );
        return false;
      }

      logger.info(
        { userId, sourceTag, targetTag },
        "Added user-defined synonym",
      );
      return true;
    } catch (error) {
      logger.error({ error }, "Error adding user synonym");
      return false;
    }
  }

  /**
   * 删除用户定义的同义词
   */
  async removeUserSynonym(
    userId: string,
    sourceTag: string,
    targetTag: string,
  ): Promise<boolean> {
    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      const { error } = await supabase
        .from("tag_relationships")
        .delete()
        .eq("user_id", userId)
        .eq("relationship_type", "synonym")
        .eq("source", "user")
        .or(
          `and(source_tag.eq.${sourceTag.toLowerCase()},target_tag.eq.${targetTag.toLowerCase()}),and(source_tag.eq.${targetTag.toLowerCase()},target_tag.eq.${sourceTag.toLowerCase()})`,
        );

      if (error) {
        logger.error(
          { error, sourceTag, targetTag },
          "Failed to remove user synonym",
        );
        return false;
      }

      logger.info(
        { userId, sourceTag, targetTag },
        "Removed user-defined synonym",
      );
      return true;
    } catch (error) {
      logger.error({ error }, "Error removing user synonym");
      return false;
    }
  }

  /**
   * 获取用户的所有同义词映射
   */
  async getUserSynonyms(userId: string): Promise<Map<string, string[]>> {
    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      const { data, error } = await supabase
        .from("tag_relationships")
        .select("source_tag, target_tag")
        .eq("user_id", userId)
        .eq("relationship_type", "synonym")
        .order("weight", { ascending: false });

      if (error) {
        logger.error({ error }, "Failed to get user synonyms");
        return new Map();
      }

      // 构建同义词映射
      const synonymMap = new Map<string, string[]>();

      // V4.2.4: 使用明确类型替代 any
      for (const row of (data || []) as Pick<
        TagRelationshipRow,
        "source_tag" | "target_tag"
      >[]) {
        // 双向映射
        const existing1 = synonymMap.get(row.source_tag) || [];
        if (!existing1.includes(row.target_tag)) {
          existing1.push(row.target_tag);
        }
        synonymMap.set(row.source_tag, existing1);

        const existing2 = synonymMap.get(row.target_tag) || [];
        if (!existing2.includes(row.source_tag)) {
          existing2.push(row.source_tag);
        }
        synonymMap.set(row.target_tag, existing2);
      }

      return synonymMap;
    } catch (error) {
      logger.error({ error }, "Error getting user synonyms");
      return new Map();
    }
  }

  /**
   * 获取标签图谱可视化数据
   */
  async getGraphVisualization(userId: string): Promise<TagGraphData> {
    try {
      const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

      const { data, error } = await supabase
        .from("tag_relationships")
        .select("source_tag, target_tag, relationship_type, weight")
        .eq("user_id", userId)
        .gte("weight", 0.3) // 只显示权重较高的关系
        .order("weight", { ascending: false })
        .limit(100);

      if (error) {
        logger.error({ error }, "Failed to get tag graph");
        return { nodes: [], edges: [] };
      }

      // 构建节点和边
      const nodeSet = new Set<string>();
      const nodeWeights = new Map<string, number>();
      const edges: TagGraphData["edges"] = [];

      // V4.2.4: 使用明确类型替代 any
      type GraphRow = Pick<
        TagRelationshipRow,
        "source_tag" | "target_tag" | "relationship_type" | "weight"
      >;
      for (const row of (data || []) as GraphRow[]) {
        nodeSet.add(row.source_tag);
        nodeSet.add(row.target_tag);

        // 累计节点权重
        const currentWeight1 = nodeWeights.get(row.source_tag) || 0;
        nodeWeights.set(row.source_tag, currentWeight1 + Number(row.weight));

        const currentWeight2 = nodeWeights.get(row.target_tag) || 0;
        nodeWeights.set(row.target_tag, currentWeight2 + Number(row.weight));

        edges.push({
          source: row.source_tag,
          target: row.target_tag,
          type: row.relationship_type as TagRelationshipType,
          weight: Number(row.weight),
        });
      }

      const nodes: TagGraphData["nodes"] = Array.from(nodeSet).map((tag) => ({
        id: tag,
        label: tag,
        weight: nodeWeights.get(tag) || 0,
      }));

      return { nodes, edges };
    } catch (error) {
      logger.error({ error }, "Error getting tag graph visualization");
      return { nodes: [], edges: [] };
    }
  }

  /**
   * 批量扩展标签（包含同义词）
   * @description 用于分类时扩展书签标签以提高匹配率
   */
  async expandTagsWithSynonyms(
    userId: string,
    tags: string[],
  ): Promise<string[]> {
    if (tags.length === 0) {
      return [];
    }

    try {
      const expandedTags = new Set(tags.map((t) => t.toLowerCase()));

      // 获取用户的同义词映射
      const synonymMap = await this.getUserSynonyms(userId);

      // 扩展每个标签
      for (const tag of tags) {
        const synonyms = synonymMap.get(tag.toLowerCase()) || [];
        for (const synonym of synonyms) {
          expandedTags.add(synonym);
        }
      }

      return Array.from(expandedTags);
    } catch (error) {
      logger.error({ error }, "Error expanding tags with synonyms");
      return tags;
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const tagGraphService = new TagGraphService();
