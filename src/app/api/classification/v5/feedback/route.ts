/**
 * 智能分类 v5.0 - 反馈 API 端点
 * POST /api/classification/v5/feedback
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FeedbackService } from "@/lib/classification/strategies/modern/feedback";
import { LLMService } from "@/lib/classification/infrastructure/shared-services/llm";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import type { ClassificationFeedback } from "@/lib/classification/strategies/modern/feedback";

/**
 * 反馈请求体
 */
interface FeedbackRequest {
  bookmarkId: number;
  suggestedFolderId: number | null;
  suggestedFolderName: string | null;
  actualFolderId: number;
  actualFolderName: string;
  feedbackType: "accept" | "reject" | "modify";
  userComment?: string;
  confidence?: number;
}

/**
 * POST /api/classification/v5/feedback
 * 处理用户对分类结果的反馈
 */
export async function POST(request: NextRequest) {
  const logger = createLogger("FeedbackAPI");

  try {
    // 1. 解析请求体
    const body = (await request.json()) as FeedbackRequest;

    // 2. 验证必需字段
    if (!body.bookmarkId || !body.actualFolderId || !body.feedbackType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: bookmarkId, actualFolderId, feedbackType",
        },
        { status: 400 },
      );
    }

    // 3. 验证反馈类型
    if (!["accept", "reject", "modify"].includes(body.feedbackType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid feedbackType. Must be: accept, reject, or modify",
        },
        { status: 400 },
      );
    }

    // 4. 创建 Supabase 客户端
    const supabase = await createClient();

    // 5. 验证用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // 6. 验证书签所有权
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, user_id")
      .eq("id", body.bookmarkId)
      .eq("user_id", user.id)
      .single();

    if (bookmarkError || !bookmark) {
      return NextResponse.json(
        {
          success: false,
          error: "Bookmark not found or access denied",
        },
        { status: 404 },
      );
    }

    // 7. 构建反馈对象
    const feedback: ClassificationFeedback = {
      bookmarkId: body.bookmarkId,
      suggestedFolderId: body.suggestedFolderId,
      suggestedFolderName: body.suggestedFolderName,
      actualFolderId: body.actualFolderId,
      actualFolderName: body.actualFolderName,
      feedbackType: body.feedbackType,
      userComment: body.userComment,
      confidence: body.confidence,
    };

    // 8. 处理反馈
    const llmService = new LLMService(logger);
    const feedbackService = new FeedbackService(supabase, logger, llmService);
    const result = await feedbackService.processFeedback(feedback);

    // 9. 返回结果
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          profileUpdated: result.profileUpdated,
          ruleExtracted: result.ruleExtracted,
          logRecorded: result.logRecorded,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to process feedback",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    logger.error(
      "Feedback API error",
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
