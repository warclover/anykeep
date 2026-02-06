/**
 * 定时任务: 更新文件夹画像
 * 每日凌晨 3:00 运行，更新所有用户的文件夹画像
 *
 * Vercel Cron: 0 3 * * *
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { getCurrentEmbeddingVersion } from "@/lib/utils/embedding-generator";
import { supabaseEnv } from "@/lib/env";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// 使用 Service Role Key 以绕过 RLS
const supabaseAdmin = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey);

/**
 * GET /api/cron/update-folder-profiles
 * 定时更新文件夹画像
 */
export async function GET(request: Request) {
  try {
    // 🔒 安全修复：使用统一的内部 API 认证
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    logger.info("Starting folder profiles update cron job");

    const startTime = Date.now();
    let updatedCount = 0;
    let errorCount = 0;

    // 1. 获取所有需要更新画像的文件夹
    // 优先更新: 最近有新书签的文件夹
    const { data: foldersToUpdate, error: fetchError } = await supabaseAdmin
      .from("folders")
      .select(
        `
        id,
        user_id,
        name,
        bookmarks:bookmarks(count)
      `,
      )
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(500); // 每次最多更新 500 个文件夹

    if (fetchError) {
      logger.error(
        { error: fetchError },
        "Failed to fetch folders for profile update",
      );
      return NextResponse.json(
        { error: "Failed to fetch folders", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!foldersToUpdate || foldersToUpdate.length === 0) {
      logger.info("No folders to update");
      return NextResponse.json({
        success: true,
        message: "No folders to update",
        stats: { updated: 0, errors: 0, duration: Date.now() - startTime },
      });
    }

    // 2. 批量更新文件夹画像
    for (const folder of foldersToUpdate) {
      try {
        await updateFolderProfile(folder.id, folder.user_id);
        updatedCount++;
      } catch (error) {
        errorCount++;
        logger.error(
          { error, folderId: folder.id },
          "Failed to update folder profile",
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      { updatedCount, errorCount, duration },
      "Folder profiles update cron job completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        updated: updatedCount,
        errors: errorCount,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * 更新单个文件夹的画像
 */
async function updateFolderProfile(
  folderId: number,
  userId: string,
): Promise<void> {
  // 1. 获取文件夹中的书签
  const { data: bookmarks, error: bookmarksError } = await supabaseAdmin
    .from("bookmarks")
    .select("id, title, ai_tags, embedding")
    .eq("folder_id", folderId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(100); // 最多取 100 个书签计算画像

  if (bookmarksError) {
    throw new Error(`Failed to fetch bookmarks: ${bookmarksError.message}`);
  }

  if (!bookmarks || bookmarks.length === 0) {
    // 如果文件夹为空，删除画像
    await supabaseAdmin
      .from("folder_profiles")
      .delete()
      .eq("folder_id", folderId);
    return;
  }

  // 2. 计算画像数据
  const bookmarkCount = bookmarks.length;

  // 收集所有标签并统计频率
  const tagFrequency: Record<string, number> = {};
  for (const bookmark of bookmarks) {
    const tags = bookmark.ai_tags || [];
    for (const tag of tags) {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    }
  }

  // 取 Top 10 标签
  const topTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // 取前 5 个书签标题作为示例
  const sampleTitles = bookmarks.slice(0, 5).map((b) => b.title);

  // 3. 计算画像向量（取所有书签向量的平均值）
  const validEmbeddings = bookmarks
    .filter((b) => b.embedding && Array.isArray(b.embedding))
    .map((b) => b.embedding as number[]);

  let profileEmbedding: number[] | null = null;
  if (validEmbeddings.length > 0) {
    const embeddingLength = validEmbeddings[0].length;
    profileEmbedding = new Array(embeddingLength).fill(0);

    for (const embedding of validEmbeddings) {
      for (let i = 0; i < embeddingLength; i++) {
        profileEmbedding[i] += embedding[i];
      }
    }

    // 平均化
    for (let i = 0; i < embeddingLength; i++) {
      profileEmbedding[i] /= validEmbeddings.length;
    }

    // 归一化
    const norm = Math.sqrt(profileEmbedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      profileEmbedding = profileEmbedding.map((v) => v / norm);
    }
  }

  // 4. 计算内部一致性（书签间的平均相似度）
  let internalSimilarity = 0;
  if (validEmbeddings.length >= 2) {
    let totalSim = 0;
    let pairCount = 0;
    for (let i = 0; i < validEmbeddings.length && i < 20; i++) {
      for (let j = i + 1; j < validEmbeddings.length && j < 20; j++) {
        totalSim += cosineSimilarity(validEmbeddings[i], validEmbeddings[j]);
        pairCount++;
      }
    }
    internalSimilarity = pairCount > 0 ? totalSim / pairCount : 0;
  }

  // 5. Upsert 画像
  // V4.2.7: 添加 embedding 版本追踪
  const { error: upsertError } = await supabaseAdmin
    .from("folder_profiles")
    .upsert(
      {
        user_id: userId,
        folder_id: folderId,
        profile_embedding: profileEmbedding,
        // V4.2.7: 保存 embedding 版本信息
        profile_embedding_version: profileEmbedding
          ? getCurrentEmbeddingVersion()
          : null,
        bookmark_count: bookmarkCount,
        top_tags: topTags,
        sample_titles: sampleTitles,
        internal_similarity: internalSimilarity,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "folder_id",
      },
    );

  if (upsertError) {
    throw new Error(`Failed to upsert profile: ${upsertError.message}`);
  }
}

/**
 * 计算余弦相似度
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
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// 配置: 允许较长的执行时间
export const maxDuration = 300; // 5 分钟
