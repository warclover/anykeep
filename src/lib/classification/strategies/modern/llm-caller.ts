/**
 * 智能分类 v5.0 - LLM 调用器
 *
 * 条件LLM调用（3个触发条件）
 */

import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type {
  LLMService,
  LLMClassificationRequest,
} from "@/lib/classification/infrastructure/shared-services/llm";
import type { T0Result, LLMCallRequest, T1Result } from "./types";

/**
 * LLM 调用器配置
 */
export interface LLMCallerConfig {
  /** 低置信度阈值 */
  lowConfidenceThreshold: number;
  /** 向量冲突阈值（分数差） */
  vectorConflictThreshold: number;
  /** v6: 高置信度阈值（直接使用 T0，无需 T1） */
  highConfidenceThreshold: number;
  /** v6: 高置信度时的最小分数差（领先优势） */
  highConfidenceGap: number;
}

/**
 * v6: T0 决策结果
 */
export interface T0Decision {
  /** 是否使用 T0 结果 */
  useT0: boolean;
  /** 是否需要 T1 验证/纠正 */
  needsT1: boolean;
  /** 是否使用默认文件夹 */
  useDefault?: boolean;
  /** 决策原因 */
  reason:
    | "high_confidence"
    | "medium_confidence"
    | "low_confidence"
    | "very_low_confidence"
    | "vector_conflict"
    | "manual_request";
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
    config?: Partial<LLMCallerConfig>,
  ) {
    this.logger = logger.child({ service: "LLMCaller" });
    this.llmService = llmService;

    this.config = {
      // v6: 调整阈值以适应实际的低相似度范围（约 1-10%）
      lowConfidenceThreshold: config?.lowConfidenceThreshold ?? 0.02, // 从 0.65 调低到 0.02
      vectorConflictThreshold: config?.vectorConflictThreshold ?? 0.005, // 从 0.1 调低到 0.005
      highConfidenceThreshold: config?.highConfidenceThreshold ?? 0.05, // 从 0.85 调低到 0.05
      highConfidenceGap: config?.highConfidenceGap ?? 0.01, // 从 0.15 调低到 0.01
    };
  }

  /**
   * v6: 分层置信度决策
   * 根据置信度和分数差，决定是否使用 T0 结果、是否需要 T1 验证
   */
  makeT0Decision(
    t0Result: T0Result,
    manualRequest: boolean = false,
  ): T0Decision {
    // 条件0: 用户手动请求 T1
    if (manualRequest) {
      this.logger.debug("T0决策：用户手动请求 T1");
      return { useT0: true, needsT1: true, reason: "manual_request" };
    }

    const confidence = t0Result.confidence;
    const gap =
      t0Result.candidates.length >= 2
        ? t0Result.candidates[0].similarity - t0Result.candidates[1].similarity
        : 1.0; // 只有一个候选时，gap 为 1

    // 层级1: 高置信度 + 明显领先 → 直接使用 T0
    if (
      confidence >= this.config.highConfidenceThreshold &&
      gap >= this.config.highConfidenceGap
    ) {
      this.logger.debug("T0决策：高置信度，直接使用", {
        confidence,
        gap,
        thresholds: {
          confidence: this.config.highConfidenceThreshold,
          gap: this.config.highConfidenceGap,
        },
      });
      return { useT0: true, needsT1: false, reason: "high_confidence" };
    }

    // 层级2: 中置信度 或 竞争激烈 → T1 验证
    if (confidence >= this.config.lowConfidenceThreshold) {
      const needsT1 = gap < this.config.highConfidenceGap;
      this.logger.debug("T0决策：中置信度", {
        confidence,
        gap,
        needsT1,
        reason: needsT1 ? "vector_conflict" : "medium_confidence",
      });
      return {
        useT0: true,
        needsT1,
        reason: needsT1 ? "vector_conflict" : "medium_confidence",
      };
    }

    // 层级3: 低置信度 → T1 必须纠正（始终调用 T1）
    this.logger.debug("T0决策：低置信度，T1 必须纠正", { confidence });
    return { useT0: false, needsT1: true, reason: "low_confidence" };
  }

  /**
   * 判断是否需要调用LLM（兼容旧接口）
   */
  shouldCallLLM(t0Result: T0Result, manualRequest: boolean = false): boolean {
    const decision = this.makeT0Decision(t0Result, manualRequest);
    return decision.needsT1;
  }

  /**
   * 调用LLM进行分类
   */
  async callLLM(request: LLMCallRequest): Promise<T1Result> {
    const startTime = Date.now();

    this.logger.info("开始LLM分类", {
      bookmarkId: request.bookmark.bookmarkId,
      candidateCount: request.candidates.length,
    });

    // 构建 LLM 请求（v6: 包含示例书签和关键词）
    const llmRequest: LLMClassificationRequest = {
      title: request.bookmark.title,
      description: request.bookmark.description,
      url: request.bookmark.url,
      summary: request.bookmark.summary,
      tags: request.bookmark.tags,
      candidates: request.candidates.map((c) => ({
        id: c.folderId,
        name: c.folderName,
        description: c.description,
        sampleBookmarks: c.sampleBookmarks,
        keywordTags: c.keywordTags,
        score: c.score,
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
   * v6: 构建增强的 LLM Prompt
   * 添加文件夹描述和示例书签，提升 LLM 理解能力
   */
  private buildPrompt(request: LLMCallRequest): string {
    const { bookmark, candidates } = request;

    // 构建候选文件夹信息（包含示例书签）
    const candidatesInfo = candidates
      .map((c, i) => {
        let info = `${i + 1}. **${c.folderName}** (匹配度: ${(c.score * 100).toFixed(0)}%)`;

        if (c.description) {
          info += `\n   描述: ${c.description}`;
        }

        // v6: 添加示例书签（如果有）
        if (c.sampleBookmarks && c.sampleBookmarks.length > 0) {
          const samples = c.sampleBookmarks
            .slice(0, 3)
            .map((s) => `「${s}」`)
            .join("、");
          info += `\n   已有内容: ${samples}`;
        }

        // v6: 添加关键词标签（如果有）
        if (c.keywordTags && c.keywordTags.length > 0) {
          info += `\n   关键词: ${c.keywordTags.join(", ")}`;
        }

        return info;
      })
      .join("\n\n");

    return `你是一个智能书签分类助手。请根据书签内容和文件夹特征，选择最合适的文件夹。

## 待分类书签
- **标题**: ${bookmark.title}
- **摘要**: ${bookmark.summary || "无"}
- **URL**: ${bookmark.url}
- **标签**: ${bookmark.tags?.join(", ") || "无"}

## 候选文件夹

${candidatesInfo}

## 分类规则
1. 优先选择与书签主题**最相关**的文件夹
2. 参考文件夹的"已有内容"判断是否匹配
3. 如果书签明确提到某个技术/领域，优先选择对应文件夹
4. 如果不确定，选择最通用的文件夹

## 输出要求
返回 JSON 格式:
{
  "folderId": "选择的文件夹ID",
  "confidence": 0.0-1.0,
  "reasoning": "选择理由（30字以内）"
}

请直接返回 JSON，不要其他内容。`;
  }
}
