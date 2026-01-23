/**
 * V5.5 配额查询 API
 *
 * GET /api/folders/quota
 * 返回用户的统一配额状态
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { UnifiedQuotaService } from "@/lib/classification/v5.5/quota";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quotaService = new UnifiedQuotaService(supabase);
    const result = await quotaService.checkQuota(user.id);

    return NextResponse.json({
      allowed: result.allowed,
      daily: result.daily,
      total: result.total,
      health: result.health,
    });
  } catch (error) {
    logger.error({ error }, "V5.5: Quota API error");

    return NextResponse.json(
      { error: "Failed to fetch quota" },
      { status: 500 },
    );
  }
}
