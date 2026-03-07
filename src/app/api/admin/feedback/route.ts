import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isAdminUser } from "@/lib/auth/admin-check";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";

export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId, user }) => {
    // 权限检查 - 验证是否为管理员
    if (!user?.email) {
      return forbiddenError("无权限访问");
    }
    if (!isAdminUser(user.email)) {
      logger.warn(
        { userId, email: user.email },
        "[AdminFeedback] 非管理员访问尝试",
      );
      return forbiddenError("无权限访问");
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("user_feedbacks")
      .select("*, profiles(nickname, phone)", { count: "exact" }) // 关联查询用户信息(如果有 profiles 表)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        feedbacks: data,
        total: count || 0,
        page,
        page_size: pageSize,
      },
    });
  },
);
