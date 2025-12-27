/**
 * 链接健康检测 API - 批量修复
 *
 * POST /api/link-health/fix
 *
 * 功能：
 * - 批量执行修复操作
 * - 支持：删除、归档、更新 URL、忽略
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchFixRequestSchema } from "@/lib/ai-skills/skills/link-health-check/schema";
import type { FixActionResult } from "@/lib/ai-skills/skills/link-health-check/types";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  databaseError,
} from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";

/**
 * POST /api/link-health/fix
 * 批量修复问题链接
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 身份验证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 速率限制检查（批量操作，使用 batch 类别）
    const rateLimitResult = checkRateLimit(user.id, "/api/batch");
    if (!rateLimitResult.allowed) {
      logger.warn(
        {
          userId: user.id.slice(0, 8) + "...",
          remaining: rateLimitResult.remaining,
          resetMs: rateLimitResult.resetMs,
        },
        "Link Health Fix API: Rate limit exceeded",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "请求过于频繁，请稍后再试",
            retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    // 3. 解析请求体
    const body = await request.json();
    const parseResult = BatchFixRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequestError(parseResult.error.issues[0].message);
    }

    const { actions } = parseResult.data;

    // 4. 验证书签所有权
    const bookmarkIds = actions.map((a) => a.bookmarkId);
    const { count, error: ownershipError } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .in("id", bookmarkIds)
      .eq("user_id", user.id);

    if (ownershipError) {
      logger.error(
        {
          userId: user.id.slice(0, 8) + "...",
          error: ownershipError.message,
        },
        "Link Health Fix API: Ownership check failed",
      );
      return databaseError("验证书签所有权失败");
    }

    if (count !== bookmarkIds.length) {
      return badRequestError("部分书签不存在或无权操作");
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        actionCount: actions.length,
        actions: actions.map((a) => ({
          id: a.bookmarkId,
          action: a.action,
        })),
      },
      "Link Health Fix API: Processing fix actions",
    );

    // 5. 执行修复操作
    const results: FixActionResult[] = [];

    for (const action of actions) {
      try {
        const result = await executeFixAction(supabase, user.id, action);
        results.push(result);
      } catch (error) {
        results.push({
          bookmarkId: action.bookmarkId,
          success: false,
          error: error instanceof Error ? error.message : "操作失败",
        });
      }
    }

    // 6. 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        total: results.length,
        successCount,
        failedCount,
        duration: Date.now() - startTime,
      },
      "Link Health Fix API: Fix completed",
    );

    return successResponse({
      success: failedCount === 0,
      results,
      summary:
        failedCount === 0
          ? `已成功处理 ${successCount} 个书签`
          : `成功 ${successCount} 个，失败 ${failedCount} 个`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      },
      "Link Health Fix API: Request failed",
    );

    return databaseError("修复操作失败，请稍后重试");
  }
}

/**
 * 执行单个修复操作
 */
async function executeFixAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  action: {
    bookmarkId: number;
    action: "delete" | "archive" | "update_url" | "ignore";
    newUrl?: string;
  },
): Promise<FixActionResult> {
  const { bookmarkId, action: actionType, newUrl } = action;

  switch (actionType) {
    case "delete": {
      // 软删除：设置 deleted_at
      const { error } = await supabase
        .from("bookmarks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", bookmarkId)
        .eq("user_id", userId);

      if (error) throw error;

      return { bookmarkId, success: true };
    }

    case "archive": {
      // 归档：移动到归档文件夹（如果存在）或设置标记
      // 简化处理：添加 "已归档" 标签
      const { data: bookmark, error: fetchError } = await supabase
        .from("bookmarks")
        .select("tags")
        .eq("id", bookmarkId)
        .eq("user_id", userId)
        .single();

      if (fetchError) throw fetchError;

      const currentTags = bookmark?.tags || [];
      if (!currentTags.includes("已归档")) {
        const { error: updateError } = await supabase
          .from("bookmarks")
          .update({ tags: [...currentTags, "已归档"] })
          .eq("id", bookmarkId)
          .eq("user_id", userId);

        if (updateError) throw updateError;
      }

      return { bookmarkId, success: true };
    }

    case "update_url": {
      // 更新 URL
      if (!newUrl) {
        return {
          bookmarkId,
          success: false,
          error: "更新 URL 时必须提供 newUrl",
        };
      }

      // 验证 URL 格式
      try {
        new URL(newUrl);
      } catch {
        return {
          bookmarkId,
          success: false,
          error: "无效的 URL 格式",
        };
      }

      const { error } = await supabase
        .from("bookmarks")
        .update({
          url: newUrl,
          health_status: "unknown", // 重置健康状态
          health_checked_at: null,
        })
        .eq("id", bookmarkId)
        .eq("user_id", userId);

      if (error) throw error;

      return { bookmarkId, success: true };
    }

    case "ignore": {
      // 忽略：设置健康状态为 ignored
      const { error } = await supabase
        .from("bookmarks")
        .update({
          health_status: "ignored",
          health_checked_at: new Date().toISOString(),
        })
        .eq("id", bookmarkId)
        .eq("user_id", userId);

      if (error) throw error;

      return { bookmarkId, success: true };
    }

    default:
      return {
        bookmarkId,
        success: false,
        error: `未知的操作类型: ${actionType}`,
      };
  }
}
