import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase.generated";

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

    // 准备插入数据，确保 attachments 是数组格式
    const insertData = {
      user_id: user.id,
      type: validatedData.type,
      category: validatedData.category || null,
      title: validatedData.title,
      description: validatedData.description,
      is_anonymous: validatedData.is_anonymous ?? false,
      context: (validatedData.context || {}) as Json,
      attachments: validatedData.attachments || [],
      priority,
    };

    const { data: feedback, error } = await supabase
      .from("user_feedbacks")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    logger.info(
      { feedbackId: feedback.id, type: validatedData.type, userId: user.id },
      "[UserFeedback] 反馈创建成功",
    );

    return Response.json({ success: true, data: feedback });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails =
      error && typeof error === "object" && "code" in error
        ? { code: error.code, message: errorMessage }
        : { message: errorMessage };

    logger.error(
      {
        error: errorDetails,
        stack: error instanceof Error ? error.stack : undefined,
      },
      "[UserFeedback] 创建失败",
    );

    return Response.json(
      {
        success: false,
        error: "提交失败，请稍后重试",
        details:
          process.env.NODE_ENV === "development" ? errorDetails : undefined,
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
    logger.error({ error }, "[UserFeedback] 查询失败");
    return Response.json(
      {
        success: false,
        error: "查询失败",
      },
      { status: 500 },
    );
  }
}
