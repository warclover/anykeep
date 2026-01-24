/**
 * 智能分类 v5.1 - 混合检索器
 *
 * 实现混合检索（内容向量 70% + 行为向量 30%）和 RRF 融合
 * v5.1 新增：语义护栏（名称相似度分数），解决大文件夹马太效应
 * v5.1.1 新增：AI 标签加成和 Rerank 机制
 * v5.1.3 新增：强匹配规则 Zod Schema 验证
 */

import { z } from "zod";
import type { LoggerService } from "../shared/logger";
import type { VectorSearchService } from "../shared/vector-search";
import type { IEmbeddingService } from "../shared/embedding";
import type {
  HybridRetrievalResult,
  EnhancedTagMatchResult,
  RerankResult,
} from "./types";
import type { FolderId } from "@/lib/shared/types";

/**
 * v5.1.3: 强匹配规则 Schema 定义
 */
const StrongMatchRuleSchema = z.object({
  titlePattern: z.string().min(1, "titlePattern 不能为空"),
  targetFolderPattern: z.string().min(1, "targetFolderPattern 不能为空"),
  boost: z.number().min(0).max(1, "boost 必须在 0-1 之间"),
});

const StrongMatchRulesSchema = z.array(StrongMatchRuleSchema);

/**
 * 混合检索器配置
 */
export interface HybridRetrieverConfig {
  /** 内容向量权重 */
  contentWeight: number;
  /** 行为向量权重 */
  behaviorWeight: number;
  /** RRF 常数（v6 调整为较小值以提高区分度） */
  rrfK: number;
  /** 返回结果数量 */
  topK: number;
  /** v6: 是否使用原始相似度作为置信度基础 */
  useRawSimilarity: boolean;
}

/**
 * 混合检索器类
 */
export class HybridRetriever {
  private logger: LoggerService;
  private vectorSearch: VectorSearchService;
  private embeddingService?: IEmbeddingService;
  private config: HybridRetrieverConfig;
  /** v5.1: 是否启用名称相似度护栏 */
  private enableNameGuardrail: boolean;

  constructor(
    logger: LoggerService,
    vectorSearch: VectorSearchService,
    config?: Partial<HybridRetrieverConfig>,
    embeddingService?: IEmbeddingService,
  ) {
    this.logger = logger.child({ service: "HybridRetriever" });
    this.vectorSearch = vectorSearch;
    this.embeddingService = embeddingService;

    this.config = {
      contentWeight: config?.contentWeight ?? 0.7,
      behaviorWeight: config?.behaviorWeight ?? 0.3,
      rrfK: config?.rrfK ?? 3, // v6: 从60调整为3，提高分数区分度
      topK: config?.topK ?? 5,
      useRawSimilarity: config?.useRawSimilarity ?? true, // v6: 默认使用原始相似度
    };

    this.enableNameGuardrail =
      process.env.CLASSIFICATION_V5_1_ENABLED !== "false" &&
      embeddingService !== undefined;
  }

  /**
   * 执行混合检索
   * v5.1: 支持名称相似度护栏
   * v5.1.1: 支持 AI 标签加成
   */
  async retrieve(
    userId: string,
    contentEmbedding: number[],
    behaviorEmbedding: number[],
    bookmarkTitle?: string,
    aiTags?: string[],
  ): Promise<HybridRetrievalResult[]> {
    this.logger.debug("开始混合检索", {
      userId,
      contentWeight: this.config.contentWeight,
      behaviorWeight: this.config.behaviorWeight,
      enableNameGuardrail: this.enableNameGuardrail,
    });

    // 1. 内容向量检索
    const contentResults = await this.vectorSearch.search({
      userId,
      contentEmbedding,
      limit: 10, // 检索更多候选，用于融合
    });

    // 2. 行为向量检索
    const behaviorResults = await this.vectorSearch.search({
      userId,
      behaviorEmbedding,
      limit: 10,
    });

    // 3. RRF 融合
    const fusedResults = this.fuseWithRRF(contentResults, behaviorResults);

    // 4. v6: 应用关键词匹配增强
    let finalResults = fusedResults;
    if (bookmarkTitle) {
      finalResults = this.applyKeywordBoost(finalResults, bookmarkTitle);
    }

    // 4.1. v5.1.1: 应用 AI 标签加成
    if (aiTags && aiTags.length > 0) {
      finalResults = this.applyAiTagBoost(finalResults, aiTags);
    }

    // 5. v5.1: 如果启用名称护栏，应用名称相似度分数
    if (this.enableNameGuardrail && bookmarkTitle) {
      finalResults = await this.applyNameGuardrail(finalResults, bookmarkTitle);
    }

    // 6. 返回 Top K
    return finalResults.slice(0, this.config.topK);
  }

  /**
   * v6: 应用关键词匹配增强
   *
   * 如果书签标题包含文件夹名称的关键词，给予分数加成
   * v5.1 修复: 将硬编码规则移至配置，支持动态加载
   */
  private applyKeywordBoost(
    results: HybridRetrievalResult[],
    title: string,
  ): HybridRetrievalResult[] {
    const titleLower = title.toLowerCase();

    // v5.1 修复: 从环境变量或配置加载强匹配规则
    // 默认规则为空，避免硬编码特定用户的调试规则
    const STRONG_MATCH_RULES = this.loadStrongMatchRules();

    const boostedResults = results.map((result) => {
      const folderNameLower = result.folderName.toLowerCase();
      let boost = 0;

      // v5.1: 优先检查动态强匹配规则
      for (const rule of STRONG_MATCH_RULES) {
        if (
          rule.titlePattern.test(title) &&
          rule.targetFolderPattern.test(result.folderName)
        ) {
          boost = Math.max(boost, rule.boost);
          this.logger.debug("强���配规则命中", {
            folderId: result.folderId,
            folderName: result.folderName,
            titlePattern: rule.titlePattern.source,
            boost,
          });
          break;
        }
      }

      // 如果没有强匹配，应用原有规则
      if (boost === 0) {
        // 规则 1：标题包含完整文件夹名 → 加成 0.3
        if (
          titleLower.includes(folderNameLower) &&
          folderNameLower.length > 1
        ) {
          boost = 0.3;
          this.logger.debug("关键词匹配：标题包含文件夹名", {
            folderId: result.folderId,
            folderName: result.folderName,
            boost,
          });
        } else {
          // 规则 2：文件夹名包含的关键词出现在标题中 → 每个加成 0.15
          const keywords = folderNameLower.split(/[+\s_\-/]+/);
          const matchedKeywords = keywords.filter(
            (kw) => kw.length > 1 && titleLower.includes(kw),
          );

          if (matchedKeywords.length > 0) {
            boost = 0.15 * matchedKeywords.length;
            this.logger.debug("关键词匹配：部分关键词匹配", {
              folderId: result.folderId,
              folderName: result.folderName,
              matchedKeywords,
              boost,
            });
          }
        }
      }

      return {
        ...result,
        fusedScore: result.fusedScore + boost,
      };
    });

    // 按调整后的分数重新排序
    return boostedResults.sort((a, b) => b.fusedScore - a.fusedScore);
  }

  /**
   * v5.1: 从配置加载强匹配规则
   * v5.1.3: 添加 Zod Schema 验证，防止无效配置
   * 支持环境变量 CLASSIFICATION_STRONG_MATCH_RULES 配置 JSON 格式规则
   */
  private loadStrongMatchRules(): Array<{
    titlePattern: RegExp;
    targetFolderPattern: RegExp;
    boost: number;
  }> {
    const rulesJson = process.env.CLASSIFICATION_STRONG_MATCH_RULES;
    if (!rulesJson) {
      return []; // 默认返回空规则，不硬编码
    }

    try {
      // v5.1.3: 先解析 JSON
      const parsed = JSON.parse(rulesJson);

      // v5.1.3: 使用 Zod 验证结构
      const validationResult = StrongMatchRulesSchema.safeParse(parsed);
      if (!validationResult.success) {
        this.logger.warn("强匹配规则 Schema 验证失败", {
          errors: validationResult.error.flatten().fieldErrors,
        });
        return [];
      }

      // v5.1.3: 验证正则表达式是否有效
      return validationResult.data
        .map((rule) => {
          try {
            return {
              titlePattern: new RegExp(rule.titlePattern, "i"),
              targetFolderPattern: new RegExp(rule.targetFolderPattern, "i"),
              boost: rule.boost,
            };
          } catch (regexError) {
            this.logger.warn("无效的正则表达式，跳过该规则", {
              rule,
              error:
                regexError instanceof Error
                  ? regexError.message
                  : String(regexError),
            });
            return null;
          }
        })
        .filter((rule): rule is NonNullable<typeof rule> => rule !== null);
    } catch (error) {
      this.logger.warn("解析强匹配规则失败，使用空规则", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * v5.1.1: 应用 AI 标签加成
   *
   * 如果 AI 标签与文件夹名匹配，给予分数加成
   * 这是 L0 AI 标签匹配未命中后的兜底增强
   */
  private applyAiTagBoost(
    results: HybridRetrievalResult[],
    aiTags: string[],
  ): HybridRetrievalResult[] {
    const normalizedTags = aiTags.map((t) => t.toLowerCase().trim());

    const boostedResults = results.map((result) => {
      const folderNameLower = result.folderName.toLowerCase();
      let boost = 0;

      for (const tag of normalizedTags) {
        // 规则 0：AI 标签与文件夹名精确匹配 → 加成 0.4
        if (tag === folderNameLower) {
          boost = Math.max(boost, 0.4);
          this.logger.debug("AI 标签精确匹配文件夹名", {
            folderId: result.folderId,
            folderName: result.folderName,
            tag,
            boost,
          });
          break;
        }

        // 规则 1：AI 标签包含文件夹名，或文件夹名包含 AI 标签 → 加成 0.35
        if (
          tag.length >= 4 &&
          folderNameLower.length >= 4 &&
          (tag.includes(folderNameLower) || folderNameLower.includes(tag))
        ) {
          boost = Math.max(boost, 0.35);
          this.logger.debug("AI 标签与文件夹名高度相关", {
            folderId: result.folderId,
            folderName: result.folderName,
            tag,
            boost,
          });
        }

        // 规则 2：AI 标签关键词出现在文件夹名中 → 加成 0.2
        if (boost === 0) {
          const tagKeywords = tag
            .split(/[与和/|\-_·&、\s]+/)
            .filter((k) => k.length >= 2);
          const matchedKeywords = tagKeywords.filter((kw) =>
            folderNameLower.includes(kw),
          );

          if (matchedKeywords.length > 0) {
            boost = Math.max(
              boost,
              0.2 * (matchedKeywords.length / tagKeywords.length),
            );
            this.logger.debug("AI 标签关键词匹配", {
              folderId: result.folderId,
              folderName: result.folderName,
              tag,
              matchedKeywords,
              boost,
            });
          }
        }
      }

      return {
        ...result,
        fusedScore: result.fusedScore + boost,
      };
    });

    // 按调整后的分数重新排序
    return boostedResults.sort((a, b) => b.fusedScore - a.fusedScore);
  }

  /**
   * v5.1: 应用名称相似度护栏
   *
   * 如果书签标题与文件夹名高度匹配（>0.85），强制提升排名
   */
  private async applyNameGuardrail(
    results: HybridRetrievalResult[],
    bookmarkTitle: string,
  ): Promise<HybridRetrievalResult[]> {
    if (!this.embeddingService) {
      return results;
    }

    // 生成书签标题向量
    const bookmarkTitleEmbedding =
      await this.embeddingService.generateEmbedding(bookmarkTitle);

    // 为每个结果计算名称相似度
    const resultsWithNameScore = await Promise.all(
      results.map(async (result) => {
        // 生成文件夹名称向量
        const folderNameEmbedding =
          await this.embeddingService!.generateEmbedding(result.folderName);

        // 计算名称相似度
        const nameSimilarity = this.cosineSimilarity(
          bookmarkTitleEmbedding.embedding,
          folderNameEmbedding.embedding,
        );

        // 如果名称相似度 > 0.85，给予加成
        let adjustedScore = result.fusedScore;
        if (nameSimilarity > 0.85) {
          adjustedScore += 0.15; // 强制提升排名
          this.logger.debug("名称匹配度高，提升排名", {
            folderId: result.folderId,
            folderName: result.folderName,
            nameSimilarity,
            originalScore: result.fusedScore,
            adjustedScore,
          });
        }

        return {
          ...result,
          nameSimilarity,
          fusedScore: adjustedScore,
        };
      }),
    );

    // 按调整后的分数重新排序
    return resultsWithNameScore.sort((a, b) => b.fusedScore - a.fusedScore);
  }

  /**
   * 计算余弦相似度
   * v5.1.2: 修复零向量除以零的问题
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    // v5.1.2: 防止零向量导致的除以零错误
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) {
      return 0; // 零向量与任何向量的相似度定义为 0
    }

    return dotProduct / magnitude;
  }

  /**
   * RRF（Reciprocal Rank Fusion）融合
   * v6: 支持使用原始相似度作为置信度基础
   */
  private fuseWithRRF(
    contentResults: Array<{
      folderId: FolderId;
      folderName: string;
      similarity: number;
    }>,
    behaviorResults: Array<{
      folderId: FolderId;
      folderName: string;
      similarity: number;
    }>,
  ): HybridRetrievalResult[] {
    const scoreMap = new Map<
      string,
      {
        folderName: string;
        contentSimilarity: number;
        behaviorSimilarity: number;
        fusedScore: number;
      }
    >();

    // v6: 根据配置选择评分策略
    if (this.config.useRawSimilarity) {
      // 方案 B：使用原始向量相似度作为置信度基础
      // 融合分数 = contentWeight * contentSimilarity + behaviorWeight * behaviorSimilarity
      contentResults.forEach((result) => {
        scoreMap.set(result.folderId, {
          folderName: result.folderName,
          contentSimilarity: result.similarity,
          behaviorSimilarity: 0,
          fusedScore: this.config.contentWeight * result.similarity,
        });
      });

      behaviorResults.forEach((result) => {
        const existing = scoreMap.get(result.folderId);
        if (existing) {
          existing.behaviorSimilarity = result.similarity;
          existing.fusedScore += this.config.behaviorWeight * result.similarity;
        } else {
          scoreMap.set(result.folderId, {
            folderName: result.folderName,
            contentSimilarity: 0,
            behaviorSimilarity: result.similarity,
            fusedScore: this.config.behaviorWeight * result.similarity,
          });
        }
      });
    } else {
      // 原有 RRF 方案（使用调整后的 rrfK=3）
      contentResults.forEach((result, index) => {
        const rrf = 1 / (this.config.rrfK + index + 1);
        const score = this.config.contentWeight * rrf;

        scoreMap.set(result.folderId, {
          folderName: result.folderName,
          contentSimilarity: result.similarity,
          behaviorSimilarity: 0,
          fusedScore: score,
        });
      });

      behaviorResults.forEach((result, index) => {
        const rrf = 1 / (this.config.rrfK + index + 1);
        const score = this.config.behaviorWeight * rrf;

        const existing = scoreMap.get(result.folderId);
        if (existing) {
          existing.behaviorSimilarity = result.similarity;
          existing.fusedScore += score;
        } else {
          scoreMap.set(result.folderId, {
            folderName: result.folderName,
            contentSimilarity: 0,
            behaviorSimilarity: result.similarity,
            fusedScore: score,
          });
        }
      });
    }

    // 排序并返回
    return Array.from(scoreMap.entries())
      .map(([folderId, data]) => ({
        folderId,
        folderName: data.folderName,
        contentSimilarity: data.contentSimilarity,
        behaviorSimilarity: data.behaviorSimilarity,
        fusedScore: data.fusedScore,
      }))
      .sort((a, b) => b.fusedScore - a.fusedScore);
  }

  /**
   * v5.1.1: 应用标签加成的 Rerank
   *
   * 当 AI 标签匹配器返回部分匹配结果时（needsT0Validation = true），
   * 使用此方法将标签分数与向量分数融合
   *
   * 公式: FinalScore = VectorScore × 0.7 + TagScore × 0.3
   */
  applyTagBoostRerank(
    results: HybridRetrievalResult[],
    tagMatchResult: EnhancedTagMatchResult | null,
  ): RerankResult[] {
    // 如果没有标签匹配结果或不需要 T0 校验，直接转换返回
    if (!tagMatchResult) {
      return results.map((result) => ({
        folderId: result.folderId,
        folderName: result.folderName,
        vectorScore: result.fusedScore,
        tagScore: 0,
        finalScore: result.fusedScore,
        tagBoostApplied: false,
      }));
    }

    const targetFolderId = tagMatchResult.folderId;
    const tagScore = tagMatchResult.tagScore;

    const rerankedResults = results.map((result) => {
      const vectorScore = result.fusedScore;

      if (result.folderId === targetFolderId) {
        // Rerank 公式: FinalScore = VectorScore × 0.7 + TagScore × 0.3
        const finalScore = vectorScore * 0.7 + tagScore * 0.3;

        this.logger.debug("Rerank 应用标签加成", {
          folderId: result.folderId,
          folderName: result.folderName,
          vectorScore,
          tagScore,
          finalScore,
          matchMode: tagMatchResult.matchMode,
        });

        return {
          folderId: result.folderId,
          folderName: result.folderName,
          vectorScore,
          tagScore,
          finalScore,
          tagBoostApplied: true,
        };
      }

      return {
        folderId: result.folderId,
        folderName: result.folderName,
        vectorScore,
        tagScore: 0,
        finalScore: vectorScore,
        tagBoostApplied: false,
      };
    });

    // 按最终分数重新排序
    return rerankedResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * v5.1.1: 检查 Rerank 后的结果是否验证了标签匹配
   *
   * 如果标签匹配的文件夹在 Rerank 后仍然排名第一，则验证通过
   */
  validateTagMatchWithRerank(
    rerankResults: RerankResult[],
    tagMatchResult: EnhancedTagMatchResult,
  ): boolean {
    if (rerankResults.length === 0) {
      return false;
    }

    const topResult = rerankResults[0];

    // 验证条件：
    // 1. 排名第一的文件夹是标签匹配的文件夹
    // 2. 或者：即使不是第一，但标签匹配的文件夹分数 >= 0.6
    if (topResult.folderId === tagMatchResult.folderId) {
      this.logger.info("Rerank 验证通过：标签匹配文件夹排名第一", {
        folderId: topResult.folderId,
        finalScore: topResult.finalScore,
      });
      return true;
    }

    // 查找标签匹配的文件夹
    const tagMatchFolder = rerankResults.find(
      (r) => r.folderId === tagMatchResult.folderId,
    );

    if (tagMatchFolder && tagMatchFolder.finalScore >= 0.6) {
      this.logger.info("Rerank 验证通过：标签匹配文件夹分数足够高", {
        folderId: tagMatchFolder.folderId,
        finalScore: tagMatchFolder.finalScore,
        topFolderId: topResult.folderId,
        topScore: topResult.finalScore,
      });
      return true;
    }

    this.logger.warn("Rerank 验证失败：向量检索结果与标签匹配不一致", {
      tagMatchFolderId: tagMatchResult.folderId,
      tagMatchScore: tagMatchFolder?.finalScore ?? 0,
      topFolderId: topResult.folderId,
      topScore: topResult.finalScore,
    });

    return false;
  }
}
