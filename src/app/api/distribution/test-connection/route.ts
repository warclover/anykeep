/**
 * 分发目标测试连接 API
 *
 * POST /api/distribution/test-connection
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { DistributionRegistry, DistributionService } from "@/lib/distribution";
import {
  ObsidianAdapter,
  ManualExportAdapter,
  NotionAdapter,
  WebhookAdapter,
  RssFeedAdapter,
} from "@/lib/distribution/adapters";
import type { IDistributionAdapter } from "@/lib/distribution/interfaces";

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId: _userId }) => {
    const supabase = await createClient();

    const body = await request.json();
    const { targetType, targetConfig } = body;

    if (!targetType || !targetConfig) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数" },
        { status: 400 },
      );
    }

    // 创建注册表并注册适配器
    const registry = new DistributionRegistry();
    registry.register(new ObsidianAdapter() as unknown as IDistributionAdapter);
    registry.register(
      new ManualExportAdapter() as unknown as IDistributionAdapter,
    );
    registry.register(new NotionAdapter() as unknown as IDistributionAdapter);
    registry.register(new WebhookAdapter() as unknown as IDistributionAdapter);
    registry.register(new RssFeedAdapter() as unknown as IDistributionAdapter);

    // 创建服务
    const service = new DistributionService(registry, supabase);

    // 测试连接
    const result = await service.testConnection(targetType, targetConfig);

    return NextResponse.json(result);
  },
);
