/**
 * 分类系统 A/B 对比测试 API
 * POST /api/dev/classification-compare
 *
 * @description
 * 开发用 API，用于对比 V4.2 和 Lite V2 分类算法的效果。
 * 仅供开发测试使用，生产环境应禁用。
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Input validation schema
const requestSchema = z.object({
  version: z.enum(["v4.2", "lite-v2"]),
  bookmarkId: z.number().int().positive(),
  embedding: z.array(z.number()).nullable(),
  tags: z.array(z.string()),
  title: z.string().min(1).max(500),
});

type ClassifyRequest = z.infer<typeof requestSchema>;

interface ClassificationResponse {
  action: "auto_classify" | "suggest" | "to_inbox";
  folderId?: number;
  folderName?: string;
  confidence: number;
  reason: string;
}

/**
 * POST /api/dev/classification-compare
 * 对比分类测试
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    let body: ClassifyRequest;
    try {
      const rawBody = await request.json();
      const parsed = requestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return badRequestError(
          `参数验证失败: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        );
      }
      body = parsed.data;
    } catch {
      return badRequestError("请求体无效");
    }

    const { version, bookmarkId, embedding, tags, title } = body;

    // 3. 如果没有 embedding，无法进行向量匹配
    if (!embedding || embedding.length === 0) {
      return successResponse({
        action: "to_inbox",
        confidence: 0,
        reason: "书签没有向量数据，无法进行分类匹配",
      } as ClassificationResponse);
    }

    const supabase = await createClient();

    // 4. 根据版本选择分类算法
    let result: ClassificationResponse;

    if (version === "v4.2") {
      result = await classifyWithV42(supabase, user.id, {
        bookmarkId,
        embedding,
        tags,
        title,
      });
    } else {
      result = await classifyWithLiteV2(supabase, user.id, {
        bookmarkId,
        embedding,
        tags,
        title,
      });
    }

    logger.info(
      {
        version,
        bookmarkId,
        action: result.action,
        confidence: result.confidence,
        folderId: result.folderId,
      },
      "Classification compare test completed",
    );

    return successResponse(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "POST /api/dev/classification-compare error",
    );
    return internalError("分类测试失败");
  }
}

interface ClassifyInput {
  bookmarkId: number;
  embedding: number[];
  tags: string[];
  title: string;
}

/**
 * V4.2 分类算法
 * 使用完整的分类系统（多层匹配器 + 文件夹画像）
 */
async function classifyWithV42(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  input: ClassifyInput,
): Promise<ClassificationResponse> {
  const { embedding, title: _title, tags: _tags } = input;

  try {
    // 使用 RPC 调用向量搜索匹配文件夹画像
    const { data: matches, error } = await supabase.rpc(
      "search_folder_profiles_by_embedding",
      {
        query_embedding: JSON.stringify(embedding),
        p_user_id: userId,
        p_limit: 5,
        p_similarity_threshold: 0.5,
      },
    );

    if (error) {
      logger.error({ error }, "V4.2 folder profile search failed");
      return {
        action: "to_inbox",
        confidence: 0,
        reason: `向量搜索失败: ${error.message}`,
      };
    }

    if (!matches || matches.length === 0) {
      return {
        action: "to_inbox",
        confidence: 0,
        reason: "没有找到匹配的文件夹",
      };
    }

    // 取最佳匹配
    const bestMatch = matches[0];
    const similarity = bestMatch.similarity || 0;
    const confidence = Math.round(similarity * 100);

    // V4.2 阈值：
    // >= 80%: 自动分类
    // 60-79%: 建议
    // < 60%: 待分类
    let action: ClassificationResponse["action"];
    if (confidence >= 80) {
      action = "auto_classify";
    } else if (confidence >= 60) {
      action = "suggest";
    } else {
      action = "to_inbox";
    }

    return {
      action,
      folderId: bestMatch.folder_id,
      folderName: bestMatch.folder_name,
      confidence,
      reason: `V4.2 画像匹配 (相似度: ${confidence}%)`,
    };
  } catch (error) {
    logger.error({ error }, "V4.2 classification error");
    return {
      action: "to_inbox",
      confidence: 0,
      reason: `分类错误: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Lite V2 分类算法
 * 轻量化方案：仅使用名称向量 + 简单相似度匹配
 */
async function classifyWithLiteV2(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  input: ClassifyInput,
): Promise<ClassificationResponse> {
  const { embedding, title: _title, tags: _tags } = input;

  try {
    // Lite V2: 使用名称向量进行简单匹配
    // 先获取用户的所有非系统文件夹及其名称向量
    const { data: folders, error: foldersError } = await supabase
      .from("folder_profiles")
      .select(
        `
        folder_id,
        name_embedding,
        folders!inner(name, is_system, is_archived)
      `,
      )
      .eq("user_id", userId)
      .eq("folders.is_system", false)
      .eq("folders.is_archived", false)
      .not("name_embedding", "is", null);

    if (foldersError) {
      logger.error({ error: foldersError }, "Lite V2 folder fetch failed");
      return {
        action: "to_inbox",
        confidence: 0,
        reason: `获取文件夹失败: ${foldersError.message}`,
      };
    }

    if (!folders || folders.length === 0) {
      return {
        action: "to_inbox",
        confidence: 0,
        reason: "没有可用的文件夹进行匹配",
      };
    }

    // 计算与每个文件夹名称向量的余弦相似度
    let bestMatch: {
      folderId: number;
      folderName: string;
      similarity: number;
    } | null = null;

    for (const folder of folders) {
      if (!folder.name_embedding) continue;

      // 解析名称向量
      let nameEmbedding: number[];
      try {
        nameEmbedding =
          typeof folder.name_embedding === "string"
            ? JSON.parse(folder.name_embedding)
            : folder.name_embedding;
      } catch {
        continue;
      }

      // 计算余弦相似度
      const similarity = cosineSimilarity(embedding, nameEmbedding);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = {
          folderId: folder.folder_id,
          folderName: folder.folders?.name || "未知",
          similarity,
        };
      }
    }

    if (!bestMatch) {
      return {
        action: "to_inbox",
        confidence: 0,
        reason: "无法计算相似度",
      };
    }

    const confidence = Math.round(bestMatch.similarity * 100);

    // Lite V2 阈值（比 V4.2 略宽松）：
    // >= 75%: 自动分类
    // 55-74%: 建议
    // < 55%: 待分类
    let action: ClassificationResponse["action"];
    if (confidence >= 75) {
      action = "auto_classify";
    } else if (confidence >= 55) {
      action = "suggest";
    } else {
      action = "to_inbox";
    }

    return {
      action,
      folderId: bestMatch.folderId,
      folderName: bestMatch.folderName,
      confidence,
      reason: `Lite V2 名称匹配 (相似度: ${confidence}%)`,
    };
  } catch (error) {
    logger.error({ error }, "Lite V2 classification error");
    return {
      action: "to_inbox",
      confidence: 0,
      reason: `分类错误: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
