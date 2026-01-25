/**
 * 智能分类 v5.0 - 单个规则操作 API (已废弃)
 *
 * GET    /api/classification/v5/rules/[id]
 * PUT    /api/classification/v5/rules/[id]
 * DELETE /api/classification/v5/rules/[id]
 *
 * @deprecated 使用 /api/classification/v2/rules/[id] 代替
 * @since 2026-01-24 Phase 3 - 308 永久重定向
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/classification/v5/rules/[id]
 * 308 永久重定向到 /api/classification/v2/rules/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const newUrl = new URL(`/api/classification/v2/rules/${id}`, request.url);

  return NextResponse.redirect(newUrl, {
    status: 308,
    headers: {
      "X-Deprecation-Notice": "Use /api/classification/v2/rules/[id] instead",
      "X-Redirect-Reason": "API consolidation - Phase 3",
    },
  });
}

/**
 * PUT /api/classification/v5/rules/[id]
 * 308 永久重定向到 /api/classification/v2/rules/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const newUrl = new URL(`/api/classification/v2/rules/${id}`, request.url);

  return NextResponse.redirect(newUrl, {
    status: 308,
    headers: {
      "X-Deprecation-Notice": "Use /api/classification/v2/rules/[id] instead",
      "X-Redirect-Reason": "API consolidation - Phase 3",
    },
  });
}

/**
 * DELETE /api/classification/v5/rules/[id]
 * 308 永久重定向到 /api/classification/v2/rules/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const newUrl = new URL(`/api/classification/v2/rules/${id}`, request.url);

  return NextResponse.redirect(newUrl, {
    status: 308,
    headers: {
      "X-Deprecation-Notice": "Use /api/classification/v2/rules/[id] instead",
      "X-Redirect-Reason": "API consolidation - Phase 3",
    },
  });
}
