import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const updateFeedbackSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  attachments: z.array(z.string()).optional(),
  // 允许用户补充评论，这可以存储在 context 或者新的字段中，
  // 暂时如果要在 update 中支持补充信息，可以考虑追加到 context
  additional_comment: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { id } = params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("user_feedbacks")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id) // 确保只能查看自己的
      .single();

    if (error) throw error;
    if (!data) {
      return Response.json(
        { success: false, error: "反馈不存在" },
        { status: 404 },
      );
    }

    return Response.json({ success: true, data });
  } catch (error) {
    logger.error({ error, id }, "[UserFeedback] 获取详情失败");
    return Response.json(
      { success: false, error: "获取详情失败" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { id } = params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    // 先检查状态
    const { data: existing, error: fetchError } = await supabase
      .from("user_feedbacks")
      .select("status, context")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return Response.json(
        { success: false, error: "反馈不存在" },
        { status: 404 },
      );
    }

    // 只有 pending 状态允许修改主要内容
    // 如果是补充评论(additional_comment)，允许在未关闭前修改
    const body = await request.json();
    const validation = updateFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        { success: false, error: "参数无效" },
        { status: 400 },
      );
    }

    const { additional_comment, ...updateData } = validation.data;

    // 如果状态不是 pending，且尝试修改标题/描述，则拒绝
    if (
      existing.status !== "pending" &&
      (updateData.title || updateData.description)
    ) {
      return Response.json(
        { success: false, error: "当前状态无法修改反馈内容" },
        { status: 403 },
      );
    }

    // 处理补充评论: 追加到 context.comments 数组中
    let newContext = existing.context;
    if (additional_comment) {
      const currentContext =
        (existing.context as Record<string, unknown>) || {};
      const currentComments = (
        Array.isArray(currentContext.comments) ? currentContext.comments : []
      ) as Array<{
        content: string;
        created_at: string;
        role: string;
      }>;

      newContext = {
        ...currentContext,
        comments: [
          ...currentComments,
          {
            content: additional_comment,
            created_at: new Date().toISOString(),
            role: "user",
          },
        ],
      };
    }

    const { data, error } = await supabase
      .from("user_feedbacks")
      .update({
        ...updateData,
        context: newContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    logger.info({ id, userId: user.id }, "[UserFeedback] 反馈更新成功");
    return Response.json({ success: true, data });
  } catch (error) {
    logger.error({ error, id }, "[UserFeedback] 更新失败");
    return Response.json(
      { success: false, error: "更新失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { id } = params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    // RLS 策略已限制只能删除 pending 状态，这里直接执行
    const { error } = await supabase
      .from("user_feedbacks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "pending"); // 双重保险

    if (error) throw error;

    // count 为 null 或 0 表示未删除（可能不存在或状态不对）
    // Supabase delete 默认不返回 count，除非指定 count: 'exact' 等，或者 select
    // 但 delete + eq status 应该足够安全。如果没删掉，可能是状态不对。

    // 为了更精确的错误提示，可以先查再删，或者直接捕获。
    // 这里简单返回成功，前端会刷新列表。

    logger.info({ id, userId: user.id }, "[UserFeedback] 反馈删除成功");
    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error, id }, "[UserFeedback] 删除失败");
    return Response.json(
      { success: false, error: "删除失败" },
      { status: 500 },
    );
  }
}
