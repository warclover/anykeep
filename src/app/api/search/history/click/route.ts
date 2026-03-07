/**
 * 搜索点击记录 API
 *
 * POST /api/search/history/click - 记录用户点击搜索结果
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { createSearchHistoryService } from "@/lib/ai-skills/search/search-history.service";

/**
 * POST /api/search/history/click
 *
 * 记录搜索结果点击
 *
 * Body:
 * - searchId: string (必填，搜索记录 ID)
 * - bookmarkId: number (必填，被点击的书签 ID)
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const { searchId, bookmarkId } = body;

  if (!searchId || typeof searchId !== "string") {
    return badRequestError("searchId 为必填字段");
  }

  if (!bookmarkId || typeof bookmarkId !== "number") {
    return badRequestError("bookmarkId 为必填字段且必须是数字");
  }

  const service = createSearchHistoryService(supabase, userId);
  const success = await service.recordClick(searchId, bookmarkId);

  if (!success) {
    return internalError("记录点击失败");
  }

  return successResponse({ recorded: true });
});
