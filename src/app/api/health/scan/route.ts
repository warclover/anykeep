/**
 * 健康检测扫描 API
 *
 * POST /api/health/scan - 触发健康检测扫描
 * GET /api/health/scan - 获取扫描状态
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  detectDuplicates,
  type NormalizedBookmarkRow,
} from "@/lib/ai-skills/skills/duplicate-cleanup/detection";
import { normalizeUrl } from "@/lib/ai-skills/skills/duplicate-cleanup/url-normalizer";

// ============================================
// 类型定义
// ============================================

interface ScanResult {
  duplicatesFound: number;
  brokenLinksChecked: number;
  scanDuration: number;
  timestamp: string;
}

// ============================================
// GET - 获取最近扫描状态
// ============================================

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    // 获取最近一次扫描记录
    const { data: lastRun } = await supabase
      .from("health_check_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 获取缓存中的问题数量
    const { count: issueCount } = await supabase
      .from("health_check_cache")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "issue");

    return NextResponse.json({
      success: true,
      data: {
        lastRun: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              progress: lastRun.progress,
              totalChecked: lastRun.total_checked,
              brokenLinksCount: lastRun.broken_links_count,
              duplicatesCount: lastRun.duplicates_count,
              staleCount: lastRun.stale_count,
              startedAt: lastRun.started_at,
              completedAt: lastRun.completed_at,
            }
          : null,
        totalIssues: issueCount || 0,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Health Scan API: GET error",
    );
    return NextResponse.json(
      { success: false, error: "获取扫描状态失败" },
      { status: 500 },
    );
  }
}

// ============================================
// POST - 触发健康检测扫描
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { checkTypes = ["duplicate", "broken_link"] } = body;

    const startTime = Date.now();

    // 创建扫描记录
    const { data: runRecord, error: runError } = await supabase
      .from("health_check_runs")
      .insert({
        user_id: user.id,
        check_types: checkTypes,
        status: "running",
        progress: 0,
      })
      .select()
      .single();

    if (runError) {
      logger.error(
        { error: runError.message },
        "Health Scan API: Failed to create run record",
      );
      return NextResponse.json(
        { success: false, error: "创建扫描记录失败" },
        { status: 500 },
      );
    }

    const result: ScanResult = {
      duplicatesFound: 0,
      brokenLinksChecked: 0,
      scanDuration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // ========================================
      // 1. 重复内容检测
      // ========================================
      if (checkTypes.includes("duplicate")) {
        // 获取用户所有书签
        const { data: bookmarks, error: bookmarksError } = await supabase
          .from("bookmarks")
          .select(
            "id, title, url, platform, ai_summary, ai_tags, user_tags, folder_id, created_at, folders!folder_id(name)",
          )
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .limit(1000);

        if (bookmarksError) {
          throw new Error(`获取书签失败: ${bookmarksError.message}`);
        }

        if (bookmarks && bookmarks.length > 0) {
          // 规范化 URL
          const normalizedBookmarks: NormalizedBookmarkRow[] = bookmarks.map(
            (b) => ({
              ...b,
              normalizedUrl: normalizeUrl(b.url),
            }),
          );

          // 检测重复（使用 normalized URL 策略）
          const duplicateGroups = detectDuplicates(
            normalizedBookmarks,
            "normalized",
          );

          // 清除旧的重复检测缓存
          await supabase
            .from("health_check_cache")
            .delete()
            .eq("user_id", user.id)
            .eq("check_type", "duplicate");

          // 写入新的检测结果
          for (const group of duplicateGroups) {
            const groupId = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            for (const bookmark of group.bookmarks) {
              await supabase.from("health_check_cache").insert({
                user_id: user.id,
                check_type: "duplicate",
                bookmark_id: bookmark.id,
                status: "issue",
                severity: "medium",
                details: {
                  groupId,
                  matchType:
                    group.strategy === "exact" ? "exact_url" : "normalized_url",
                  similarity: group.similarity || 1,
                  recommendedKeepId: group.recommendedKeep,
                  reason: group.reason || "URL 匹配",
                },
              });
            }
          }

          result.duplicatesFound = duplicateGroups.reduce(
            (acc, g) => acc + g.bookmarks.length,
            0,
          );
        }

        // 更新进度
        await supabase
          .from("health_check_runs")
          .update({ progress: 50 })
          .eq("id", runRecord.id);
      }

      // ========================================
      // 2. 失效链接检测 (简化版 - 仅标记需要检查)
      // ========================================
      if (checkTypes.includes("broken_link")) {
        // 获取从未检查过链接状态的书签数量
        const { count: uncheckedCount } = await supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .is("last_link_check_at", null);

        result.brokenLinksChecked = uncheckedCount || 0;

        // 注意：实际的链接检测是异步的耗时操作
        // 这里只是标记需要检查的书签
        // 真正的检测可以通过后台任务或 Edge Function 完成
      }

      // ========================================
      // 3. 完成扫描
      // ========================================
      const scanDuration = Date.now() - startTime;
      result.scanDuration = scanDuration;

      await supabase
        .from("health_check_runs")
        .update({
          status: "completed",
          progress: 100,
          total_checked: result.duplicatesFound + result.brokenLinksChecked,
          duplicates_count: result.duplicatesFound,
          broken_links_count: 0, // 链接检测需要异步完成
          completed_at: new Date().toISOString(),
        })
        .eq("id", runRecord.id);

      logger.info(
        {
          userId: user.id,
          runId: runRecord.id,
          duplicatesFound: result.duplicatesFound,
          duration: scanDuration,
        },
        "Health Scan completed",
      );

      return NextResponse.json({
        success: true,
        data: {
          runId: runRecord.id,
          ...result,
        },
      });
    } catch (scanError) {
      // 标记扫描失败
      await supabase
        .from("health_check_runs")
        .update({
          status: "failed",
          error_message:
            scanError instanceof Error ? scanError.message : "扫描失败",
        })
        .eq("id", runRecord.id);

      throw scanError;
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Health Scan API: POST error",
    );
    return NextResponse.json(
      { success: false, error: "扫描失败" },
      { status: 500 },
    );
  }
}
