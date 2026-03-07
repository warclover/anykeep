/**
 * Parent-Child 切片迁移 API
 *
 * 触发现有书签的 Parent-Child 切片迁移
 *
 * @route POST /api/internal/cron/migrate-bookmark-chunks
 * @route GET /api/internal/cron/migrate-bookmark-chunks
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";
import { logger } from "@/lib/logger";
import { createChunkMigrationService } from "@/lib/chunking/chunk-migration.service";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

/**
 * GET: 获取迁移状态和统计
 */
export async function GET(request: Request) {
  try {
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING) {
      return NextResponse.json({
        status: "disabled",
        message: "Parent-Child chunking is disabled",
      });
    }

    // 创建服务角色客户端
    const supabase = getSupabaseAdmin();

    // 创建迁移服务
    const migrationService = createChunkMigrationService(supabase);

    // 获取统计信息
    const stats = await migrationService.getChunkStats();
    const pendingCount = await migrationService.getMigrationCandidateCount();

    return NextResponse.json({
      status: "ok",
      featureEnabled: true,
      stats,
      pendingMigration: pendingCount,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "ChunkMigration API: GET failed",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST: 触发迁移
 */
export async function POST(request: Request) {
  try {
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING) {
      return NextResponse.json({
        status: "disabled",
        message: "Parent-Child chunking is disabled",
      });
    }

    // 解析选项
    let options: {
      batchSize?: number;
      minContentLength?: number;
      generateEmbeddings?: boolean;
      userId?: string;
    } = {};

    try {
      const body = await request.json();
      options = {
        batchSize: body.batchSize,
        minContentLength: body.minContentLength,
        generateEmbeddings: body.generateEmbeddings,
        userId: body.userId,
      };
    } catch {
      // 忽略 JSON 解析错误，使用默认选项
    }

    logger.info({ options }, "ChunkMigration API: Starting migration");

    // 创建服务角色客户端
    const supabase = getSupabaseAdmin();

    // 创建迁移服务
    const migrationService = createChunkMigrationService(supabase, {
      batchSize: options.batchSize ?? 10,
      minContentLength: options.minContentLength ?? 200,
      generateEmbeddings: options.generateEmbeddings ?? true,
      skipExisting: true,
      userId: options.userId,
    });

    // 执行迁移
    const result = await migrationService.migrate();

    logger.info({ result }, "ChunkMigration API: Migration completed");

    return NextResponse.json({
      status: "ok",
      result,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "ChunkMigration API: POST failed",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
