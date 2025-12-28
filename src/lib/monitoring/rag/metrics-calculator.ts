/**
 * RAG 评估指标计算器
 *
 * 实现 RAGAS 风格的四大核心指标：
 * - Faithfulness: 回答忠实度
 * - Answer Relevancy: 回答相关性
 * - Context Precision: 上下文精确度
 * - Context Recall: 上下文召回率
 *
 * @module monitoring/rag/metrics-calculator
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  EvaluationTestCase,
  RAGResponse,
  EvaluationResult,
} from "./types";

/**
 * 评估指标计算器
 */
export class RAGMetricsCalculator {
  /**
   * 计算单个测试用例的所有评估指标
   */
  evaluate(
    testCase: EvaluationTestCase,
    response: RAGResponse,
  ): EvaluationResult {
    const scores = {
      faithfulness: this.calculateFaithfulness(response),
      answerRelevancy: this.calculateAnswerRelevancy(testCase, response),
      contextPrecision: this.calculateContextPrecision(testCase, response),
      contextRecall: this.calculateContextRecall(testCase, response),
    };

    return {
      testCaseId: testCase.id,
      query: testCase.query,
      response,
      scores,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * 计算忠实度 (Faithfulness)
   *
   * 评估回答是否基于检索到的上下文，而非幻觉生成
   * 算法：检查回答中的关键信息是否能在上下文中找到
   */
  private calculateFaithfulness(response: RAGResponse): number {
    const { answer, contexts } = response;

    if (!answer || answer.trim().length === 0) {
      return 0;
    }

    if (contexts.length === 0) {
      // 没有上下文但有回答，可能是幻觉
      return 0.3;
    }

    // 提取回答中的关键短语
    const answerPhrases = this.extractKeyPhrases(answer);

    if (answerPhrases.length === 0) {
      return 0.5; // 无法提取关键短语，给中性分数
    }

    // 合并所有上下文
    const combinedContext = contexts.join(" ").toLowerCase();

    // 计算有多少关键短语能在上下文中找到
    let matchedCount = 0;
    for (const phrase of answerPhrases) {
      if (combinedContext.includes(phrase.toLowerCase())) {
        matchedCount++;
      }
    }

    return matchedCount / answerPhrases.length;
  }

  /**
   * 计算回答相关性 (Answer Relevancy)
   *
   * 评估回答是否真正回答了用户的问题
   * 算法：检查期望关键词的覆盖率 + 回答长度合理性
   */
  private calculateAnswerRelevancy(
    testCase: EvaluationTestCase,
    response: RAGResponse,
  ): number {
    const { answer } = response;
    const { expectedKeywords, query } = testCase;

    if (!answer || answer.trim().length === 0) {
      return 0;
    }

    // 1. 关键词覆盖率 (40% 权重)
    let keywordScore = 0;
    if (expectedKeywords.length > 0) {
      const answerLower = answer.toLowerCase();
      const matchedKeywords = expectedKeywords.filter((kw) =>
        answerLower.includes(kw.toLowerCase()),
      );
      keywordScore = matchedKeywords.length / expectedKeywords.length;
    } else {
      keywordScore = 0.5; // 没有期望关键词，给中性分数
    }

    // 2. 查询词覆盖 (30% 权重)
    const queryTerms = this.tokenize(query);
    const answerTerms = new Set(this.tokenize(answer));
    let queryTermScore = 0;
    if (queryTerms.length > 0) {
      const matchedTerms = queryTerms.filter((t) => answerTerms.has(t));
      queryTermScore = matchedTerms.length / queryTerms.length;
    }

    // 3. 回答长度合理性 (30% 权重)
    // 太短可能没有实质内容，太长可能跑题
    const lengthScore = this.calculateLengthScore(answer);

    return keywordScore * 0.4 + queryTermScore * 0.3 + lengthScore * 0.3;
  }

  /**
   * 计算上下文精确度 (Context Precision)
   *
   * 评估检索结果的排序质量（相关内容是否排在前面）
   * 算法：基于期望关键词在各上下文中的分布计算加权精确度
   */
  private calculateContextPrecision(
    testCase: EvaluationTestCase,
    response: RAGResponse,
  ): number {
    const { contexts } = response;
    const { expectedKeywords } = testCase;

    if (contexts.length === 0) {
      return 0;
    }

    if (expectedKeywords.length === 0) {
      // 没有期望关键词，基于相似度分数判断
      if (response.searchResults && response.searchResults.length > 0) {
        // 检查相似度是否递减（排序质量）
        const similarities = response.searchResults.map((r) => r.similarity);
        let orderedCount = 0;
        for (let i = 1; i < similarities.length; i++) {
          if (similarities[i] <= similarities[i - 1]) {
            orderedCount++;
          }
        }
        return (orderedCount + 1) / similarities.length;
      }
      return 0.5;
    }

    // 计算每个位置的相关性（Precision@k）
    let precisionSum = 0;
    let relevantCount = 0;

    for (let k = 0; k < contexts.length; k++) {
      const context = contexts[k].toLowerCase();
      const isRelevant = expectedKeywords.some((kw) =>
        context.includes(kw.toLowerCase()),
      );

      if (isRelevant) {
        relevantCount++;
        // Precision@(k+1) = 到位置 k 为止的精确率
        precisionSum += relevantCount / (k + 1);
      }
    }

    // Average Precision
    if (relevantCount === 0) {
      return 0;
    }

    return precisionSum / relevantCount;
  }

  /**
   * 计算上下文召回率 (Context Recall)
   *
   * 评估检索到了多少相关内容
   * 算法：期望关键词在检索结果中的覆盖率
   */
  private calculateContextRecall(
    testCase: EvaluationTestCase,
    response: RAGResponse,
  ): number {
    const { contexts } = response;
    const { expectedKeywords, groundTruthContext } = testCase;

    if (contexts.length === 0) {
      return 0;
    }

    // 合并所有上下文
    const combinedContext = contexts.join(" ").toLowerCase();

    // 方法 1: 基于期望关键词
    if (expectedKeywords.length > 0) {
      const foundKeywords = expectedKeywords.filter((kw) =>
        combinedContext.includes(kw.toLowerCase()),
      );
      return foundKeywords.length / expectedKeywords.length;
    }

    // 方法 2: 基于真实上下文（如果提供）
    if (groundTruthContext) {
      const truthPhrases = this.extractKeyPhrases(groundTruthContext);
      if (truthPhrases.length > 0) {
        const foundPhrases = truthPhrases.filter((phrase) =>
          combinedContext.includes(phrase.toLowerCase()),
        );
        return foundPhrases.length / truthPhrases.length;
      }
    }

    // 没有足够信息评估召回率
    return 0.5;
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 提取关键短语
   */
  private extractKeyPhrases(text: string): string[] {
    // 简单实现：提取长度适中的词组
    const phrases: string[] = [];

    // 提取中文短语（2-6字）
    const chinesePattern = /[\u4e00-\u9fa5]{2,6}/g;
    const chineseMatches = text.match(chinesePattern) || [];
    phrases.push(...chineseMatches);

    // 提取英文词组（单词）
    const englishPattern = /[a-zA-Z]{3,}/g;
    const englishMatches = text.match(englishPattern) || [];
    phrases.push(...englishMatches);

    // 去重
    return [...new Set(phrases)];
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];

    // 中文按字分割
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    tokens.push(...chineseChars);

    // 英文按词分割
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    tokens.push(...englishWords.map((w) => w.toLowerCase()));

    return tokens;
  }

  /**
   * 计算长度合理性分数
   */
  private calculateLengthScore(text: string): number {
    const length = text.length;

    // 理想长度范围：50-500 字符
    if (length < 20) {
      return 0.2; // 太短
    } else if (length < 50) {
      return 0.5;
    } else if (length <= 500) {
      return 1.0; // 理想长度
    } else if (length <= 1000) {
      return 0.8;
    } else {
      return 0.6; // 太长
    }
  }
}

/**
 * 计算统计信息
 */
export function calculateStatistics(values: number[]): {
  mean: number;
  min: number;
  max: number;
  std: number;
} {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0, std: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  const std = Math.sqrt(avgSquaredDiff);

  return { mean, min, max, std };
}

/**
 * 计算百分位数
 */
export function calculatePercentile(
  values: number[],
  percentile: number,
): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// 单例导出
let calculatorInstance: RAGMetricsCalculator | null = null;

export function getRAGMetricsCalculator(): RAGMetricsCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new RAGMetricsCalculator();
  }
  return calculatorInstance;
}
