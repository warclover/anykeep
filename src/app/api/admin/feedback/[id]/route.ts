import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isAdminUser } from "@/lib/auth/admin-check";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";

export const PATCH = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, user, params }) => {
    const { id } = await params;

    // 权限检查 - 验证是否为管理员
    if (!user?.email) {
      return forbiddenError("无权限访问");
    }
    if (!isAdminUser(user.email)) {
      logger.warn(
        { userId, email: user.email, feedbackId: id },
        "[AdminFeedback] 非管理员更新尝试",
      );
      return forbiddenError("无权限访问");
    }

    const body = await request.json();
    const { status, resolution, admin_notes, priority } = body;

    const updates: {
      updated_at: string;
      status?: string;
      resolution?: string;
      admin_notes?: string;
      priority?: string;
      resolved_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (status) updates.status = status;
    if (resolution !== undefined) updates.resolution = resolution;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;
    if (priority) updates.priority = priority;

    // 自动设置解决时间
    if (status === "resolved" || status === "closed" || status === "rejected") {
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await getSupabaseAdmin()
      .from("user_feedbacks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.info({ id, adminId: userId, updates }, "[AdminFeedback] 更新成功");

    return NextResponse.json({ success: true, data });
  },
);

export const GET = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, user, params }) => {
    const { id } = await params;

    // 权限检查 - 验证是否为管理员
    if (!user?.email) {
      return forbiddenError("无权限访问");
    }
    if (!isAdminUser(user.email)) {
      logger.warn(
        { userId, email: user.email, feedbackId: id },
        "[AdminFeedback] 非管理员查看尝试",
      );
      return forbiddenError("无权限访问");
    }

    // 获取详情，包含用户信息
    // 注意：Supabase JS 客户端联表查询需要外键存在。user_id 是外键指向 auth.users，但 auth schema 通常不可访问。
    // 如果有 profiles 表关联 user_id，可以查 profiles。
    const { data, error } = await getSupabaseAdmin()
      .from("user_feedbacks")
      .select("*, profiles(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { success: false, error: "未找到" },
        { status: 404 },
      );

    return NextResponse.json({ success: true, data });
  },
);
