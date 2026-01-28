import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// 使用 Service Role Key 创建 Admin Client 以绕过 RLS
// 注意：实际项目中必须配合严格的权限检查，防止普通用户调用此接口
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

export async function GET(request: Request) {
  // 1. 身份验证 (使用标准 Server Client)
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  // 2. 权限检查 (TODO: 替换为真实的 Admin 检查逻辑)
  // const isAdmin = await checkAdminRole(user.id);
  // if (!isAdmin) return Response.json({ error: "无权限" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("page_size") || "20");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  try {
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

    return Response.json({
      success: true,
      data: {
        feedbacks: data,
        total: count || 0,
        page,
        page_size: pageSize,
      },
    });
  } catch (error) {
    logger.error("[AdminFeedback] 查询失败", { error });
    return Response.json(
      { success: false, error: "查询失败" },
      { status: 500 },
    );
  }
}
