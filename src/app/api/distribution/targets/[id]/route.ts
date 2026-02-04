/**
 * 分发目标详情 API
 *
 * GET /api/distribution/targets/[id] - 获取单个分发目标
 * PATCH /api/distribution/targets/[id] - 更新分发目标
 * DELETE /api/distribution/targets/[id] - 删除分发目标
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  getDistributionTargetsTable,
  type DistributionTargetRow,
  type DistributionTargetUpdate,
} from "@/lib/distribution/db-types";
import { logger } from "@/lib/logger";

/**
 * 更新目标请求验证 Schema
 */
const updateTargetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetConfig: z.record(z.string(), z.unknown()).optional(),
  trigger: z
    .object({
      mode: z.enum(["manual", "scheduled", "realtime"]),
      intervalMinutes: z.number().min(5).max(1440).optional(),
    })
    .optional(),
  enabled: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET - 获取单个分发目标
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const { data: target, error } = (await getDistributionTargetsTable(supabase)
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()) as { data: DistributionTargetRow | null; error: Error | null };

    if (error || !target) {
      return NextResponse.json(
        { success: false, error: "目标不存在" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      target: {
        id: target.id,
        userId: target.user_id,
        targetType: target.target_type,
        name: target.name,
        enabled: target.enabled,
        trigger: {
          mode: target.trigger_mode,
          scheduleIntervalMinutes: target.schedule_interval_minutes,
        },
        targetConfig: target.target_config,
        status: target.status,
        syncedCount: target.synced_count,
        lastSyncAt: target.last_sync_at,
        lastError: target.last_error,
        createdAt: target.created_at,
        updatedAt: target.updated_at,
      },
    });
  } catch (error) {
    logger.error({ error }, "Get distribution target error:");
    return NextResponse.json(
      { success: false, error: "获取分发目标失败" },
      { status: 500 },
    );
  }
}

/**
 * PATCH - 更新分发目标
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
    const validation = updateTargetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "参数验证失败",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    // 构建更新数据
    const updateData: DistributionTargetUpdate = {};
    if (validation.data.name) updateData.name = validation.data.name;
    if (validation.data.targetConfig)
      updateData.target_config = validation.data.targetConfig;
    if (validation.data.trigger) {
      updateData.trigger_mode = validation.data.trigger.mode;
      updateData.schedule_interval_minutes =
        validation.data.trigger.intervalMinutes;
    }
    if (validation.data.enabled !== undefined)
      updateData.enabled = validation.data.enabled;
    updateData.updated_at = new Date().toISOString();

    const { data: target, error } = (await getDistributionTargetsTable(supabase)
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()) as { data: DistributionTargetRow | null; error: Error | null };

    if (error) {
      logger.error({ error }, "Update distribution target error:");
      return NextResponse.json(
        { success: false, error: "更新失败" },
        { status: 500 },
      );
    }

    if (!target) {
      return NextResponse.json(
        { success: false, error: "目标不存在" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      target: {
        id: target.id,
        userId: target.user_id,
        targetType: target.target_type,
        name: target.name,
        enabled: target.enabled,
        trigger: {
          mode: target.trigger_mode,
          scheduleIntervalMinutes: target.schedule_interval_minutes,
        },
        targetConfig: target.target_config,
        status: target.status,
        syncedCount: target.synced_count,
        lastSyncAt: target.last_sync_at,
        createdAt: target.created_at,
        updatedAt: target.updated_at,
      },
    });
  } catch (error) {
    logger.error({ error }, "Update distribution target error:");
    return NextResponse.json(
      { success: false, error: "更新分发目标失败" },
      { status: 500 },
    );
  }
}

/**
 * DELETE - 删除分发目标
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const { error } = (await getDistributionTargetsTable(supabase)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)) as { error: Error | null };

    if (error) {
      logger.error({ error }, "Delete distribution target error:");
      return NextResponse.json(
        { success: false, error: "删除失败" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Delete distribution target error:");
    return NextResponse.json(
      { success: false, error: "删除分发目标失败" },
      { status: 500 },
    );
  }
}
