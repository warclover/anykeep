/**
 * V3 vs V4 智能分类对比 API
 *
 * POST /api/dev/classification-compare
 *
 * 环境变量：
 * - ENABLE_CLASSIFICATION_DEBUGGER: API 功能开关
 */

import { createClient } from "@/lib/supabase/server";
import { handleCompare } from "@/features/classification-debugger/api";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  // 环境变量检查
  if (process.env.ENABLE_CLASSIFICATION_DEBUGGER !== "true") {
    logger.warn(
      "[ClassificationDebugger] API disabled - ENABLE_CLASSIFICATION_DEBUGGER not set",
    );
    return Response.json(
      { success: false, error: "功能未启用" },
      { status: 403 },
    );
  }

  try {
    // 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 调用处理函数
    return handleCompare(request, supabase, user.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { error: errorMessage },
      "[ClassificationDebugger] Route error",
    );

    return Response.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
