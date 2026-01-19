/**
 * 智能分类 v5.0 - 对比测试运行器
 *
 * 运行 V4.1 vs V5.0 的对比测试
 * @version 1.0.0
 * @date 2026-01-18
 */

import type {
  GoldenDataset,
  BatchClassificationResult,
  ClassificationResult,
  EvaluationReport,
  ComparisonReport,
  _UserPersona,
} from './types';
import { MetricsCalculator } from './metrics-calculator';

/**
 * 分类引擎接口
 */
export interface ClassificationEngine {
  /** 引擎版本 */
  version: 'v4.1' | 'v5.0';
  /** 分类方法 */
  classify(request: {
    userId: string;
    bookmarkId: string;
    title: string;
    url: string;
    description?: string;
    summary?: string;
    tags?: string[];
  }): Promise<ClassificationResult>;
}

/**
 * 对比测试配置
 */
export interface ComparisonConfig {
  /** 是否并行运行 */
  parallel: boolean;
  /** 超时时间（毫秒） */
  timeoutMs: number;
  /** 是否详细日志 */
  verbose: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ComparisonConfig = {
  parallel: false,
  timeoutMs: 300000, // 5分钟
  verbose: true,
};

/**
 * 对比测试运行器
 */
export class ComparisonRunner {
  private metricsCalculator: MetricsCalculator;
  private config: ComparisonConfig;

  constructor(config?: Partial<ComparisonConfig>) {
    this.metricsCalculator = new MetricsCalculator();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 运行对比测试
   */
  async runComparison(
    dataset: GoldenDataset,
    v4Engine: ClassificationEngine,
    v5Engine: ClassificationEngine
  ): Promise<ComparisonReport> {
    this.log(`开始对比测试: ${dataset.name}`);
    this.log(`测试书签数量: ${dataset.bookmarks.length}`);

    // 运行 V4.1 测试
    this.log('\n=== 运行 V4.1 测试 ===');
    const v4Result = await this.runBatchClassification(
      dataset,
      v4Engine,
      'v4.1'
    );

    // 运行 V5.0 测试
    this.log('\n=== 运行 V5.0 测试 ===');
    const v5Result = await this.runBatchClassification(
      dataset,
      v5Engine,
      'v5.0'
    );

    // 生成评估报告
    this.log('\n=== 生成评估报告 ===');
    const v4Report = this.generateEvaluationReport(dataset, v4Result);
    const v5Report = this.generateEvaluationReport(dataset, v5Result);

    // 计算提升指标
    const improvements = this.calculateImprovements(v4Report, v5Report);

    this.log('\n=== 对比测试完成 ===');
    this.logImprovements(improvements);

    return {
      id: `comparison-${dataset.id}-${Date.now()}`,
      name: `${dataset.persona.name} - V4.1 vs V5.0 对比报告`,
      persona: dataset.persona,
      v4Report,
      v5Report,
      improvements,
      generatedAt: new Date(),
    };
  }

  /**
   * 运行批量分类测试
   */
  private async runBatchClassification(
    dataset: GoldenDataset,
    engine: ClassificationEngine,
    version: 'v4.1' | 'v5.0'
  ): Promise<BatchClassificationResult> {
    const startTime = Date.now();
    const results: ClassificationResult[] = [];

    for (let i = 0; i < dataset.bookmarks.length; i++) {
      const bookmark = dataset.bookmarks[i];
      this.log(`[${version}] 分类进度: ${i + 1}/${dataset.bookmarks.length}`);

      try {
        const result = await engine.classify({
          userId: 'test-user',
          bookmarkId: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description,
          summary: bookmark.summary,
          tags: bookmark.tags,
        });
        results.push(result);
      } catch (error) {
        this.log(`[${version}] 分类失败: ${bookmark.id}`, error);
        // 添加失败结果
        results.push({
          bookmarkId: bookmark.id,
          predictedFolderId: 'error',
          predictedFolderName: 'Error',
          confidence: 0,
          topCandidates: [],
          usedT1: false,
          latencyMs: 0,
        });
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    const avgLatencyMs = totalLatencyMs / results.length;

    return {
      version,
      persona: dataset.persona,
      results,
      totalLatencyMs,
      avgLatencyMs,
      timestamp: new Date(),
    };
  }

  /**
   * 生成评估报告
   */
  private generateEvaluationReport(
    dataset: GoldenDataset,
    batchResult: BatchClassificationResult
  ): EvaluationReport {
    const accuracy = this.metricsCalculator.calculateAccuracy(
      dataset.bookmarks,
      batchResult.results
    );

    const coldStart = this.metricsCalculator.calculateColdStart(
      dataset.persona,
      dataset.bookmarks,
      batchResult.results
    );

    const confidenceCalibration =
      this.metricsCalculator.calculateConfidenceCalibration(
        dataset.bookmarks,
        batchResult.results
      );

    const failureCases = this.metricsCalculator.extractFailureCases(
      dataset.bookmarks,
      batchResult.results,
      20
    );

    // 语义漂移指标（简化版，实际需要向量数据）
    const semanticDrift = {
      stabilityScore: 0.85,
      totalFolders: dataset.persona.folders.length,
      avgCentroidDrift: 0.15,
      details: [],
    };

    return {
      id: `report-${batchResult.version}-${Date.now()}`,
      name: `${dataset.persona.name} - ${batchResult.version} 评估报告`,
      version: batchResult.version,
      persona: dataset.persona,
      accuracy,
      coldStart,
      semanticDrift,
      confidenceCalibration,
      failureCases,
      generatedAt: new Date(),
    };
  }

  /**
   * 计算提升指标
   */
  private calculateImprovements(
    v4Report: EvaluationReport,
    v5Report: EvaluationReport
  ) {
    const accuracyDelta = this.metricsCalculator.calculateAccuracyDelta(
      v4Report.accuracy,
      v5Report.accuracy
    );

    const coldStartDelta =
      ((v5Report.coldStart.successRate - v4Report.coldStart.successRate) /
        v4Report.coldStart.successRate) *
      100;

    const driftStabilityDelta =
      ((v5Report.semanticDrift.stabilityScore -
        v4Report.semanticDrift.stabilityScore) /
        v4Report.semanticDrift.stabilityScore) *
      100;

    const calibrationDelta =
      ((v5Report.confidenceCalibration.calibrationScore -
        v4Report.confidenceCalibration.calibrationScore) /
        v4Report.confidenceCalibration.calibrationScore) *
      100;

    return {
      accuracyDelta,
      coldStartDelta,
      driftStabilityDelta,
      calibrationDelta,
    };
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: any[]) {
    if (this.config.verbose) {
      console.log(message, ...args);
    }
  }

  /**
   * 输出提升指标
   */
  private logImprovements(improvements: ComparisonReport['improvements']) {
    console.log('\n📊 提升指标汇总:');
    console.log(`  准确率提升: ${improvements.accuracyDelta.toFixed(2)}%`);
    console.log(`  冷启动提升: ${improvements.coldStartDelta.toFixed(2)}%`);
    console.log(
      `  漂移稳定性提升: ${improvements.driftStabilityDelta.toFixed(2)}%`
    );
    console.log(
      `  置信度校准提升: ${improvements.calibrationDelta.toFixed(2)}%`
    );
  }
}
