/**
 * 分发同步 API
 *
 * POST /api/distribution/sync - 手动触发同步
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DistributionRegistry, DistributionService } from "@/lib/distribution";
import {
  ObsidianAdapter,
  ManualExportAdapter,
  NotionAdapter,
  WebhookAdapter,
  RssFeedAdapter,
} from "@/lib/distribution/adapters";
import {
  getDistributionTargetsTable,
  type DistributionTargetRow,
} from "@/lib/distribution/db-types";
import type { IDistributionAdapter } from "@/lib/distribution/interfaces";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { targetId } = body;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "缺少 targetId 参数" },
        { status: 400 },
      );
    }

    // 验证目标归属
    const { data: target, error: targetError } =
      (await getDistributionTargetsTable(supabase)
        .select("*")
        .eq("id", targetId)
        .eq("user_id", user.id)
        .single()) as {
        data: DistributionTargetRow | null;
        error: Error | null;
      };

    if (targetError || !target) {
      return NextResponse.json(
        { success: false, error: "目标不存在" },
        { status: 404 },
      );
    }

    if (!target.enabled) {
      return NextResponse.json(
        { success: false, error: "目标已禁用" },
        { status: 400 },
      );
    }

    // 更新状态为同步中
    await getDistributionTargetsTable(supabase)
      .update({ status: "syncing" })
      .eq("id", targetId);

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

    // 获取待同步的书签
    const bookmarks = await service.getUnsyncedBookmarks(
      targetId,
      user.id,
      target.last_sync_at ? new Date(target.last_sync_at) : undefined,
    );

    if (bookmarks.length === 0) {
      // 无新内容，更新状态
      await getDistributionTargetsTable(supabase)
        .update({
          status: "idle",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", targetId);

      return NextResponse.json({
        success: true,
        distributedCount: 0,
        message: "没有新内容需要同步",
      });
    }

    // 执行分发
    const result = await service.distribute(
      targetId,
      bookmarks.map((b) => b.id),
    );

    // 更新状态
    await getDistributionTargetsTable(supabase)
      .update({
        status: result.success ? "idle" : "error",
        synced_count: (target.synced_count || 0) + result.distributedCount,
        last_sync_at: new Date().toISOString(),
        last_error: result.success ? null : result.errors?.[0]?.message,
      })
      .eq("id", targetId);

    return NextResponse.json({
      success: result.success,
      distributedCount: result.distributedCount,
      failedCount: result.failedCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "同步失败",
      },
      { status: 500 },
    );
  }
}
