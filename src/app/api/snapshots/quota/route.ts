/**
 * GET /api/snapshots/quota - 获取快照配额信息
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { snapshotService } from "@/lib/snapshot";
import type { SnapshotQuotaResponse } from "@/lib/snapshot";

export async function GET(_request: NextRequest) {
  try {
    // 1. 验证用户认证（使用缓存认证，性能优化）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        },
        { status: 401 },
      );
    }

    // 2. 获取配额信息
    const quota = await snapshotService.getUserQuota(user.id);

    const response: SnapshotQuotaResponse = {
      success: true,
      data: quota,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "获取配额失败" },
      },
      { status: 500 },
    );
  }
}
