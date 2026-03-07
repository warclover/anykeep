import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
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

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const body = await request.json();
    const validation = createFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
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
      user_id: userId,
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
      { feedbackId: feedback.id, type: validatedData.type, userId },
      "[UserFeedback] 反馈创建成功",
    );

    return NextResponse.json({ success: true, data: feedback });
  },
);

export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "10");
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    let query = supabase
      .from("user_feedbacks")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);

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
