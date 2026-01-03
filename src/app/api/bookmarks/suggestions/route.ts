/**
 * 分类建议 API 路由
 * POST /api/bookmarks/suggestions - 接受或拒绝分类建议
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * 建议操作请求体
 */
interface SuggestionActionRequest {
  action: "accept" | "reject";
  suggestionId: number;
}

/**
 * POST /api/bookmarks/suggestions
 * 接受或拒绝分类建议
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
      return unauthorizedError();
    }

    // 2. 解析请求体
    const body = (await request.json()) as SuggestionActionRequest;

    if (!body.action || !body.suggestionId) {
      return badRequestError("Missing required fields: action, suggestionId");
    }

    if (body.action !== "accept" && body.action !== "reject") {
      return badRequestError('Invalid action. Must be "accept" or "reject"');
    }

    // 3. 调用数据库函数处理建议
    if (body.action === "accept") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: processed, error: acceptError } = await (supabase.rpc as any)(
        "accept_classification_suggestions",
        {
          p_user_id: user.id,
          p_suggestion_ids: [body.suggestionId],
        },
      ) as { data: unknown; error: { message: string } | null };

      if (acceptError) {
        logger.error(
          {
            error: acceptError,
            suggestionId: body.suggestionId,
            operation: "accept_suggestion",
          },
          "Failed to accept classification suggestion",
        );
        return databaseError("接受建议失败", acceptError);
      }

      logger.info(
        {
          suggestionId: body.suggestionId,
          processed,
          action: "suggestion_accepted",
        },
        "Classification suggestion accepted",
      );

      return successResponse({
        success: true,
        message: "已接受分类建议",
        processed,
      });
    } else {
      // reject
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rejected, error: rejectError } = await (supabase.rpc as any)(
        "reject_classification_suggestions",
        {
          p_user_id: user.id,
          p_suggestion_ids: [body.suggestionId],
        },
      ) as { data: unknown; error: { message: string } | null };

      if (rejectError) {
        logger.error(
          {
            error: rejectError,
            suggestionId: body.suggestionId,
            operation: "reject_suggestion",
          },
          "Failed to reject classification suggestion",
        );
        return databaseError("拒绝建议失败", rejectError);
      }

      logger.info(
        {
          suggestionId: body.suggestionId,
          rejected,
          action: "suggestion_rejected",
        },
        "Classification suggestion rejected",
      );

      return successResponse({
        success: true,
        message: "已拒绝分类建议",
        rejected,
      });
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "suggestion_action",
      },
      "POST /api/bookmarks/suggestions error",
    );
    return internalError("操作失败");
  }
}
