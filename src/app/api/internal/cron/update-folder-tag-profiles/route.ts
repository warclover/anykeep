/**
 * 定时任务: 更新文件夹标签画像 (folder_tag_profiles)
 *
 * 用于 AI 标签优先匹配系统
 * 每日凌晨 3:30 运行，更新所有用户的文件夹标签画像
 *
 * Vercel Cron: 30 3 * * *
 *
 * @module @/app/api/internal/cron/update-folder-tag-profiles
 * @version 1.0.0
 * @since 2026-01-23
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseEnv } from "@/lib/env";
import { FolderTagProfilerService } from "@/lib/classification/strategies/modern/folder-tag-profiler.service";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// 使用 Service Role Key 以绕过 RLS
const supabaseAdmin = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey);

/**
 * GET /api/internal/cron/update-folder-tag-profiles
 * 定时更新文件夹标签画像（用于 AI 标签匹配）
 */
export async function GET(request: Request) {
  try {
    // 🔒 安全修复：使用统一的内部 API 认证
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_AI_TAG_MATCHER) {
      logger.info("AI 标签匹配器已禁用，跳过画像更新");
      return NextResponse.json({
        success: true,
        message: "AI Tag Matcher is disabled",
        skipped: true,
      });
    }

    logger.info("Starting folder tag profiles update cron job");

    const startTime = Date.now();
    let updatedUsersCount = 0;
    let errorCount = 0;

    // 1. 获取所有活跃用户（最近 30 天有登录或有书签变更）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeUsers, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(
        `last_seen.gte.${thirtyDaysAgo.toISOString()},updated_at.gte.${thirtyDaysAgo.toISOString()}`,
      )
      .limit(1000); // 每次最多处理 1000 个用户

    if (fetchError) {
      logger.error(
        { error: fetchError },
        "Failed to fetch active users for tag profile update",
      );
      return NextResponse.json(
        { error: "Failed to fetch users", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!activeUsers || activeUsers.length === 0) {
      logger.info("No active users to update");
      return NextResponse.json({
        success: true,
        message: "No active users to update",
        stats: {
          users: 0,
          folders: 0,
          errors: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // 2. 初始化画像服务
    const profilerService = new FolderTagProfilerService(supabaseAdmin);

    // 3. 并发更新用户画像（移除冗余 count 查询，控制并发数防止 DB 连接耗尽）
    const CONCURRENCY = 10;
    for (let i = 0; i < activeUsers.length; i += CONCURRENCY) {
      const batch = activeUsers.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((user) => profilerService.updateAllProfiles(user.id)),
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          updatedUsersCount++;
        } else {
          errorCount++;
          logger.error(
            {
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
              userId: batch[j].id,
            },
            "Failed to update user folder tag profiles",
          );
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      {
        updatedUsersCount,
        errorCount,
        duration,
      },
      "Folder tag profiles update cron job completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        users: updatedUsersCount,
        errors: errorCount,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Folder tag profiles cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 配置: 允许较长的执行时间
export const maxDuration = 300; // 5 分钟
