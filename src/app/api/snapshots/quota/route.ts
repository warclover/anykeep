/**
 * GET /api/snapshots/quota - 获取快照配额信息
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { snapshotService } from "@/lib/snapshot";
import type { SnapshotQuotaResponse } from "@/lib/snapshot";

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 获取配额信息
    const quota = await snapshotService.getUserQuota(userId);

    const response: SnapshotQuotaResponse = {
      success: true,
      data: quota,
    };

    return NextResponse.json(response);
  },
);
