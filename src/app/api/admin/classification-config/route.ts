/**
 * V4.0 分类配置管理 API
 *
 * GET /api/admin/classification-config - 获取当前配置
 * GET /api/admin/classification-config?type=categories - 获取通用分类列表
 * GET /api/admin/classification-config?type=strategy - 获取策略配置
 * GET /api/admin/classification-config?type=stats - 获取缓存统计
 * POST /api/admin/classification-config/refresh - 强制刷新缓存
 *
 * 注意：这是一个开发者工具 API，仅供内部使用
 * 安全：需要管理员权限（通过 ADMIN_EMAILS 环境变量配置）
 */

import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConfigCenter } from "@/lib/classification-config";
import { z } from "zod";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";
import { isAdminUser } from "@/lib/auth/admin-check";

const configActionSchema = z.object({
  action: z.enum(["refresh", "clear_cache"]),
});

/**
 * GET - 获取配置
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { user }) => {
    // 验证管理员权限
    if (!user?.email) {
      return forbiddenError("Forbidden - Admin access required");
    }
    if (!isAdminUser(user.email)) {
      return forbiddenError("Forbidden - Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    const supabase = await createClient();
    const configCenter = getConfigCenter(supabase);

    switch (type) {
      case "categories": {
        const categories = await configCenter.getCategories();
        return NextResponse.json({
          success: true,
          data: categories,
          count: categories.length,
        });
      }

      case "strategy": {
        const configKey = searchParams.get("key") || "default";
        const strategy = await configCenter.getStrategyConfig(configKey);
        return NextResponse.json({
          success: true,
          data: strategy,
          configKey,
        });
      }

      case "thresholds": {
        const thresholds = await configCenter.getThresholds();
        return NextResponse.json({
          success: true,
          data: thresholds,
        });
      }

      case "features": {
        const features = await configCenter.getFeatureFlags();
        return NextResponse.json({
          success: true,
          data: features,
        });
      }

      case "stats": {
        const stats = configCenter.getStats();
        return NextResponse.json({
          success: true,
          data: stats,
        });
      }

      case "all":
      default: {
        const [categories, strategy, stats] = await Promise.all([
          configCenter.getCategories(),
          configCenter.getStrategyConfig(),
          Promise.resolve(configCenter.getStats()),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            categories: {
              count: categories.length,
              groups: groupCategoriesByGroup(categories),
            },
            strategy: {
              version: strategy.version,
              thresholds: strategy.thresholds,
              featureFlags: strategy.featureFlags,
            },
            cache: stats,
          },
        });
      }
    }
  },
);

/**
 * POST - 管理操作
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { user }) => {
    // 验证管理员权限
    if (!user?.email) {
      return forbiddenError("Forbidden - Admin access required");
    }
    if (!isAdminUser(user.email)) {
      return forbiddenError("Forbidden - Admin access required");
    }

    const body = await request.json();
    const parseResult = configActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parseResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { action } = parseResult.data;

    const supabase = await createClient();
    const configCenter = getConfigCenter(supabase);

    switch (action) {
      case "refresh": {
        await configCenter.forceRefreshAll();
        return NextResponse.json({
          success: true,
          message: "Cache refreshed successfully",
          stats: configCenter.getStats(),
        });
      }

      case "clear_cache": {
        configCenter.clearCache();
        return NextResponse.json({
          success: true,
          message: "Cache cleared successfully",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  },
);

/**
 * 辅助函数：按组分类
 */
function groupCategoriesByGroup(
  categories: Array<{ id: string; name: string; group: string }>,
): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const cat of categories) {
    groups[cat.group] = (groups[cat.group] || 0) + 1;
  }
  return groups;
}
