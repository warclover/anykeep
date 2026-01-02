/**
 * Parent-Child 切片迁移 API
 *
 * 触发现有书签的 Parent-Child 切片迁移
 *
 * @route POST /api/internal/cron/migrate-bookmark-chunks
 * @route GET /api/internal/cron/migrate-bookmark-chunks
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { createChunkMigrationService } from "@/lib/chunking/chunk-migration.service";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

// 使用服务角色密钥创建客户端
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * GET: 获取迁移状态和统计
 */
export async function GET(request: Request) {
  try {
    // 验证 CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING) {
      return NextResponse.json({
        status: "disabled",
        message: "Parent-Child chunking is disabled",
      });
    }

    // 验证环境变量
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 },
      );
    }

    // 创建服务角色客户端
    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

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
    // 验证 CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING) {
      return NextResponse.json({
        status: "disabled",
        message: "Parent-Child chunking is disabled",
      });
    }

    // 验证环境变量
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 },
      );
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
    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

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
