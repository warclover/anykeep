/**
 * Search API v1
 *
 * GET /api/v1/search - 搜索书签
 *
 * @module api/v1/search
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SearchService } from "@/services";
import { withAuthMiddleware, validateQuery } from "@/lib/api/middleware";
import { SearchRequestSchema } from "@/contracts";

/**
 * GET /api/v1/search
 *
 * 搜索书签（支持关键词、语义、混合搜索）
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const query = validateQuery(request, SearchRequestSchema);

  const supabase = await createClient();
  const service = new SearchService(supabase, userId);
  const result = await service.search(query);

  return NextResponse.json(
    {
      success: true,
      data: result,
    },
    {
      headers: {
        // 搜索结果缓存较短
        "Cache-Control": "private, max-age=10",
      },
    },
  );
});
