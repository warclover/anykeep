/**
 * V5.5 配额查询 API
 *
 * GET /api/folders/quota
 * 返回用户的统一配额状态
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { UnifiedQuotaService } from "@/lib/folder-quota";

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 使用 UnifiedQuotaService 实例方法
    const quotaService = new UnifiedQuotaService(supabase);
    const quota = await quotaService.checkQuota(userId);

    return NextResponse.json({
      allowed: quota.allowed,
      daily: {
        used: quota.daily.used,
        limit: quota.daily.limit,
        remaining: quota.daily.remaining,
      },
      total: {
        used: quota.total.aiCreated,
        limit: quota.total.limit,
        remaining: quota.total.remaining,
      },
      health: {
        passed: quota.health.passed,
        emptyFolders: quota.health.emptyFolders,
        reason: quota.health.reason,
      },
    });
  },
);
