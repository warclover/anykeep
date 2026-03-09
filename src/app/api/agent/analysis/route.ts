/**
 * Async Analysis API
 *
 * POST /api/agent/analysis - 手动触发异步分析
 * GET  /api/agent/analysis - 获取分析任务状态
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

import { z } from "zod";
import {
  successResponse,
  handleValidationError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  createAsyncAnalysisService,
  createAsyncAnalysisBriefingIntegration,
} from "@/lib/ai-agent/async-analysis";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 支持的分析类型
// =============================================================================

/**
 * 目前 triggerAnalysis 支持的分析类型
 */
const SUPPORTED_ANALYSIS_TYPES = [
  "topic_clustering",
  "pattern_detection",
] as const;

// =============================================================================
// 请求验证 Schema
// =============================================================================

/**
 * POST 请求体 Schema - 触发分析
 */
const TriggerAnalysisSchema = z.object({
  /** 分析类型列表（可选，默认全部） */
  types: z.array(z.enum(SUPPORTED_ANALYSIS_TYPES)).optional(),
  /** 优先级 */
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

/**
 * GET 查询参数 Schema
 */
const GetStatusQuerySchema = z.object({
  /** 只获取特定类型的任务 */
  type: z.enum(SUPPORTED_ANALYSIS_TYPES).optional(),
  /** 限制返回的结果数量 */
  limit: z
    .string()
    .nullish()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
});

// =============================================================================
// Response Types
// =============================================================================

interface TriggerAnalysisResponse {
  /** 创建的任务 ID 列表 */
  taskIds: string[];
  /** 消息 */
  message: string;
}

interface AnalysisStatusResponse {
  /** 待处理任务数 */
  pendingCount: number;
  /** 运行中任务数 */
  runningCount: number;
  /** 已完成任务数 */
  completedCount: number;
  /** 失败任务数 */
  failedCount: number;
  /** 按类型统计 */
  byType: Record<string, number>;
  /** 最近的分析洞察 */
  recentInsights: Array<{
    id: string;
    type: string;
    title: string;
    createdAt: string;
  }>;
}

// =============================================================================
// POST Handler - 触发分析
// =============================================================================

/**
 * POST /api/agent/analysis
 * 手动触发异步分析任务
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 1. 解析请求体
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // 2. 验证请求体
  const parseResult = TriggerAnalysisSchema.safeParse(body);

  if (!parseResult.success) {
    return handleValidationError(parseResult.error);
  }

  const { types, priority } = parseResult.data;

  // 3. 创建服务并触发分析
  const analysisService = createAsyncAnalysisService();
  const integration = createAsyncAnalysisBriefingIntegration(analysisService);

  const taskIds = await integration.triggerAnalysis(userId, types);

  // 4. 清理资源
  integration.dispose();

  const response: TriggerAnalysisResponse = {
    taskIds,
    message:
      taskIds.length > 0
        ? `已创建 ${taskIds.length} 个分析任务`
        : "没有需要执行的分析任务",
  };

  logger.info(
    {
      userId,
      types,
      priority,
      taskCount: taskIds.length,
      duration: Date.now() - startTime,
    },
    "POST /api/agent/analysis - Analysis triggered",
  );

  return successResponse(response);
});

// =============================================================================
// GET Handler - 获取状态
// =============================================================================

/**
 * GET /api/agent/analysis
 * 获取分析任务状态和最近结果
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析查询参数
  const { searchParams } = new URL(request.url);
  const parseResult = GetStatusQuerySchema.safeParse({
    type: searchParams.get("type"),
    limit: searchParams.get("limit"),
  });

  if (!parseResult.success) {
    return handleValidationError(parseResult.error);
  }

  const { type, limit } = parseResult.data;

  // 2. 创建服务并获取状态
  const analysisService = createAsyncAnalysisService();
  const integration = createAsyncAnalysisBriefingIntegration(analysisService);

  // 获取队列统计
  const stats = integration.getQueueStats();

  // 获取最近的分析洞察
  const recentInsights = integration
    .getAnalysisInsights(userId)
    .slice(0, limit)
    .map((insight) => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      createdAt: insight.createdAt,
    }));

  // 清理资源
  integration.dispose();

  const response: AnalysisStatusResponse = {
    pendingCount: stats.pending,
    runningCount: stats.running,
    completedCount: stats.completed,
    failedCount: stats.failed,
    byType: stats.byType,
    recentInsights,
  };

  logger.debug(
    {
      userId,
      type,
      stats,
    },
    "GET /api/agent/analysis",
  );

  return successResponse(response);
});
