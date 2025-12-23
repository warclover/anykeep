/**
 * AI 快捷操作 API
 *
 * POST /api/ai/quick-actions - 执行 AI 快捷操作
 *
 * 支持的操作类型：
 * - auto-tag: 智能标签推荐
 * - auto-classify: 智能分类（文件夹推荐）
 * - extract-key: 提取关键要点
 * - rate-quality: 内容质量评估
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeQuickAction, QuickActionRequestSchema } from "@/lib/ai-actions";
import { logger } from "@/lib/logger";

/**
 * POST /api/ai/quick-actions
 * 执行 AI 快捷操作
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "请先登录" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = QuickActionRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求参数无效",
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { action, bookmarkId, autoApply } = validation.data;

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        action,
        bookmarkId,
        autoApply,
      },
      "AI Quick Action: Request received",
    );

    // 3. 执行快捷操作
    const result = await executeQuickAction(user.id, {
      action,
      bookmarkId,
      autoApply,
    });

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        action,
        bookmarkId,
        success: result.success,
        durationMs: result.success ? result.durationMs : undefined,
      },
      "AI Quick Action: Request completed",
    );

    // 4. 返回结果
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/ai/quick-actions error",
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "快捷操作执行失败",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
