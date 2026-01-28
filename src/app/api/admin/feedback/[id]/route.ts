import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  // TODO: Admin permission check

  try {
    const body = await request.json();
    const { status, resolution, admin_notes, priority } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
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

    const { data, error } = await supabaseAdmin
      .from("user_feedbacks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.info("[AdminFeedback] 更新成功", { id, adminId: user.id, updates });

    return Response.json({ success: true, data });
  } catch (error) {
    logger.error("[AdminFeedback] 更新失败", { error, id });
    return Response.json(
      { success: false, error: "更新失败" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    // 获取详情，包含用户信息
    // 注意：Supabase JS 客户端联表查询需要外键存在。user_id 是外键指向 auth.users，但 auth schema 通常不可访问。
    // 如果有 profiles 表关联 user_id，可以查 profiles。
    const { data, error } = await supabaseAdmin
      .from("user_feedbacks")
      .select("*, profiles(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data)
      return Response.json(
        { success: false, error: "未找到" },
        { status: 404 },
      );

    return Response.json({ success: true, data });
  } catch (error) {
    logger.error("[AdminFeedback] 获取详情失败", { error, id });
    return Response.json(
      { success: false, error: "获取详情失败" },
      { status: 500 },
    );
  }
}
