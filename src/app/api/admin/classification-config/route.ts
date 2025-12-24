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
import { getConfigCenter } from "@/lib/classification/services/advanced";
import { logger } from "@/lib/logger";

/**
 * 检查用户是否为管理员
 * 通过环境变量 ADMIN_EMAILS 配置，逗号分隔
 */
function isAdminUser(email: string | undefined): boolean {
  if (!email) return false;
  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) ||
    [];
  // 开发环境默认允许所有用户访问（便于调试）
  if (process.env.NODE_ENV === "development" && adminEmails.length === 0) {
    return true;
  }
  return adminEmails.includes(email.toLowerCase());
}

/**
 * GET - 获取配置
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 验证管理员权限
    if (!isAdminUser(user.email)) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

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
  } catch (error) {
    logger.error({ error }, "Classification config API error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST - 管理操作
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 验证管理员权限
    if (!isAdminUser(user.email)) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { action } = body;

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
  } catch (error) {
    logger.error({ error }, "Classification config API error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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
