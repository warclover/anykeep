/**
 * 指标计算器
 */

import type { TestResult, TestMetrics, Domain, UserProfile } from "../types";

export class MetricsCalculator {
  /**
   * 计算测试指标
   */
  calculateMetrics(
    results: TestResult[],
    userProfiles: UserProfile[],
  ): TestMetrics {
    return {
      summary: this.calculateSummary(results),
      byUserType: this.calculateByUserType(results, userProfiles),
      byDomain: this.calculateByDomain(results),
      byStrategy: this.calculateByStrategy(results),
      errorAnalysis: this.analyzeErrors(results),
      recommendations: this.generateRecommendations(results),
    };
  }

  /**
   * 计算总体摘要
   */
  private calculateSummary(results: TestResult[]): TestMetrics["summary"] {
    const total = results.length;
    const correct = results.filter((r) => r.isCorrect).length;
    const overallAccuracy = correct / total;

    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / total;

    const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / total;

    // 获取唯一用户数
    const uniqueUsers = new Set(results.map((r) => r.userId)).size;

    return {
      totalUsers: uniqueUsers,
      totalBookmarks: total,
      overallAccuracy,
      avgConfidence,
      avgLatency,
    };
  }

  /**
   * 按用户类型计算
   */
  private calculateByUserType(
    results: TestResult[],
    userProfiles: UserProfile[],
  ): TestMetrics["byUserType"] {
    const userTypeMap = new Map<string, UserProfile>();
    for (const profile of userProfiles) {
      userTypeMap.set(profile.id, profile);
    }

    const byType = new Map<
      string,
      { results: TestResult[]; userCount: Set<string> }
    >();

    for (const result of results) {
      const profile = userTypeMap.get(result.userId);
      if (!profile) continue;

      const type = profile.type;
      if (!byType.has(type)) {
        byType.set(type, { results: [], userCount: new Set() });
      }

      const entry = byType.get(type)!;
      entry.results.push(result);
      entry.userCount.add(result.userId);
    }

    return Array.from(byType.entries()).map(
      ([userType, { results, userCount }]) => {
        const correct = results.filter((r) => r.isCorrect).length;
        const accuracy = correct / results.length;
        const avgConfidence =
          results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

        return {
          userType,
          userCount: userCount.size,
          bookmarkCount: results.length,
          accuracy,
          avgConfidence,
        };
      },
    );
  }

  /**
   * 按领域计算
   */
  private calculateByDomain(results: TestResult[]): TestMetrics["byDomain"] {
    const domainResults = new Map<Domain, TestResult[]>();

    for (const result of results) {
      const domain: Domain = result.domain ?? "other";

      if (!domainResults.has(domain)) {
        domainResults.set(domain, []);
      }
      domainResults.get(domain)!.push(result);
    }

    return Array.from(domainResults.entries()).map(
      ([domain, domainResults]) => {
        const correct = domainResults.filter((r) => r.isCorrect).length;
        const accuracy = correct / domainResults.length;

        // 计算错误模式
        const errors = domainResults.filter((r) => !r.isCorrect);
        const errorMap = new Map<string, number>();

        for (const error of errors) {
          const key = `${error.expectedFolder} -> ${error.actualFolder || "null"}`;
          errorMap.set(key, (errorMap.get(key) || 0) + 1);
        }

        const topErrors = Array.from(errorMap.entries())
          .map(([pattern, count]) => {
            const [expected, actual] = pattern.split(" -> ");
            return {
              expectedFolder: expected,
              actualFolder: actual,
              count,
            };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          domain,
          bookmarkCount: domainResults.length,
          accuracy,
          topErrors,
        };
      },
    );
  }

  /**
   * 按策略计算
   */
  private calculateByStrategy(
    results: TestResult[],
  ): TestMetrics["byStrategy"] {
    const byStrategy = new Map<string, TestResult[]>();

    for (const result of results) {
      const strategy = result.strategy || "UNKNOWN";
      if (!byStrategy.has(strategy)) {
        byStrategy.set(strategy, []);
      }
      byStrategy.get(strategy)!.push(result);
    }

    const total = results.length;

    return Array.from(byStrategy.entries()).map(
      ([strategy, strategyResults]) => {
        const correct = strategyResults.filter((r) => r.isCorrect).length;
        const accuracy = correct / strategyResults.length;
        const avgLatency =
          strategyResults.reduce((sum, r) => sum + r.latencyMs, 0) /
          strategyResults.length;

        return {
          strategy,
          usageCount: strategyResults.length,
          usageRate: strategyResults.length / total,
          accuracy,
          avgLatency,
        };
      },
    );
  }

  /**
   * 分析错误
   */
  private analyzeErrors(results: TestResult[]): TestMetrics["errorAnalysis"] {
    const errors = results.filter((r) => !r.isCorrect);

    const errorTypes = {
      falsePositive: 0, // 误分类（分类到错误文件夹）
      falseNegative: 0, // 未分类（返回 null）
      wrongFolder: 0, // 分类到错误文件夹
    };

    for (const error of errors) {
      if (error.actualFolder === null) {
        errorTypes.falseNegative++;
      } else {
        errorTypes.falsePositive++;
        errorTypes.wrongFolder++;
      }
    }

    // 分析错误模式
    const errorPatterns = new Map<
      string,
      { count: number; examples: TestResult[] }
    >();

    for (const error of errors) {
      const pattern = `${error.expectedFolder} -> ${error.actualFolder || "null"}`;
      if (!errorPatterns.has(pattern)) {
        errorPatterns.set(pattern, { count: 0, examples: [] });
      }
      const entry = errorPatterns.get(pattern)!;
      entry.count++;
      if (entry.examples.length < 3) {
        entry.examples.push(error);
      }
    }

    const topErrorPatterns = Array.from(errorPatterns.entries())
      .map(([pattern, { count, examples }]) => ({
        pattern,
        count,
        examples: examples.map((e) => ({
          id: e.bookmarkId,
          title: e.title,
          expectedFolder: e.expectedFolder,
          expectedFolderName: e.expectedFolderName,
          actualFolder: e.actualFolder,
          actualFolderName: e.actualFolderName,
          domain: e.domain,
        })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: errors.length,
      errorTypes,
      topErrorPatterns,
    };
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    const summary = this.calculateSummary(results);

    // 准确率建议
    if (summary.overallAccuracy < 0.8) {
      recommendations.push(
        `整体准确率 ${(summary.overallAccuracy * 100).toFixed(1)}% 低于目标 80%，建议优化分类算法`,
      );
    }

    // 置信度建议
    if (summary.avgConfidence < 0.7) {
      recommendations.push(
        `平均置信度 ${summary.avgConfidence.toFixed(2)} 较低，建议提升分类确定性`,
      );
    } else if (summary.avgConfidence > 0.9) {
      recommendations.push(
        `平均置信度 ${summary.avgConfidence.toFixed(2)} 可能过高，建议进行置信度校准`,
      );
    }

    // 性能建议
    if (summary.avgLatency > 500) {
      recommendations.push(
        `平均延迟 ${summary.avgLatency.toFixed(0)}ms 较高，建议优化性能`,
      );
    }

    // 策略分布建议
    const byStrategy = this.calculateByStrategy(results);
    const l3Usage = byStrategy.find((s) => s.strategy === "L3_LLM");
    if (l3Usage && l3Usage.usageRate > 0.2) {
      recommendations.push(
        `L3 LLM 使用率 ${(l3Usage.usageRate * 100).toFixed(1)}% 较高，建议优化 L1/L2 层以减少成本`,
      );
    }

    return recommendations;
  }
}
