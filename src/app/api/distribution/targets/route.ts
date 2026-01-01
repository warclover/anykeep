/**
 * 分发目标列表 API
 *
 * GET /api/distribution/targets - 获取用户的分发目标列表
 * POST /api/distribution/targets - 创建新的分发目标
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  getDistributionTargetsTable,
  type DistributionTargetRow,
  type DistributionTargetInsert,
} from "@/lib/distribution/db-types";

/**
 * 创建目标请求验证 Schema
 */
const createTargetSchema = z.object({
  targetType: z.enum(["obsidian", "manual_export", "notion"]),
  name: z.string().min(1).max(100),
  targetConfig: z.record(z.string(), z.unknown()),
  trigger: z.object({
    mode: z.enum(["manual", "scheduled", "realtime"]),
    intervalMinutes: z.number().min(5).max(1440).optional(),
  }),
});

/**
 * GET - 获取分发目标列表
 */
export async function GET() {
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

    const { data: targets, error } = (await getDistributionTargetsTable(
      supabase,
    )
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })) as {
      data: DistributionTargetRow[] | null;
      error: Error | null;
    };

    if (error) {
      console.error("Query distribution targets error:", error);
      return NextResponse.json(
        { success: false, error: "查询失败" },
        { status: 500 },
      );
    }

    // 转换数据库字段到前端格式
    const formattedTargets = (targets || []).map((target) => ({
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
    }));

    return NextResponse.json({ success: true, targets: formattedTargets });
  } catch (error) {
    console.error("Get distribution targets error:", error);
    return NextResponse.json(
      { success: false, error: "获取分发目标失败" },
      { status: 500 },
    );
  }
}

/**
 * POST - 创建分发目标
 */
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
    const validation = createTargetSchema.safeParse(body);

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

    const { targetType, name, targetConfig, trigger } = validation.data;

    const insertData: DistributionTargetInsert = {
      user_id: user.id,
      target_type: targetType,
      name,
      target_config: targetConfig,
      trigger_mode: trigger.mode,
      schedule_interval_minutes: trigger.intervalMinutes,
      enabled: true,
      status: "idle",
      synced_count: 0,
    };

    const { data: target, error } = (await getDistributionTargetsTable(supabase)
      .insert(insertData)
      .select()
      .single()) as { data: DistributionTargetRow | null; error: Error | null };

    if (error) {
      console.error("Create distribution target error:", error);
      return NextResponse.json(
        { success: false, error: "创建失败" },
        { status: 500 },
      );
    }

    if (!target) {
      return NextResponse.json(
        { success: false, error: "创建失败" },
        { status: 500 },
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
        createdAt: target.created_at,
        updatedAt: target.updated_at,
      },
    });
  } catch (error) {
    console.error("Create distribution target error:", error);
    return NextResponse.json(
      { success: false, error: "创建分发目标失败" },
      { status: 500 },
    );
  }
}
