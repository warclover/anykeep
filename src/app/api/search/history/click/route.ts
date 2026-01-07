/**
 * 搜索点击记录 API
 *
 * POST /api/search/history/click - 记录用户点击搜索结果
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { createSearchHistoryService } from "@/lib/ai-skills/search/search-history.service";
import { logger } from "@/lib/logger";

/**
 * POST /api/search/history/click
 *
 * 记录搜索结果点击
 *
 * Body:
 * - searchId: string (必填，搜索记录 ID)
 * - bookmarkId: number (必填，被点击的书签 ID)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const body = await request.json();
    const { searchId, bookmarkId } = body;

    if (!searchId || typeof searchId !== "string") {
      return badRequestError("searchId 为必填字段");
    }

    if (!bookmarkId || typeof bookmarkId !== "number") {
      return badRequestError("bookmarkId 为必填字段且必须是数字");
    }

    const service = createSearchHistoryService(supabase, user.id);
    const success = await service.recordClick(searchId, bookmarkId);

    if (!success) {
      return internalError("记录点击失败");
    }

    return successResponse({ recorded: true });
  } catch (error) {
    logger.error({ error }, "[SearchHistory Click API] POST 失败");
    return internalError("记录点击失败");
  }
}
