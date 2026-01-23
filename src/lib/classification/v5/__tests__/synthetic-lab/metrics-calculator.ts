/**
 * 智能分类 v5.0 - 评估指标计算器
 *
 * 计算多维度评估指标
 * @version 1.0.0
 * @date 2026-01-18
 */

import type {
  TestBookmark,
  ClassificationResult,
  AccuracyMetrics,
  ColdStartMetrics,
  ConfidenceCalibrationMetrics,
  FailureCase,
  UserPersona,
} from "./types";

/**
 * 评估指标计算器
 */
export class MetricsCalculator {
  /**
   * 计算准确率指标
   */
  calculateAccuracy(
    testBookmarks: TestBookmark[],
    results: ClassificationResult[],
  ): AccuracyMetrics {
    let correctTop1 = 0;
    let correctTop3 = 0;
    const totalSamples = testBookmarks.length;

    for (let i = 0; i < testBookmarks.length; i++) {
      const bookmark = testBookmarks[i];
      const result = results[i];

      // Top-1 准确率：首选就对
      if (result.predictedFolderId === bookmark.groundTruthFolderId) {
        correctTop1++;
        correctTop3++; // Top-1 对了，Top-3 也算对
      } else {
        // Top-3 召回率：前三个建议里包含正确答案
        const top3FolderIds = result.topCandidates
          .slice(0, 3)
          .map((c) => c.folderId);
        if (top3FolderIds.includes(bookmark.groundTruthFolderId)) {
          correctTop3++;
        }
      }
    }

    return {
      top1Accuracy: totalSamples > 0 ? correctTop1 / totalSamples : 0,
      top3Recall: totalSamples > 0 ? correctTop3 / totalSamples : 0,
      totalSamples,
      correctTop1,
      correctTop3,
    };
  }

  /**
   * 计算准确率提升
   */
  calculateAccuracyDelta(
    v4Accuracy: AccuracyMetrics,
    v5Accuracy: AccuracyMetrics,
  ): number {
    if (v4Accuracy.top1Accuracy === 0) return 0;
    return (
      ((v5Accuracy.top1Accuracy - v4Accuracy.top1Accuracy) /
        v4Accuracy.top1Accuracy) *
      100
    );
  }

  /**
   * 计算冷启动指标
   * 针对空文件夹或新创建的文件夹，模拟存入前 5 篇书签
   */
  calculateColdStart(
    persona: UserPersona,
    testBookmarks: TestBookmark[],
    results: ClassificationResult[],
  ): ColdStartMetrics {
    const folderMetrics = new Map<string, { correct: number; total: number }>();

    // 按文件夹分组统计前5篇的准确率
    for (const folder of persona.folders) {
      const folderBookmarks = testBookmarks
        .filter((b) => b.groundTruthFolderId === folder.id)
        .slice(0, 5); // 只取前5篇

      if (folderBookmarks.length === 0) continue;

      let correct = 0;
      for (const bookmark of folderBookmarks) {
        const result = results.find((r) => r.bookmarkId === bookmark.id);
        if (
          result &&
          result.predictedFolderId === bookmark.groundTruthFolderId
        ) {
          correct++;
        }
      }

      folderMetrics.set(folder.id, {
        correct,
        total: folderBookmarks.length,
      });
    }

    // 计算总体指标
    let totalCorrect = 0;
    let totalSamples = 0;
    const details: ColdStartMetrics["details"] = [];

    for (const folder of persona.folders) {
      const metrics = folderMetrics.get(folder.id);
      if (!metrics) continue;

      const accuracy = metrics.total > 0 ? metrics.correct / metrics.total : 0;
      totalCorrect += metrics.correct;
      totalSamples += metrics.total;

      details.push({
        folderId: folder.id,
        folderName: folder.name,
        first5Accuracy: accuracy,
      });
    }

    const successfulFolders = details.filter(
      (d) => d.first5Accuracy >= 0.8,
    ).length;

    return {
      successRate: details.length > 0 ? successfulFolders / details.length : 0,
      totalFolders: details.length,
      successfulFolders,
      avgFirst5Accuracy: totalSamples > 0 ? totalCorrect / totalSamples : 0,
      details,
    };
  }

  /**
   * 计算置信度校准指标
   * 评估：当系统给出高分时，用户修正的比例
   */
  calculateConfidenceCalibration(
    testBookmarks: TestBookmark[],
    results: ClassificationResult[],
  ): ConfidenceCalibrationMetrics {
    const ranges = [
      { name: "high", min: 0.9, max: 1.0 },
      { name: "medium", min: 0.7, max: 0.9 },
      { name: "low", min: 0.0, max: 0.7 },
    ];

    const rangeStats = ranges.map((range) => {
      const resultsInRange = results.filter(
        (r) => r.confidence >= range.min && r.confidence < range.max,
      );

      let errorCount = 0;
      for (const result of resultsInRange) {
        const bookmark = testBookmarks.find((b) => b.id === result.bookmarkId);
        if (
          bookmark &&
          result.predictedFolderId !== bookmark.groundTruthFolderId
        ) {
          errorCount++;
        }
      }

      return {
        confidenceRange: `${range.name} (${range.min}-${range.max})`,
        totalSamples: resultsInRange.length,
        errorCount,
        errorRate:
          resultsInRange.length > 0 ? errorCount / resultsInRange.length : 0,
      };
    });

    // 计算校准得分：高置信度段的误判率越低越好
    const highConfidenceErrorRate = rangeStats[0].errorRate;
    const calibrationScore = 1 - highConfidenceErrorRate;

    return {
      highConfidenceErrorRate: rangeStats[0].errorRate,
      mediumConfidenceErrorRate: rangeStats[1].errorRate,
      lowConfidenceErrorRate: rangeStats[2].errorRate,
      calibrationScore,
      details: rangeStats,
    };
  }

  /**
   * 提取失败案例
   */
  extractFailureCases(
    testBookmarks: TestBookmark[],
    results: ClassificationResult[],
    maxCases: number = 20,
  ): FailureCase[] {
    const failures: FailureCase[] = [];

    for (let i = 0; i < testBookmarks.length; i++) {
      const bookmark = testBookmarks[i];
      const result = results[i];

      if (result.predictedFolderId !== bookmark.groundTruthFolderId) {
        failures.push({
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          groundTruthFolder: bookmark.groundTruthFolderId,
          predictedFolder: result.predictedFolderId,
          confidence: result.confidence,
          failureReason: this.analyzeFailureReason(bookmark, result),
          failureType: this.classifyFailureType(bookmark, result),
        });
      }
    }

    // 按置信度降序排序，优先分析高置信度的错误
    return failures
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxCases);
  }

  /**
   * 分析失败原因
   */
  private analyzeFailureReason(
    bookmark: TestBookmark,
    result: ClassificationResult,
  ): string {
    if (result.confidence < 0.7) {
      return "置信度过低，系统不确定";
    }
    if (result.usedT1) {
      return "T1 摘要可能抓取不准确";
    }
    return "语义混淆或文件夹边界模糊";
  }

  /**
   * 分类失败类型
   */
  private classifyFailureType(
    bookmark: TestBookmark,
    result: ClassificationResult,
  ): FailureCase["failureType"] {
    if (result.confidence < 0.7) {
      return "low-confidence";
    }
    if (bookmark.source === "edge-case") {
      return "edge-case";
    }
    if (bookmark.source === "similar-content") {
      return "semantic-confusion";
    }
    return "cold-start";
  }
}
