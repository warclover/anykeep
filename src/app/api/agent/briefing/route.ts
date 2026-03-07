/**
 * Proactive Briefing API
 *
 * GET  /api/agent/briefing - 获取主动简报
 * POST /api/agent/briefing - 洞察操作（标记已读、忽略）
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import { z } from "zod";
import {
  successResponse,
  badRequestError,
  handleValidationError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { ProactiveBriefingService } from "@/lib/ai-agent/proactive-briefing";
import type {
  BriefingApiResponse,
  InsightsApiResponse,
  InsightType,
} from "@/lib/ai-agent/proactive-briefing";
import { withAuthMiddleware } from "@/lib/api/middleware";

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
    .nullish()
    .transform((v) => v === "true"),
  // 可选：只获取未读
  unreadOnly: z
    .string()
    .nullish()
    .transform((v) => v === "true"),
  // 可选：类型过滤
  types: z
    .string()
    .nullish()
    .transform((v) => (v ? v.split(",") : undefined)),
  // 分页
  limit: z
    .string()
    .nullish()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
  offset: z
    .string()
    .nullish()
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
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 1. 解析查询参数
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

  // 2. 创建服务实例
  const briefingService = new ProactiveBriefingService();

  // 3. 根据请求类型返回数据
  if (insightsOnly) {
    // 只获取洞察列表
    const { insights, total } = await briefingService.getInsights(userId, {
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
        userId,
        insightCount: insights.length,
        total,
        duration: Date.now() - startTime,
      },
      "GET /api/agent/briefing (insights only)",
    );

    return successResponse(response);
  }

  // 4. 生成完整简报
  const briefing = await briefingService.generateBriefing(userId);
  const unreadCount = await briefingService.getUnreadInsightCount(userId);

  const response: BriefingApiResponse = {
    briefing,
    unreadCount,
    generationTimeMs: Date.now() - startTime,
  };

  logger.info(
    {
      userId,
      hasBriefing: !!briefing,
      unreadCount,
      duration: Date.now() - startTime,
    },
    "GET /api/agent/briefing",
  );

  return successResponse(response);
});

// =============================================================================
// POST Handler
// =============================================================================

/**
 * POST /api/agent/briefing
 * 洞察操作（标记已读、忽略等）
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析请求体
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequestError("请求体格式错误");
  }

  // 2. 验证请求体
  const parseResult = PostBriefingBodySchema.safeParse(body);

  if (!parseResult.success) {
    return handleValidationError(parseResult.error);
  }

  const data: PostBriefingBody = parseResult.data;

  // 3. 创建服务实例
  const briefingService = new ProactiveBriefingService();

  // 4. 执行操作
  switch (data.action) {
    case "markRead": {
      await briefingService.markInsightAsRead(userId, data.insightId);
      logger.debug(
        { userId, insightId: data.insightId },
        "Insight marked as read",
      );
      return successResponse({ success: true });
    }

    case "markAllRead": {
      // 批量标记已读
      const { insights } = await briefingService.getInsights(userId, {
        unreadOnly: true,
        limit: 100,
      });

      await Promise.all(
        insights.map((insight) =>
          briefingService.markInsightAsRead(userId, insight.id),
        ),
      );

      logger.debug(
        { userId, count: insights.length },
        "All insights marked as read",
      );
      return successResponse({ success: true, count: insights.length });
    }

    case "dismiss": {
      await briefingService.dismissInsight(userId, data.insightId);
      logger.debug({ userId, insightId: data.insightId }, "Insight dismissed");
      return successResponse({ success: true });
    }

    case "refresh": {
      // 强制刷新简报（重新生成）
      const briefing = await briefingService.generateBriefing(userId);
      const unreadCount = await briefingService.getUnreadInsightCount(userId);

      const response: BriefingApiResponse = {
        briefing,
        unreadCount,
      };

      logger.info({ userId, hasBriefing: !!briefing }, "Briefing refreshed");
      return successResponse(response);
    }

    default:
      return badRequestError("未知操作类型");
  }
});
