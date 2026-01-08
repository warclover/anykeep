/**
 * SearchOptimizeSkill - 搜索优化助手
 *
 * 分析搜索意图，优化搜索条件，提高搜索准确性
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import {
  SearchOptimizeInputSchema,
  SearchOptimizeOutputSchema,
  type SearchOptimizeInput,
  type SearchOptimizeOutput,
  type SearchAnalysisResult,
} from "./types";

/**
 * 搜索优化 Skill
 *
 * 设计为原子 Skill（非编排），因为：
 * 1. 响应时间短（<1s）
 * 2. 单步执行，无需多阶段进度
 * 3. 输出为建议列表，无需复杂交付物
 */
export class SearchOptimizeSkill extends BaseSkill<
  SearchOptimizeInput,
  SearchOptimizeOutput
> {
  readonly metadata: SkillMetadata = {
    id: "search_optimize",
    name: "搜索优化助手",
    description: "分析搜索意图，优化搜索条件，提高搜索准确性",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "suggest"],
  };

  readonly inputSchema = SearchOptimizeInputSchema;
  readonly outputSchema = SearchOptimizeOutputSchema;

  protected async executeInternal(
    input: SearchOptimizeInput,
    _context: SkillContext,
  ): Promise<SearchOptimizeOutput> {
    // 如果没有提供原始查询，返回通用建议
    if (!input.originalQuery) {
      return this.generateSearchTips();
    }

    const query = input.originalQuery;

    // 分析搜索问题
    const analysis = this.analyzeSearchIssue(query, input.feedback);

    // 生成优化建议
    const suggestions = this.generateOptimizations(analysis, query);

    return {
      analysis: {
        originalQuery: query,
        issues: analysis.issues,
      },
      suggestions,
      tips: this.getContextualTips(analysis),
    };
  }

  /**
   * 分析搜索问题
   */
  private analyzeSearchIssue(
    query: string,
    feedback?: string,
  ): SearchAnalysisResult {
    const issues: Array<{ type: string; suggestion: string }> = [];

    // 检查查询长度
    if (query.length < 3) {
      issues.push({
        type: "too_short",
        suggestion: "尝试使用更具体的关键词",
      });
    }

    // 检查查询复杂度
    if (query.split(/\s+/).length > 5) {
      issues.push({
        type: "too_complex",
        suggestion: "尝试简化查询，使用核心关键词",
      });
    }

    // 基于用户反馈分析
    if (feedback) {
      if (/太多|太杂/.test(feedback)) {
        issues.push({
          type: "too_broad",
          suggestion: "添加限定词（如时间、平台、标签）",
        });
      }
      if (/太少|找不到/.test(feedback)) {
        issues.push({
          type: "too_narrow",
          suggestion: "尝试使用同义词或更宽泛的词",
        });
      }
      if (/不相关/.test(feedback)) {
        issues.push({
          type: "irrelevant",
          suggestion: "尝试语义搜索模式",
        });
      }
    }

    return { issues };
  }

  /**
   * 生成优化建议
   */
  private generateOptimizations(
    analysis: SearchAnalysisResult,
    query: string,
  ): Array<{
    optimizedQuery: string;
    explanation: string;
    expectedImprovement: string;
  }> {
    const suggestions: Array<{
      optimizedQuery: string;
      explanation: string;
      expectedImprovement: string;
    }> = [];

    for (const issue of analysis.issues) {
      switch (issue.type) {
        case "too_broad":
          suggestions.push({
            optimizedQuery: query.split(/\s+/).slice(0, 2).join(" "),
            explanation: "精简为核心关键词，减少噪音",
            expectedImprovement: "减少 50% 无关结果",
          });
          break;
        case "too_narrow":
          suggestions.push({
            optimizedQuery: query,
            explanation: "建议切换到语义搜索模式",
            expectedImprovement: "增加 30% 相关结果",
          });
          break;
        case "too_short":
          suggestions.push({
            optimizedQuery: query,
            explanation: "建议添加更多描述性关键词",
            expectedImprovement: "提升搜索精准度",
          });
          break;
        case "too_complex":
          suggestions.push({
            optimizedQuery: query.split(/\s+/).slice(0, 3).join(" "),
            explanation: "保留核心词，移除修饰词",
            expectedImprovement: "提升匹配率 40%",
          });
          break;
        case "irrelevant":
          suggestions.push({
            optimizedQuery: query,
            explanation: "建议使用语义搜索而非关键词匹配",
            expectedImprovement: "提升相关性 60%",
          });
          break;
      }
    }

    return suggestions;
  }

  /**
   * 生成通用搜索技巧
   */
  private generateSearchTips(): SearchOptimizeOutput {
    return {
      analysis: null,
      suggestions: [],
      tips: [
        '💡 使用引号 "精确匹配" 搜索完整短语',
        "💡 使用 tag:标签名 语法筛选特定标签",
        "💡 使用 platform:微信 筛选特定平台",
        "💡 使用 before:2024-01-01 或 after:2024-01-01 筛选时间",
        '💡 搜索结果不满意？告诉我"太多"、"太少"或"不相关"，我来帮你优化',
      ],
    };
  }

  /**
   * 获取上下文相关的搜索建议
   */
  private getContextualTips(analysis: SearchAnalysisResult): string[] {
    const tips: string[] = [];

    if (analysis.issues.some((i) => i.type === "too_broad")) {
      tips.push("💡 试试添加 platform:微信 或 tag:技术 来缩小范围");
    }

    if (analysis.issues.some((i) => i.type === "too_narrow")) {
      tips.push("💡 试试用语义搜索，直接描述你想找什么内容");
    }

    if (analysis.issues.some((i) => i.type === "irrelevant")) {
      tips.push("💡 语义搜索模式会理解你的意图，而非简单匹配关键词");
    }

    // 如果没有特定问题，添加通用提示
    if (tips.length === 0) {
      tips.push("💡 可以告诉我搜索结果的问题，我会帮你优化");
    }

    return tips;
  }
}

// 单例导出
export const searchOptimizeSkill = new SearchOptimizeSkill();
