import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const createFeedbackSchema = z.object({
  type: z.enum(["bug", "complaint", "suggestion"]),
  category: z.string().optional(),
  title: z.string().min(1).max(100),
  description: z.string().min(10).max(2000),
  is_anonymous: z.boolean().optional().default(false),
  context: z.record(z.unknown()).optional(), // 允许任意 JSON 对象
  attachments: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  // 认证检查
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = createFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "参数无效",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { data: validatedData } = validation;

    // 自动设置优先级
    const priority = validatedData.type === "bug" ? "high" : "normal";

    const { data: feedback, error } = await supabase
      .from("user_feedbacks")
      .insert({
        user_id: user.id,
        ...validatedData,
        priority,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info("[UserFeedback] 反馈创建成功", {
      feedbackId: feedback.id,
      type: validatedData.type,
      userId: user.id,
    });

    return Response.json({ success: true, data: feedback });
  } catch (error) {
    logger.error("[UserFeedback] 创建失败", { error });
    return Response.json(
      {
        success: false,
        error: "提交失败，请稍后重试",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("page_size") || "10");
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  try {
    let query = supabase
      .from("user_feedbacks")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);

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
    logger.error("[UserFeedback] 查询失败", { error });
    return Response.json(
      {
        success: false,
        error: "查询失败",
      },
      { status: 500 },
    );
  }
}
