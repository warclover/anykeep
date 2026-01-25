/**
 * 智能分类 v5.0 - 规则管理 API (已废弃)
 *
 * GET  /api/classification/v5/rules
 * POST /api/classification/v5/rules
 *
 * @deprecated 使用 /api/classification/v2/rules 代替
 * @since 2026-01-24 Phase 3 - 308 永久重定向
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * GET /api/classification/v5/rules
 * 308 永久重定向到 /api/classification/v2/rules
 */
export async function GET(request: NextRequest) {
  const newUrl = new URL("/api/classification/v2/rules", request.url);
  // 保留查询参数
  newUrl.search = request.nextUrl.search;

  return NextResponse.redirect(newUrl, {
    status: 308,
    headers: {
      "X-Deprecation-Notice": "Use /api/classification/v2/rules instead",
      "X-Redirect-Reason": "API consolidation - Phase 3",
    },
  });
}

/**
 * POST /api/classification/v5/rules
 * 308 永久重定向到 /api/classification/v2/rules
 */
export async function POST(request: NextRequest) {
  const newUrl = new URL("/api/classification/v2/rules", request.url);

  return NextResponse.redirect(newUrl, {
    status: 308,
    headers: {
      "X-Deprecation-Notice": "Use /api/classification/v2/rules instead",
      "X-Redirect-Reason": "API consolidation - Phase 3",
    },
  });
}
