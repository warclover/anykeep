/**
 * 批量查询书签状态 API
 * GET /api/bookmarks/batch-status?ids=1,2,3
 *
 * 用于轮询 PROCESSING 状态的书签，获取最新数据
 * V3.1 更新：新增 classification_status 和 classification_result 字段
 * 支持前端轮询获取分类完成状态
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";
import { BOOKMARK } from "@/lib/constants/messages";

export async function GET(request: NextRequest) {
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

    // 2. 解析查询参数
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

    // 限制单次查询数量（防止滥用）
    if (ids.length > 20) {
      return badRequestError("单次查询最多 20 条");
    }

    // 3. 查询书签数据（仅返回需要更新的字段）
    // V3.1: 新增 classification_status 和 classification_result 字段
    const { data: bookmarks, error: queryError } = await supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        description,
        platform,
        ai_summary,
        ai_tags,
        status,
        cover_url,
        source_name,
        author,
        word_count,
        image_count,
        publish_time,
        folder_id,
        classification_status,
        classification_result,
        folders(name)
      `,
      )
      .eq("user_id", user.id)
      .in("id", ids);

    if (queryError) {
      return databaseError(BOOKMARK.LOAD_ERROR, queryError);
    }

    // 4. 返回结果
    return successResponse({
      bookmarks: bookmarks || [],
    });
  } catch (error) {
    return databaseError(
      BOOKMARK.LOAD_ERROR,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
