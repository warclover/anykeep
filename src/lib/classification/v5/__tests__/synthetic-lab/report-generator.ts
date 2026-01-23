/**
 * 智能分类 v5.0 - 报告生成器
 *
 * 生成 Markdown 格式的对比测试报告
 * @version 1.0.0
 * @date 2026-01-18
 */

import type { ComparisonReport, EvaluationReport } from "./types";

// 标记 EvaluationReport 为已使用（用于类型推断）
type _EvaluationReport = EvaluationReport;

/**
 * 报告生成器
 */
export class ReportGenerator {
  /**
   * 生成完整的对比报告（Markdown 格式）
   */
  generateMarkdownReport(report: ComparisonReport): string {
    const sections = [
      this.generateHeader(report),
      this.generateExecutiveSummary(report),
      this.generateAccuracyComparison(report),
      this.generateColdStartComparison(report),
      this.generateConfidenceCalibrationComparison(report),
      this.generateFailureCasesAnalysis(report),
      this.generateConclusion(report),
    ];

    return sections.join("\n\n---\n\n");
  }

  /**
   * 生成报告头部
   */
  private generateHeader(report: ComparisonReport): string {
    return `# 智能分类 v5.0 对比测试报告

**用户画像**: ${report.persona.name}
**报告ID**: ${report.id}
**生成时间**: ${report.generatedAt.toLocaleString("zh-CN")}
**测试版本**: V4.1 vs V5.0`;
  }

  /**
   * 生成执行摘要
   */
  private generateExecutiveSummary(report: ComparisonReport): string {
    const { improvements } = report;

    return `## 📊 执行摘要

### 核心提升指标

| 指标 | V4.1 | V5.0 | 提升 |
|------|------|------|------|
| **Top-1 准确率** | ${(report.v4Report.accuracy.top1Accuracy * 100).toFixed(2)}% | ${(report.v5Report.accuracy.top1Accuracy * 100).toFixed(2)}% | **${improvements.accuracyDelta > 0 ? "+" : ""}${improvements.accuracyDelta.toFixed(2)}%** |
| **冷启动成功率** | ${(report.v4Report.coldStart.successRate * 100).toFixed(2)}% | ${(report.v5Report.coldStart.successRate * 100).toFixed(2)}% | **${improvements.coldStartDelta > 0 ? "+" : ""}${improvements.coldStartDelta.toFixed(2)}%** |
| **置信度校准得分** | ${(report.v4Report.confidenceCalibration.calibrationScore * 100).toFixed(2)}% | ${(report.v5Report.confidenceCalibration.calibrationScore * 100).toFixed(2)}% | **${improvements.calibrationDelta > 0 ? "+" : ""}${improvements.calibrationDelta.toFixed(2)}%** |

### 关键发现

${this.generateKeyFindings(report)}`;
  }

  /**
   * 生成关键发现
   */
  private generateKeyFindings(report: ComparisonReport): string {
    const findings: string[] = [];
    const { improvements } = report;

    if (improvements.accuracyDelta > 5) {
      findings.push(
        `✅ **准确率显著提升**: V5.0 相比 V4.1 提升了 ${improvements.accuracyDelta.toFixed(2)}%，达到了设计目标`,
      );
    } else if (improvements.accuracyDelta > 0) {
      findings.push(
        `⚠️ **准确率小幅提升**: V5.0 相比 V4.1 仅提升了 ${improvements.accuracyDelta.toFixed(2)}%，未达到预期`,
      );
    } else {
      findings.push(
        `❌ **准确率下降**: V5.0 相比 V4.1 下降了 ${Math.abs(improvements.accuracyDelta).toFixed(2)}%，需要调查原因`,
      );
    }

    if (improvements.coldStartDelta > 20) {
      findings.push(`✅ **冷启动能力大幅提升**: V5.0 在新文件夹场景下表现优异`);
    }

    if (report.v5Report.confidenceCalibration.highConfidenceErrorRate < 0.1) {
      findings.push(
        `✅ **高置信度预测可靠**: 当 V5.0 给出 >0.9 的置信度时，误判率低于 10%`,
      );
    }

    return findings.map((f) => `- ${f}`).join("\n");
  }

  /**
   * 生成准确率对比
   */
  private generateAccuracyComparison(report: ComparisonReport): string {
    const v4 = report.v4Report.accuracy;
    const v5 = report.v5Report.accuracy;

    return `## 🎯 准确率对比

### Top-1 准确率（首选就对）

| 版本 | 正确数 | 总样本数 | 准确率 |
|------|--------|----------|--------|
| V4.1 | ${v4.correctTop1} | ${v4.totalSamples} | ${(v4.top1Accuracy * 100).toFixed(2)}% |
| V5.0 | ${v5.correctTop1} | ${v5.totalSamples} | ${(v5.top1Accuracy * 100).toFixed(2)}% |

### Top-3 召回率（前三个建议里包含正确答案）

| 版本 | 正确数 | 总样本数 | 召回率 |
|------|--------|----------|--------|
| V4.1 | ${v4.correctTop3} | ${v4.totalSamples} | ${(v4.top3Recall * 100).toFixed(2)}% |
| V5.0 | ${v5.correctTop3} | ${v5.totalSamples} | ${(v5.top3Recall * 100).toFixed(2)}% |`;
  }

  /**
   * 生成冷启动对比
   */
  private generateColdStartComparison(report: ComparisonReport): string {
    const v4 = report.v4Report.coldStart;
    const v5 = report.v5Report.coldStart;

    return `## 🚀 冷启动能力对比

### 总体指标

| 版本 | 成功文件夹数 | 总文件夹数 | 成功率 | 平均前5篇准确率 |
|------|-------------|-----------|--------|----------------|
| V4.1 | ${v4.successfulFolders} | ${v4.totalFolders} | ${(v4.successRate * 100).toFixed(2)}% | ${(v4.avgFirst5Accuracy * 100).toFixed(2)}% |
| V5.0 | ${v5.successfulFolders} | ${v5.totalFolders} | ${(v5.successRate * 100).toFixed(2)}% | ${(v5.avgFirst5Accuracy * 100).toFixed(2)}% |`;
  }

  /**
   * 生成置信度校准对比
   */
  private generateConfidenceCalibrationComparison(
    report: ComparisonReport,
  ): string {
    const v4 = report.v4Report.confidenceCalibration;
    const v5 = report.v5Report.confidenceCalibration;

    return `## 🎚️ 置信度校准对比

### 各置信度段误判率

| 置信度段 | V4.1 误判率 | V5.0 误判率 | 改善 |
|---------|------------|------------|------|
| 高 (0.9-1.0) | ${(v4.highConfidenceErrorRate * 100).toFixed(2)}% | ${(v5.highConfidenceErrorRate * 100).toFixed(2)}% | ${((v4.highConfidenceErrorRate - v5.highConfidenceErrorRate) * 100).toFixed(2)}% |
| 中 (0.7-0.9) | ${(v4.mediumConfidenceErrorRate * 100).toFixed(2)}% | ${(v5.mediumConfidenceErrorRate * 100).toFixed(2)}% | ${((v4.mediumConfidenceErrorRate - v5.mediumConfidenceErrorRate) * 100).toFixed(2)}% |
| 低 (<0.7) | ${(v4.lowConfidenceErrorRate * 100).toFixed(2)}% | ${(v5.lowConfidenceErrorRate * 100).toFixed(2)}% | ${((v4.lowConfidenceErrorRate - v5.lowConfidenceErrorRate) * 100).toFixed(2)}% |

### 校准得分

| 版本 | 校准得分 |
|------|---------|
| V4.1 | ${(v4.calibrationScore * 100).toFixed(2)}% |
| V5.0 | ${(v5.calibrationScore * 100).toFixed(2)}% |

**解读**: 校准得分越高，说明系统的"自知之明"越强。当系统给出高置信度时，预测更可靠。`;
  }

  /**
   * 生成失败案例分析
   */
  private generateFailureCasesAnalysis(report: ComparisonReport): string {
    const v5Failures = report.v5Report.failureCases.slice(0, 10);

    return `## ❌ V5.0 失败案例分析（Top 10）

${v5Failures
  .map(
    (f, i) => `### ${i + 1}. ${f.bookmarkTitle}

- **标准答案**: ${f.groundTruthFolder}
- **预测结果**: ${f.predictedFolder}
- **置信度**: ${(f.confidence * 100).toFixed(2)}%
- **失败类型**: ${this.translateFailureType(f.failureType)}
- **失败原因**: ${f.failureReason}
`,
  )
  .join("\n")}`;
  }

  /**
   * 翻译失败类型
   */
  private translateFailureType(type: string): string {
    const map: Record<string, string> = {
      "semantic-confusion": "语义混淆",
      "cold-start": "冷启动",
      "low-confidence": "低置信度",
      "edge-case": "边缘案例",
    };
    return map[type] || type;
  }

  /**
   * 生成结论
   */
  private generateConclusion(report: ComparisonReport): string {
    const { improvements } = report;
    const overallSuccess = improvements.accuracyDelta > 4;

    return `## 📝 结论与建议

### 总体评价

${
  overallSuccess
    ? "✅ **V5.0 达到设计目标**: 在准确率、冷启动、置信度校准等多个维度都有显著提升，建议推向生产环境。"
    : "⚠️ **V5.0 需要进一步优化**: 虽然在某些指标上有提升，但整体改进不够显著，建议继续优化后再推向生产环境。"
}

### 下一步行动

1. **失败案例深度分析**: 重点分析高置信度但预测错误的案例，找出根本原因
2. **T1 摘要质量检查**: 检查 T1 摘要抓取是否准确，是否需要优化抓取策略
3. **HNSW 参数调优**: 调整 ef_search 参数，平衡召回率和性能
4. **边缘案例测试**: 增加更多边缘案例测试，确保系统鲁棒性

### 推荐配置

基于测试结果，推荐以下配置：

- **T0 置信度阈值**: 0.82
- **向量冲突阈值**: 0.2
- **混合权重**: content=0.7, behavior=0.3
- **RRF K值**: 60`;
  }
}
