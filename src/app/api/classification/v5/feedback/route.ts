/**
 * 智能分类 v5.0 - 反馈 API 端点 (已废弃)
 *
 * POST /api/classification/v5/feedback
 *
 * @deprecated 使用 /api/classification/v2/feedback 代替
 * @since 2026-01-24 Phase 3 - 308 永久重定向
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * POST /api/classification/v5/feedback
 * 308 永久重定向到 /api/classification/v2/feedback
 */
export async function POST(request: NextRequest) {
  const newUrl = new URL("/api/classification/v2/feedback", request.url);

  return NextResponse.redirect(newUrl, {
    status: 308, // Permanent Redirect (preserves HTTP method)
    headers: {
      "X-Deprecation-Notice": "Use /api/classification/v2/feedback instead",
      "X-Redirect-Reason": "API consolidation - Phase 3",
    },
  });
}
