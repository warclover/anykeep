/**
 * Folder Connections API
 * GET /api/folders/connections - 获取文件夹之间的内容关联
 * GET /api/folders/connections?matrix=true - 获取文件夹相似度矩阵
 *
 * Phase 2.3: 文件夹关联分析功能
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * 跨文件夹连接结果类型
 */
interface CrossFolderConnection {
  sourceBookmark: {
    id: number;
    title: string;
    folderId: number | null;
    folderName: string | null;
  };
  targetBookmark: {
    id: number;
    title: string;
    folderId: number | null;
    folderName: string | null;
  };
  similarity: number;
}

/**
 * 文件夹相似度矩阵项
 */
interface FolderSimilarityItem {
  folder1: {
    id: number;
    name: string;
    bookmarkCount: number;
  };
  folder2: {
    id: number;
    name: string;
    bookmarkCount: number;
  };
  avgSimilarity: number;
  maxSimilarity: number;
  connectionCount: number;
}

/**
 * GET /api/folders/connections
 * 获取文件夹之间的内容关联
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const isMatrix = searchParams.get("matrix") === "true";
    const folderIdParam = searchParams.get("folderId");
    const folderId = folderIdParam ? parseInt(folderIdParam, 10) : null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50); // 最大 50
    const minSimilarity = parseFloat(
      searchParams.get("minSimilarity") || "0.7",
    );

    if (isMatrix) {
      // 3a. 获取文件夹相似度矩阵
      const minBookmarks = parseInt(
        searchParams.get("minBookmarks") || "3",
        10,
      );

      // V4.2 RPC

      type MatrixRow = {
        folder1_id: number;
        folder1_name: string;
        folder1_count: number;
        folder2_id: number;
        folder2_name: string;
        folder2_count: number;
        avg_similarity: number;
        max_similarity: number;
        connection_count: number;
      };
      const { data: matrixData, error: matrixError } = (await (
        supabase.rpc /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
      )("get_folder_similarity_matrix", {
        p_user_id: user.id,
        p_min_bookmarks: minBookmarks,
      })) as { data: MatrixRow[] | null; error: { message: string } | null };

      if (matrixError) {
        logger.error(
          { error: matrixError, userId: user.id },
          "Failed to get folder similarity matrix",
        );
        return internalError("获取文件夹相似度矩阵失败");
      }

      // 格式化响应
      const matrix: FolderSimilarityItem[] = (matrixData || []).map((item) => ({
        folder1: {
          id: item.folder1_id,
          name: item.folder1_name,
          bookmarkCount: item.folder1_count,
        },
        folder2: {
          id: item.folder2_id,
          name: item.folder2_name,
          bookmarkCount: item.folder2_count,
        },
        avgSimilarity: Math.round(item.avg_similarity * 100) / 100,
        maxSimilarity: Math.round(item.max_similarity * 100) / 100,
        connectionCount: item.connection_count,
      }));

      // 生成合并建议
      const mergeSuggestions = matrix
        .filter((item) => item.avgSimilarity >= 0.75)
        .map((item) => ({
          ...item,
          reason:
            item.avgSimilarity >= 0.85
              ? "内容高度重叠，建议合并"
              : "内容相似度较高，可考虑合并",
        }));

      logger.debug(
        {
          userId: user.id,
          matrixSize: matrix.length,
          mergeSuggestionsCount: mergeSuggestions.length,
        },
        "Folder similarity matrix fetched",
      );

      return successResponse({
        type: "matrix",
        matrix,
        mergeSuggestions,
        params: {
          minBookmarks,
        },
      });
    } else {
      // 3b. 获取跨文件夹连接 - V4.2 RPC

      type ConnectionRow = {
        source_bookmark_id: number;
        source_title: string;
        source_folder_id: number | null;
        source_folder_name: string | null;
        target_bookmark_id: number;
        target_title: string;
        target_folder_id: number | null;
        target_folder_name: string | null;
        similarity: number;
      };
      const { data: connectionsData, error: connectionsError } = (await (
        supabase.rpc /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
      )("find_cross_folder_connections", {
        p_user_id: user.id,
        p_folder_id: folderId ?? undefined,
        p_min_similarity: minSimilarity,
        p_limit: limit,
      })) as {
        data: ConnectionRow[] | null;
        error: { message: string } | null;
      };

      if (connectionsError) {
        logger.error(
          { error: connectionsError, userId: user.id, folderId },
          "Failed to find cross folder connections",
        );
        return internalError("获取文件夹关联失败");
      }

      // 格式化响应
      const connections: CrossFolderConnection[] = (connectionsData || []).map(
        (item) => ({
          sourceBookmark: {
            id: item.source_bookmark_id,
            title: item.source_title,
            folderId: item.source_folder_id,
            folderName: item.source_folder_name,
          },
          targetBookmark: {
            id: item.target_bookmark_id,
            title: item.target_title,
            folderId: item.target_folder_id,
            folderName: item.target_folder_name,
          },
          similarity: Math.round(item.similarity * 100) / 100,
        }),
      );

      // 按文件夹对分组统计
      const folderPairStats: Record<
        string,
        {
          folder1: { id: number | null; name: string | null };
          folder2: { id: number | null; name: string | null };
          connectionCount: number;
          avgSimilarity: number;
        }
      > = {};

      connections.forEach((conn) => {
        const key =
          conn.sourceBookmark.folderId &&
          conn.targetBookmark.folderId &&
          conn.sourceBookmark.folderId < conn.targetBookmark.folderId
            ? `${conn.sourceBookmark.folderId}-${conn.targetBookmark.folderId}`
            : `${conn.targetBookmark.folderId}-${conn.sourceBookmark.folderId}`;

        if (!folderPairStats[key]) {
          folderPairStats[key] = {
            folder1: {
              id: conn.sourceBookmark.folderId,
              name: conn.sourceBookmark.folderName,
            },
            folder2: {
              id: conn.targetBookmark.folderId,
              name: conn.targetBookmark.folderName,
            },
            connectionCount: 0,
            avgSimilarity: 0,
          };
        }
        folderPairStats[key].connectionCount++;
        folderPairStats[key].avgSimilarity +=
          conn.similarity / connections.length;
      });

      logger.debug(
        {
          userId: user.id,
          folderId,
          connectionsCount: connections.length,
        },
        "Cross folder connections fetched",
      );

      return successResponse({
        type: "connections",
        connections,
        folderPairStats: Object.values(folderPairStats),
        params: {
          folderId,
          limit,
          minSimilarity,
        },
      });
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/folders/connections error",
    );
    return internalError("获取文件夹关联失败");
  }
}
