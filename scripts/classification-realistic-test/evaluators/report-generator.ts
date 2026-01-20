/**
 * 报告生成器
 */

import type { TestMetrics, TestReport } from "../types";

export class ReportGenerator {
  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(metrics: TestMetrics, testDuration: string): string {
    return `
# 智能分类系统 - 真实用户模拟测试报告

**测试时间**: ${new Date().toISOString()}  
**测试耗时**: ${testDuration}  
**测试规模**: ${metrics.summary.totalBookmarks} 个书签，${metrics.summary.totalUsers} 个用户

## 📊 总体表现

- **整体准确率**: ${(metrics.summary.overallAccuracy * 100).toFixed(2)}%
- **平均置信度**: ${metrics.summary.avgConfidence.toFixed(2)}
- **平均延迟**: ${metrics.summary.avgLatency.toFixed(0)}ms

## 👥 按用户类型分析

${this.generateUserTypeTable(metrics.byUserType)}

## 🌐 按领域分析

${this.generateDomainTable(metrics.byDomain)}

## ⚙️ 按策略分析

${this.generateStrategyTable(metrics.byStrategy)}

## ❌ 错误分析

${this.generateErrorAnalysis(metrics.errorAnalysis)}

## 💡 改进建议

${this.generateRecommendations(metrics.recommendations)}
`;
  }

  /**
   * 生成用户类型表格
   */
  private generateUserTypeTable(byUserType: TestMetrics["byUserType"]): string {
    const rows = byUserType
      .map(
        (item) =>
          `| ${item.userType} | ${item.userCount} | ${item.bookmarkCount} | ${(item.accuracy * 100).toFixed(1)}% | ${item.avgConfidence.toFixed(2)} |`,
      )
      .join("\n");

    return `
| 用户类型 | 用户数 | 书签数 | 准确率 | 平均置信度 |
|---------|--------|--------|--------|-----------|
${rows}
`;
  }

  /**
   * 生成领域表格
   */
  private generateDomainTable(byDomain: TestMetrics["byDomain"]): string {
    const rows = byDomain
      .map(
        (item) =>
          `| ${item.domain} | ${item.bookmarkCount} | ${(item.accuracy * 100).toFixed(1)}% |`,
      )
      .join("\n");

    return `
| 领域 | 书签数 | 准确率 |
|------|--------|--------|
${rows}
`;
  }

  /**
   * 生成策略表格
   */
  private generateStrategyTable(byStrategy: TestMetrics["byStrategy"]): string {
    const rows = byStrategy
      .map(
        (item) =>
          `| ${item.strategy} | ${item.usageCount} | ${(item.usageRate * 100).toFixed(1)}% | ${(item.accuracy * 100).toFixed(1)}% | ${item.avgLatency.toFixed(0)}ms |`,
      )
      .join("\n");

    return `
| 策略 | 使用次数 | 使用率 | 准确率 | 平均延迟 |
|------|---------|--------|--------|---------|
${rows}
`;
  }

  /**
   * 生成错误分析
   */
  private generateErrorAnalysis(
    errorAnalysis: TestMetrics["errorAnalysis"],
  ): string {
    const errorTypes = errorAnalysis.errorTypes;
    const totalErrors = errorAnalysis.totalErrors;

    if (totalErrors === 0) {
      return `
### 错误统计

- **总错误数**: 0

✅ 未发现错误样本。
`;
    }

    const patterns = errorAnalysis.topErrorPatterns
      .map((p, idx) => {
        const examples = (p.examples || [])
          .map((ex, i) => {
            const expected = ex.expectedFolderName ?? ex.expectedFolder;
            const actual = ex.actualFolderName ?? ex.actualFolder ?? "null";
            const domain = ex.domain ?? "other";
            return `  - ${idx + 1}.${i + 1} [${domain}] ${ex.title}  \n    预期: ${expected}  \n    实际: ${actual}`;
          })
          .join("\n");

        return `${idx + 1}. **${p.pattern}** (${p.count} 次)\n${examples ? `${examples}\n` : ""}`;
      })
      .join("\n");

    return `
### 错误统计

- **总错误数**: ${totalErrors}
- **误分类**: ${errorTypes.falsePositive} (${((errorTypes.falsePositive / totalErrors) * 100).toFixed(1)}%)
- **未分类**: ${errorTypes.falseNegative} (${((errorTypes.falseNegative / totalErrors) * 100).toFixed(1)}%)
- **错误文件夹**: ${errorTypes.wrongFolder} (${((errorTypes.wrongFolder / totalErrors) * 100).toFixed(1)}%)

### 主要错误模式

${patterns}
`;
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(recommendations: string[]): string {
    if (recommendations.length === 0) {
      return "✅ 暂无改进建议，系统表现良好！";
    }

    return recommendations
      .map((rec, index) => `${index + 1}. ${rec}`)
      .join("\n");
  }

  /**
   * 生成 JSON 报告（用于程序化分析）
   */
  generateJSONReport(metrics: TestMetrics, testDuration: string): string {
    const report: TestReport = {
      summary: metrics.summary,
      byUserType: metrics.byUserType,
      byDomain: metrics.byDomain,
      byStrategy: metrics.byStrategy,
      errorAnalysis: metrics.errorAnalysis,
      recommendations: metrics.recommendations,
      testDuration,
    };

    return JSON.stringify(report, null, 2);
  }
}
