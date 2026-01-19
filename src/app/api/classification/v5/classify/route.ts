/**
 * 智能分类 v5.0 - 单个书签分类 API
 *
 * POST /api/classification/v5/classify
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ClassificationPipelineService } from "@/lib/classification/v5/classification-pipeline";
import { ContextAnchorService } from "@/lib/classification/v5/context-anchor";
import { ChatToRuleService } from "@/lib/classification/v5/chat-to-rule";
import { convertUserRulesToL0Rules } from "@/lib/classification/v5/classification-pipeline/rule-converter";
import { EmbeddingService } from "@/lib/classification/v5/shared/embedding";
import { VectorSearchService } from "@/lib/classification/v5/shared/vector-search";
import { LLMService } from "@/lib/classification/v5/shared/llm";
import { createLogger } from "@/lib/classification/v5/shared/logger";
import type { ClassificationRequest } from "@/lib/classification/v5/classification-pipeline/types";
import { executeT1InBackground } from "@/lib/classification/v5/t1-queue";

/**
 * 分类请求体
 */
interface ClassifyRequestBody {
  bookmarkId: string;
  title: string;
  description?: string;
  summary?: string;
  tags?: string[];
  url: string;
  content?: string; // 用于提取上下文锚点
  optimistic?: boolean; // 是否启用Optimistic UI模式(默认false)
}

/**
 * POST /api/classification/v5/classify
 * 对单个书签进行智能分类
 */
export async function POST(request: NextRequest) {
  const logger = createLogger("ClassifyAPI");

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("未授权访问", { error: authError?.message });
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 解析请求体
    const body: ClassifyRequestBody = await request.json();

    // 3. 验证必需字段
    if (!body.bookmarkId || !body.title || !body.url) {
      logger.warn("缺少必需字段", { body });
      return NextResponse.json(
        { error: "缺少必需字段: bookmarkId, title, url" },
        { status: 400 },
      );
    }

    // 4. 构建分类请求
    const classificationRequest: ClassificationRequest = {
      userId: user.id,
      bookmarkId: body.bookmarkId,
      title: body.title,
      description: body.description,
      summary: body.summary,
      tags: body.tags,
      url: body.url,
    };

    logger.info("开始分类", {
      userId: user.id,
      bookmarkId: body.bookmarkId,
      title: body.title,
    });

    // 5. 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const vectorSearch = new VectorSearchService(logger, {});
    const llmService = new LLMService(logger);

    const pipeline = new ClassificationPipelineService(
      logger,
      embeddingService,
      vectorSearch,
      llmService,
    );

    // 5.5. 加载用户自定义规则
    try {
      const chatToRuleService = new ChatToRuleService(supabase, logger, llmService);
      const userRules = await chatToRuleService.getRules(true); // 只获取启用的规则
      const l0Rules = convertUserRulesToL0Rules(userRules);

      if (l0Rules.length > 0) {
        pipeline.loadUserRules(l0Rules);
        logger.debug("用户规则已加载", { count: l0Rules.length });
      }
    } catch (error) {
      // 规则加载失败不影响分类流程
      logger.warn("加载用户规则失败", { error });
    }

    // 6. 执行分类
    let result;
    let t1EventId: string | undefined;

    if (body.optimistic === true) {
      // Optimistic UI模式：只执行L0+T0，立即返回
      const t0Result = await pipeline.classifyT0Only(classificationRequest);

      logger.info("T0分类完成（Optimistic模式）", {
        userId: user.id,
        bookmarkId: body.bookmarkId,
        folderId: t0Result.folderId,
        confidence: t0Result.confidence,
        needsT1: t0Result.needsT1,
        totalLatencyMs: t0Result.totalLatencyMs,
      });

      result = t0Result;

      // 如果需要T1纠正，生成事件ID并启动后台任务
      if (t0Result.needsT1) {
        t1EventId = `t1_${user.id}_${body.bookmarkId}_${Date.now()}`;
        logger.info("启动T1后台任务", {
          t1EventId,
          bookmarkId: body.bookmarkId,
          t1Reason: t0Result.t1Reason,
        });

        // 启动后台T1任务（非阻塞）
        executeT1InBackground(
          { supabase, logger },
          t1EventId,
          user.id,
          classificationRequest,
          t0Result.folderId,
          t0Result.confidence,
        ).catch((error) => {
          logger.error(
            "T1后台任务启动失败",
            error instanceof Error ? error : new Error(String(error)),
            { t1EventId }
          );
        });
      }
    } else {
      // 标准模式：执行完整的L0+T0+T1流程
      result = await pipeline.classify(classificationRequest);

      logger.info("分类完成", {
        userId: user.id,
        bookmarkId: body.bookmarkId,
        folderId: result.folderId,
        confidence: result.confidence,
        usedT1: result.usedT1,
        totalLatencyMs: result.totalLatencyMs,
      });
    }

    // 6.5. 记录分类日志到数据库
    try {
      const { error: logError } = await supabase
        .from("classification_logs")
        .insert({
          user_id: user.id,
          bookmark_id: parseInt(body.bookmarkId, 10),
          input_title: body.title,
          input_tags: body.tags || [],
          suggested_folder_id: parseInt(result.folderId, 10),
          suggested_confidence: result.confidence,
          execution_time_ms: result.totalLatencyMs,
          llm_called: result.usedT1,
          classification_source: result.usedT1 ? "llm" : "vector",
        });

      if (logError) {
        logger.warn("Failed to log classification", { error: logError });
      }
    } catch (error) {
      // 日志记录失败不影响分类结果
      logger.warn("Failed to log classification", { error });
    }

    // 6.6. 异步提取和关联上下文锚点（非阻塞）
    extractAndLinkContextAnchor(supabase, logger, embeddingService, {
      bookmarkId: parseInt(body.bookmarkId, 10),
      title: body.title,
      url: body.url,
      content: body.content,
    }).catch((error) => {
      // 锚点提取失败不影响分类结果
      logger.error(
        "Context anchor extraction failed",
        error instanceof Error ? error : new Error(String(error)),
        { bookmarkId: body.bookmarkId }
      );
    });

    // 7. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        folderId: result.folderId,
        confidence: result.confidence,
        usedT1: result.usedT1,
        reasoning: result.reasoning,
        latency: {
          total: result.totalLatencyMs,
          t0: result.t0LatencyMs,
          t1: result.t1LatencyMs,
        },
        // Optimistic UI相关字段
        t1EventId, // 如果启用了optimistic且需要T1，则返回事件ID
        needsT1: "needsT1" in result ? result.needsT1 : undefined,
      },
    });
  } catch (error) {
    logger.error(
      "分类失败",
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        error: "分类失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * 异步提取和关联上下文锚点
 * 这个函数在后台执行，不阻塞分类结果的返回
 */
async function extractAndLinkContextAnchor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logger: ReturnType<typeof createLogger>,
  embeddingService: EmbeddingService,
  params: {
    bookmarkId: number;
    title: string;
    url: string;
    content?: string;
  },
): Promise<void> {
  try {
    logger.debug("Starting context anchor extraction", {
      bookmarkId: params.bookmarkId.toString(),
    });

    // 1. 生成 embedding
    const text = [params.title, params.content].filter(Boolean).join(" ");
    const { embedding } = await embeddingService.generateEmbedding(text);

    // 2. 创建 ContextAnchorService
    const contextAnchorService = new ContextAnchorService(supabase, logger);

    // 3. 提取上下文锚点
    const extractedAnchor = await contextAnchorService.extractContextAnchor({
      bookmarkId: params.bookmarkId,
      title: params.title,
      url: params.url,
      content: params.content,
      embedding,
    });

    if (!extractedAnchor) {
      logger.debug("No context anchor extracted", {
        bookmarkId: params.bookmarkId.toString(),
      });
      return;
    }

    // 4. 关联书签到锚点
    const linkResult = await contextAnchorService.linkBookmarkToAnchor(
      params.bookmarkId,
      extractedAnchor,
      embedding,
    );

    if (linkResult.success) {
      logger.info("Context anchor linked successfully", {
        bookmarkId: params.bookmarkId.toString(),
        anchorId: linkResult.anchorId,
        anchorName: linkResult.anchorName,
        isNewAnchor: linkResult.isNewAnchor,
      });
    } else {
      logger.warn("Failed to link context anchor", {
        bookmarkId: params.bookmarkId.toString(),
        error: linkResult.error,
      });
    }
  } catch (error) {
    logger.error(
      "Context anchor extraction failed",
      error instanceof Error ? error : new Error(String(error)),
      { bookmarkId: params.bookmarkId.toString() }
    );
    // 不抛出错误，因为这是后台操作
  }
}
