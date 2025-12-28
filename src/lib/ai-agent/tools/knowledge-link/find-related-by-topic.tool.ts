/**
 * find_related_by_topic Tool
 *
 * 基于主题聚类查找相关书签
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getTopicClustererService } from "@/lib/knowledge-link/services/topic-clusterer.service";
import type { FindRelatedByTopicResult, RelatedBookmarkByTopic } from "./types";
import { transformClusterResult } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  bookmarkId: z.number().int().positive().describe("要查找相关内容的书签 ID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回相关书签的数量，默认 10"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type FindRelatedByTopicParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const findRelatedByTopicTool: Tool<
  FindRelatedByTopicParams,
  FindRelatedByTopicResult
> = {
  definition: {
    name: "find_related_by_topic",
    description: `基于主题聚类查找与指定书签相关的内容。

工作原理：
- 使用 AI 嵌入向量对书签进行聚类分析
- 找到书签所属的主题簇
- 返回同主题簇中的其他书签

返回信息：
- 书签所属的主题簇信息（标签、内聚度、代表性标签）
- 同主题的相关书签列表（带关联强度）

使用场景：
- "和这篇文章类似的内容"
- "找到同主题的收藏"
- "查看这个书签相关的其他内容"
- "有哪些书签和 ID xxx 属于同一主题"`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 400,
  },

  async execute(
    params: FindRelatedByTopicParams,
    context: ToolContext,
  ): Promise<ToolResult<FindRelatedByTopicResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);

    const { bookmarkId, limit = 10 } = params;

    try {
      // 1. 验证书签存在且属于当前用户
      const supabase = await createClient();
      const { data: bookmark, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id, title, url")
        .eq("id", bookmarkId)
        .eq("user_id", context.userId)
        .single();

      if (bookmarkError || !bookmark) {
        return {
          success: false,
          error: "书签不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 获取书签所属的聚类
      const topicClustererService = getTopicClustererService();
      const cluster = await topicClustererService.getBookmarkCluster(
        context.userId,
        bookmarkId,
      );

      if (!cluster) {
        const executionTimeMs = Math.round(performance.now() - startTime);

        logger.info(
          {
            toolName: "find_related_by_topic",
            userId: context.userId,
            bookmarkId,
            hasCluster: false,
            executionTimeMs,
            reasoning,
          },
          "find_related_by_topic: No cluster found",
        );

        return {
          success: true,
          data: {
            bookmarkId,
            cluster: null,
            relatedBookmarks: [],
            message: `书签「${bookmark.title}」尚未加入任何主题簇。可能是新收藏或数据较少`,
          },
          metadata: {
            executionTimeMs,
            affectedCount: 0,
          },
        };
      }

      // 3. 获取同聚类中的其他书签
      const otherBookmarkIds = cluster.bookmarkIds
        .filter((id) => id !== bookmarkId)
        .slice(0, limit);

      let relatedBookmarks: RelatedBookmarkByTopic[] = [];

      if (otherBookmarkIds.length > 0) {
        const { data: relatedData } = await supabase
          .from("bookmarks")
          .select("id, title, url")
          .in("id", otherBookmarkIds);

        if (relatedData) {
          relatedBookmarks = relatedData.map((b) => ({
            id: b.id,
            title: b.title,
            url: b.url,
            strength: Math.round(cluster.cohesion * 100) / 100,
            topicLabel: cluster.label,
          }));
        }
      }

      // 4. 生成友好消息
      const clusterInfo = transformClusterResult(cluster);
      let message: string;

      if (relatedBookmarks.length === 0) {
        message = `书签「${bookmark.title}」属于主题「${cluster.label}」，但该主题下暂无其他书签`;
      } else {
        message = `书签「${bookmark.title}」属于主题「${cluster.label}」，找到 ${relatedBookmarks.length} 个相关书签`;
        if (clusterInfo.representativeTags.length > 0) {
          message += `。主题关键词：${clusterInfo.representativeTags.join("、")}`;
        }
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "find_related_by_topic",
          userId: context.userId,
          bookmarkId,
          clusterId: cluster.clusterId,
          clusterLabel: cluster.label,
          relatedCount: relatedBookmarks.length,
          executionTimeMs,
          reasoning,
        },
        "find_related_by_topic: Success",
      );

      return {
        success: true,
        data: {
          bookmarkId,
          cluster: clusterInfo,
          relatedBookmarks,
          message,
        },
        metadata: {
          executionTimeMs,
          affectedCount: relatedBookmarks.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "find_related_by_topic",
          userId: context.userId,
          bookmarkId,
          error: errorMessage,
          executionTimeMs,
        },
        "find_related_by_topic: Failed",
      );

      return {
        success: false,
        error: "查找相关内容失败，请稍后重试",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
