/**
 * V5.5 配额查询 API
 *
 * GET /api/folders/quota
 * 返回用户的统一配额状态
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UnifiedQuotaService } from "@/lib/classification/strategies/modern/crystal/quota";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 使用 UnifiedQuotaService 实例方法
    const quotaService = new UnifiedQuotaService(supabase);
    const quota = await quotaService.checkQuota(user.id);

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
  } catch (error) {
    logger.error({ error }, "V5.5: Quota API error");

    return NextResponse.json(
      { error: "Failed to fetch quota" },
      { status: 500 },
    );
  }
}
