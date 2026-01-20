/**
 * T1后台执行器
 * 在后台异步执行T1纠正任务
 *
 * v5.2: 使用 DashScopeEmbeddingAdapter 替代 OpenAI EmbeddingService
 *       以使用项目统一的百炼/DashScope embedding 服务
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "../shared/logger";
import type { ClassificationRequest } from "../classification-pipeline/types";
import { ClassificationPipelineService } from "../classification-pipeline";
import { T1QueueService } from "./t1-queue.service";
import { DashScopeEmbeddingAdapter } from "../shared/embedding";
import { VectorSearchService } from "../shared/vector-search";
import { LLMService } from "../shared/llm";

/**
 * T1执行器配置
 */
export interface T1ExecutorConfig {
  supabase: SupabaseClient;
  logger: LoggerService;
}

/**
 * 后台执行T1纠正任务
 */
export async function executeT1InBackground(
  config: T1ExecutorConfig,
  eventId: string,
  userId: string,
  request: ClassificationRequest,
  t0FolderId: string,
  t0Confidence: number,
): Promise<void> {
  const { supabase, logger } = config;
  const queueService = new T1QueueService(supabase, logger);

  try {
    // 1. 创建T1任务记录
    await queueService.createTask(
      eventId,
      userId,
      request.bookmarkId,
      t0FolderId,
      t0Confidence,
    );

    // 2. 标记为处理中
    await queueService.markAsProcessing(eventId);

    logger.info("开始执行T1后台任务", {
      eventId,
      bookmarkId: request.bookmarkId,
    });

    const startTime = Date.now();

    // 3. 初始化服务（使用百炼/DashScope embedding）
    const embeddingService = new DashScopeEmbeddingAdapter(logger);
    const vectorSearch = new VectorSearchService(logger, {});
    const llmService = new LLMService(logger);

    const pipeline = new ClassificationPipelineService(
      logger,
      embeddingService,
      vectorSearch,
      llmService,
    );

    // 4. 执行完整分类（包含T1）
    const result = await pipeline.classify(request);

    const executionTime = Date.now() - startTime;

    // 5. 更新T1任务结果
    await queueService.completeTask(
      eventId,
      result.folderId,
      result.confidence,
      result.reasoning,
      executionTime,
    );

    logger.info("T1后台任务完成", {
      eventId,
      bookmarkId: request.bookmarkId,
      t1FolderId: result.folderId,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    logger.error(
      "T1后台任务失败",
      error instanceof Error ? error : new Error(String(error)),
      {
        eventId,
        bookmarkId: request.bookmarkId,
      },
    );

    // 更新任务状态为失败
    await queueService.failTask(
      eventId,
      error instanceof Error ? error.message : String(error),
    );
  }
}
