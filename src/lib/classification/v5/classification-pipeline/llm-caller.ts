/**
 * 智能分类 v5.0 - LLM 调用器
 *
 * 条件LLM调用（3个触发条件）
 */

import type { LoggerService } from '../shared/logger';
import type { LLMService, LLMClassificationRequest } from '../shared/llm';
import type { T0Result, LLMCallRequest, T1Result } from './types';

/**
 * LLM 调用器配置
 */
export interface LLMCallerConfig {
  /** 低置信度阈值 */
  lowConfidenceThreshold: number;
  /** 向量冲突阈值（分数差） */
  vectorConflictThreshold: number;
}

/**
 * LLM 调用器类
 */
export class LLMCaller {
  private logger: LoggerService;
  private llmService: LLMService;
  private config: LLMCallerConfig;

  constructor(
    logger: LoggerService,
    llmService: LLMService,
    config?: Partial<LLMCallerConfig>
  ) {
    this.logger = logger.child({ service: 'LLMCaller' });
    this.llmService = llmService;

    this.config = {
      lowConfidenceThreshold: config?.lowConfidenceThreshold ?? 0.75,
      vectorConflictThreshold: config?.vectorConflictThreshold ?? 0.1,
    };
  }

  /**
   * 判断是否需要调用LLM
   */
  shouldCallLLM(t0Result: T0Result, manualRequest: boolean = false): boolean {
    // 条件3: 用户手动请求
    if (manualRequest) {
      this.logger.debug('触发LLM调用：用户手动请求');
      return true;
    }

    // 条件1: 低置信度（<0.75）
    if (t0Result.confidence < this.config.lowConfidenceThreshold) {
      this.logger.debug('触发LLM调用：低置信度', {
        confidence: t0Result.confidence,
        threshold: this.config.lowConfidenceThreshold,
      });
      return true;
    }

    // 条件2: 向量冲突（Top 2 分数接近）
    if (t0Result.candidates.length >= 2) {
      const scoreDiff =
        t0Result.candidates[0].similarity - t0Result.candidates[1].similarity;

      if (scoreDiff < this.config.vectorConflictThreshold) {
        this.logger.debug('触发LLM调用：向量冲突', {
          scoreDiff,
          threshold: this.config.vectorConflictThreshold,
        });
        return true;
      }
    }

    return false;
  }

  /**
   * 调用LLM进行分类
   */
  async callLLM(request: LLMCallRequest): Promise<T1Result> {
    const startTime = Date.now();

    this.logger.info('开始LLM分类', {
      bookmarkId: request.bookmark.bookmarkId,
      candidateCount: request.candidates.length,
    });

    // 构建 LLM 请求
    const llmRequest: LLMClassificationRequest = {
      title: request.bookmark.title,
      description: request.bookmark.description,
      url: request.bookmark.url,
      summary: request.bookmark.summary,
      candidates: request.candidates.map(c => ({
        id: c.folderId,
        name: c.folderName,
        description: c.description,
      })),
    };

    // 调用LLM
    const response = await this.llmService.classify(llmRequest);

    const latencyMs = Date.now() - startTime;

    return {
      folderId: response.folderId,
      confidence: response.confidence,
      reasoning: response.reasoning,
      latencyMs,
    };
  }

  /**
   * 构建LLM Prompt
   */
  private buildPrompt(request: LLMCallRequest): string {
    const { bookmark, candidates } = request;

    return `你是一个智能书签分类助手。请分析以下书签，并从候选文件夹中选择最合适的一个。

**书签信息**:
- 标题: ${bookmark.title}
- 描述: ${bookmark.description || '无'}
- URL: ${bookmark.url}
- 摘要: ${bookmark.summary || '无'}
- 标签: ${bookmark.tags?.join(', ') || '无'}

**候选文件夹** (按推荐度排序):
${candidates.map((c, i) => `${i + 1}. ${c.folderName} (相似度: ${c.score.toFixed(2)}) - ${c.description || '无描述'}`).join('\n')}

**要求**:
1. 选择最合适的文件夹ID
2. 给出置信度分数 (0.0-1.0)
3. 简要说明选择理由（50字以内）

**输出JSON格式**:
{
  "folderId": "选择的文件夹UUID",
  "confidence": 0.95,
  "reasoning": "选择理由"
}`;
  }
}
