/**
 * MD 收藏批量状态查询 API
 *
 * GET /api/md-collections/batch-status?ids=1,2,3
 * 批量查询指定 ID 的处理状态（用于轮询）
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";

import { withAuthMiddleware } from "@/lib/api/middleware";
/**
 * GET /api/md-collections/batch-status
 * 批量查询 MD 收藏处理状态
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
  // 1. 解析查询参数
  const searchParams = request.nextUrl.searchParams;
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return badRequestError("缺少 ids 参数");
  }

  // 解析 ID 列表
  const ids = idsParam
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id) && id > 0);

  if (ids.length === 0) {
    return badRequestError("无效的 ids 参数");
  }

  // 限制最大查询数量
  if (ids.length > 50) {
    return badRequestError("单次最多查询 50 条记录");
  }

  // 3. 查询数据库
  const { data: items, error: queryError } = await supabase
    .from("md_collections")
    .select(
      "id, processing_status, ai_summary, ai_tags, processing_error, processed_at",
    )
    .eq("user_id", userId)
    .in("id", ids)
    .is("deleted_at", null);

  if (queryError) {
    return databaseError("查询失败", queryError);
  }

  return successResponse({
    items: items || [],
  });
});
