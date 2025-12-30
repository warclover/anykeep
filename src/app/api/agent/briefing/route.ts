/**
 * Proactive Briefing API
 *
 * GET  /api/agent/briefing - 获取主动简报
 * POST /api/agent/briefing - 洞察操作（标记已读、忽略）
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
  handleValidationError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { ProactiveBriefingService } from "@/lib/ai-agent/proactive-briefing";
import type {
  BriefingApiResponse,
  InsightsApiResponse,
  InsightType,
} from "@/lib/ai-agent/proactive-briefing";

// =============================================================================
// 请求验证 Schema
// =============================================================================

/**
 * GET 查询参数 Schema
 */
const GetBriefingQuerySchema = z.object({
  // 可选：只获取洞察列表
  insightsOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // 可选：只获取未读
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // 可选：类型过滤
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined)),
  // 分页
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0)),
});

/**
 * POST 请求体 Schema
 */
const PostBriefingBodySchema = z.discriminatedUnion("action", [
  // 标记洞察为已读
  z.object({
    action: z.literal("markRead"),
    insightId: z.string().min(1),
  }),
  // 批量标记已读
  z.object({
    action: z.literal("markAllRead"),
  }),
  // 忽略洞察
  z.object({
    action: z.literal("dismiss"),
    insightId: z.string().min(1),
  }),
  // 刷新简报（强制重新生成）
  z.object({
    action: z.literal("refresh"),
  }),
]);

type PostBriefingBody = z.infer<typeof PostBriefingBodySchema>;

// =============================================================================
// GET Handler
// =============================================================================

/**
 * GET /api/agent/briefing
 * 获取主动简报或洞察列表
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const parseResult = GetBriefingQuerySchema.safeParse({
      insightsOnly: searchParams.get("insightsOnly"),
      unreadOnly: searchParams.get("unreadOnly"),
      types: searchParams.get("types"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { insightsOnly, unreadOnly, types, limit, offset } = parseResult.data;

    // 3. 创建服务实例
    const briefingService = new ProactiveBriefingService();

    // 4. 根据请求类型返回数据
    if (insightsOnly) {
      // 只获取洞察列表
      const { insights, total } = await briefingService.getInsights(user.id, {
        unreadOnly,
        types: types as InsightType[] | undefined,
        limit,
        offset,
      });

      const response: InsightsApiResponse = {
        insights,
        total,
        hasMore: offset + insights.length < total,
      };

      logger.debug(
        {
          userId: user.id,
          insightCount: insights.length,
          total,
          duration: Date.now() - startTime,
        },
        "GET /api/agent/briefing (insights only)",
      );

      return successResponse(response);
    }

    // 5. 生成完整简报
    const briefing = await briefingService.generateBriefing(user.id);
    const unreadCount = await briefingService.getUnreadInsightCount(user.id);

    const response: BriefingApiResponse = {
      briefing,
      unreadCount,
      generationTimeMs: Date.now() - startTime,
    };

    logger.info(
      {
        userId: user.id,
        hasBriefing: !!briefing,
        unreadCount,
        duration: Date.now() - startTime,
      },
      "GET /api/agent/briefing",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "GET /api/agent/briefing error",
    );
    return internalError("获取简报失败");
  }
}

// =============================================================================
// POST Handler
// =============================================================================

/**
 * POST /api/agent/briefing
 * 洞察操作（标记已读、忽略等）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequestError("请求体格式错误");
    }

    // 3. 验证请求体
    const parseResult = PostBriefingBodySchema.safeParse(body);

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const data: PostBriefingBody = parseResult.data;

    // 4. 创建服务实例
    const briefingService = new ProactiveBriefingService();

    // 5. 执行操作
    switch (data.action) {
      case "markRead": {
        await briefingService.markInsightAsRead(user.id, data.insightId);
        logger.debug(
          { userId: user.id, insightId: data.insightId },
          "Insight marked as read",
        );
        return successResponse({ success: true });
      }

      case "markAllRead": {
        // 批量标记已读
        const { insights } = await briefingService.getInsights(user.id, {
          unreadOnly: true,
          limit: 100,
        });

        await Promise.all(
          insights.map((insight) =>
            briefingService.markInsightAsRead(user.id, insight.id),
          ),
        );

        logger.debug(
          { userId: user.id, count: insights.length },
          "All insights marked as read",
        );
        return successResponse({ success: true, count: insights.length });
      }

      case "dismiss": {
        await briefingService.dismissInsight(user.id, data.insightId);
        logger.debug(
          { userId: user.id, insightId: data.insightId },
          "Insight dismissed",
        );
        return successResponse({ success: true });
      }

      case "refresh": {
        // 强制刷新简报（重新生成）
        const briefing = await briefingService.generateBriefing(user.id);
        const unreadCount = await briefingService.getUnreadInsightCount(
          user.id,
        );

        const response: BriefingApiResponse = {
          briefing,
          unreadCount,
        };

        logger.info(
          { userId: user.id, hasBriefing: !!briefing },
          "Briefing refreshed",
        );
        return successResponse(response);
      }

      default:
        return badRequestError("未知操作类型");
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "POST /api/agent/briefing error",
    );
    return internalError("操作失败");
  }
}
