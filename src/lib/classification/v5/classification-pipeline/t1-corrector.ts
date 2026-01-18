/**
 * 智能分类 v5.0 - T1 纠正器
 *
 * T1异步纠正（<5s）：LLM深度分析
 */

import type { LoggerService } from '../shared/logger';
import { LLMCaller } from './llm-caller';
import type { ClassificationRequest, T0Result, T1Result } from './types';

/**
 * T1 纠正器类
 */
export class T1Corrector {
  private logger: LoggerService;
  private llmCaller: LLMCaller;

  constructor(logger: LoggerService, llmCaller: LLMCaller) {
    this.logger = logger.child({ service: 'T1Corrector' });
    this.llmCaller = llmCaller;
  }

  /**
   * 执行T1纠正
   */
  async correct(
    request: ClassificationRequest,
    t0Result: T0Result
  ): Promise<T1Result> {
    this.logger.info('开始T1纠正', {
      bookmarkId: request.bookmarkId,
      t0FolderId: t0Result.folderId,
      t0Confidence: t0Result.confidence,
      t1Reason: t0Result.t1Reason,
    });

    // 调用LLM进行深度分析
    const result = await this.llmCaller.callLLM({
      bookmark: request,
      candidates: t0Result.candidates.map(c => ({
        folderId: c.folderId,
        folderName: c.folderName,
        score: c.similarity,
      })),
    });

    this.logger.info('T1纠正完成', {
      bookmarkId: request.bookmarkId,
      t1FolderId: result.folderId,
      t1Confidence: result.confidence,
      latencyMs: result.latencyMs,
    });

    return result;
  }
}
