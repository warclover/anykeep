/**
 * Folder Embedding Fix API
 * V4.2.8 文件夹向量修复接口
 *
 * @description
 * 检查并修复缺失 name_embedding 的文件夹
 * 用于轮询检查和存量数据修复
 *
 * GET: 获取缺失向量的文件夹统计
 * POST: 批量修复缺失向量的文件夹
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializeFolderNameProfile } from "@/lib/classification/server";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface FolderMissingEmbedding {
  id: number;
  name: string;
  created_at: string | null;
}

interface FixStatusResponse {
  /** 缺失向量的文件夹数量 */
  missingCount: number;
  /** 已有向量的文件夹数量 */
  hasEmbeddingCount: number;
  /** 总文件夹数量（非系统） */
  totalCount: number;
  /** 缺失向量的文件夹列表（前 20 个） */
  missingFolders: FolderMissingEmbedding[];
}

interface FixResult {
  /** 成功修复数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 失败的文件夹 ID */
  failedIds: number[];
  /** 耗时 (ms) */
  durationMs: number;
}

// ============================================================================
// GET - 获取缺失向量的文件夹统计
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 查询缺失 name_embedding 的文件夹
    // 使用 LEFT JOIN 检查 folder_profiles 表
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderWithProfile = {
      id: number;
      name: string;
      created_at: string | null;
      folder_profiles: { name_embedding: unknown } | null;
    };
    const { data: missingFolders, error: missingError } = await supabase
      .from("folders")
      .select(
        `
        id,
        name,
        created_at,
        folder_profiles!left (
          name_embedding
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }) as unknown as {
      data: FolderWithProfile[] | null;
      error: { message: string } | null;
    };

    if (missingError) {
      logger.error(
        { error: missingError.message },
        "FixEmbeddings API: Failed to query folders",
      );
      return NextResponse.json(
        { error: "Failed to query folders" },
        { status: 500 },
      );
    }

    // 过滤出缺失向量的文件夹
    const foldersWithoutEmbedding = (missingFolders || []).filter((f) => {
      const profile = f.folder_profiles;
      return !profile || profile.name_embedding === null;
    });

    const foldersWithEmbedding = (missingFolders || []).filter((f) => {
      const profile = f.folder_profiles;
      return profile && profile.name_embedding !== null;
    });

    const response: FixStatusResponse = {
      missingCount: foldersWithoutEmbedding.length,
      hasEmbeddingCount: foldersWithEmbedding.length,
      totalCount: (missingFolders || []).length,
      missingFolders: foldersWithoutEmbedding.slice(0, 20).map((f) => ({
        id: f.id,
        name: f.name,
        created_at: f.created_at,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "FixEmbeddings API: GET error",
    );
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST - 批量修复缺失向量的文件夹
// ============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 解析请求参数
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(body.batchSize ?? 10, 1), 50);

    const startTime = Date.now();

    // 查询缺失 name_embedding 的文件夹
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderWithProfile = {
      id: number;
      name: string;
      folder_profiles: { name_embedding: unknown } | null;
    };
    const { data: folders, error: queryError } = await supabase
      .from("folders")
      .select(
        `
        id,
        name,
        folder_profiles!left (
          name_embedding
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(batchSize * 2) as unknown as {
      data: FolderWithProfile[] | null;
      error: { message: string } | null;
    }; // 查询更多，因为部分可能已有 embedding

    if (queryError) {
      logger.error(
        { error: queryError.message },
        "FixEmbeddings API: Failed to query folders",
      );
      return NextResponse.json(
        { error: "Failed to query folders" },
        { status: 500 },
      );
    }

    // 过滤出缺失向量的文件夹
    const foldersToFix = (folders || [])
      .filter((f) => {
        const profile = f.folder_profiles;
        return !profile || profile.name_embedding === null;
      })
      .slice(0, batchSize);

    if (foldersToFix.length === 0) {
      return NextResponse.json({
        message: "No folders need fixing",
        successCount: 0,
        failedCount: 0,
        failedIds: [],
        durationMs: Date.now() - startTime,
      });
    }

    // 批量修复
    let successCount = 0;
    let failedCount = 0;
    const failedIds: number[] = [];

    for (const folder of foldersToFix) {
      try {
        await initializeFolderNameProfile(folder.id, folder.name, user.id);
        successCount++;

        logger.info(
          { folderId: folder.id, folderName: folder.name },
          "FixEmbeddings API: Fixed folder embedding",
        );
      } catch (error) {
        failedCount++;
        failedIds.push(folder.id);

        logger.warn(
          {
            folderId: folder.id,
            folderName: folder.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "FixEmbeddings API: Failed to fix folder embedding",
        );
      }
    }

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        userId: user.id,
        requested: batchSize,
        processed: foldersToFix.length,
        success: successCount,
        failed: failedCount,
        durationMs,
      },
      "FixEmbeddings API: Batch fix completed",
    );

    const response: FixResult = {
      successCount,
      failedCount,
      failedIds,
      durationMs,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "FixEmbeddings API: POST error",
    );
    return NextResponse.json(
      { error: "Failed to fix embeddings" },
      { status: 500 },
    );
  }
}
