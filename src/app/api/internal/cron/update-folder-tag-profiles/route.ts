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
import { supabaseEnv, appEnv } from "@/lib/env";
import { FolderTagProfilerService } from "@/lib/classification/strategies/modern/folder-tag-profiler.service";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

// 使用 Service Role Key 以绕过 RLS
const supabaseAdmin = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey);

// Cron secret for authentication
const CRON_SECRET = appEnv.cronSecret;

/**
 * GET /api/internal/cron/update-folder-tag-profiles
 * 定时更新文件夹标签画像（用于 AI 标签匹配）
 */
export async function GET(request: Request) {
  try {
    // 验证 Cron 请求
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    let totalFoldersUpdated = 0;
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

    // 3. 为每个用户更新画像
    for (const user of activeUsers) {
      try {
        // 获取用户文件夹数量
        const { count: folderCount } = await supabaseAdmin
          .from("folders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("deleted_at", null);

        if (folderCount && folderCount > 0) {
          await profilerService.updateAllProfiles(user.id);
          updatedUsersCount++;
          totalFoldersUpdated += folderCount;
        }
      } catch (error) {
        errorCount++;
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: user.id,
          },
          "Failed to update user folder tag profiles",
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      {
        updatedUsersCount,
        totalFoldersUpdated,
        errorCount,
        duration,
      },
      "Folder tag profiles update cron job completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        users: updatedUsersCount,
        folders: totalFoldersUpdated,
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
