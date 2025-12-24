/**
 * DEV API: Debug Snapshots
 * 开发环境专用 - 查看所有快照记录状态
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 禁用 Next.js 缓存
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Only available in development
const isDev = process.env.NODE_ENV === "development";

export async function GET() {
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 },
    );
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 },
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 获取所有快照记录
    const { data: snapshots, error } = await supabase
      .from("bookmark_snapshots")
      .select(
        "id, bookmark_id, status, snapshot_type, readable_title, readable_word_count, created_at, captured_at, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: `Query failed: ${error.message}` },
        { status: 500 },
      );
    }

    // 获取待处理的任务
    const { data: pendingJobs, error: jobError } = await supabase
      .from("job_queue")
      .select("id, type, status, payload, created_at")
      .in("type", [
        "create_snapshot_basic",
        "create_snapshot_standard",
        "create_snapshot_full",
      ])
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      snapshots: snapshots || [],
      pendingJobs: pendingJobs || [],
      jobError: jobError?.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 },
    );
  }
}
