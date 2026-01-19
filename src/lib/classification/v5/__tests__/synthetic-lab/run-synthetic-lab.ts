/**
 * 智能分类 v5.0 - 合成用户实验室测试执行脚本
 *
 * 运行完整的对比测试流程
 * @version 1.0.0
 * @date 2026-01-18
 */

import { DatasetGenerator } from './dataset-generator';
import { ComparisonRunner } from './comparison-runner';
import { ReportGenerator } from './report-generator';
import { ALL_PERSONAS } from './personas';
import type { ClassificationEngine } from './comparison-runner';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 测试配置
 */
interface TestConfig {
  /** 输出目录 */
  outputDir: string;
  /** 是否保存数据集 */
  saveDataset: boolean;
  /** 是否保存报告 */
  saveReport: boolean;
  /** 测试的用户画像（不指定则测试所有） */
  personaTypes?: string[];
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TestConfig = {
  outputDir: './test-results',
  saveDataset: true,
  saveReport: true,
};

/**
 * 合成用户实验室测试运行器
 */
export class SyntheticLabRunner {
  private config: TestConfig;
  private datasetGenerator: DatasetGenerator;
  private comparisonRunner: ComparisonRunner;
  private reportGenerator: ReportGenerator;

  constructor(config?: Partial<TestConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.datasetGenerator = new DatasetGenerator();
    this.comparisonRunner = new ComparisonRunner({ verbose: true });
    this.reportGenerator = new ReportGenerator();

    // 确保输出目录存在
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * 运行完整测试
   */
  async runFullTest(
    v4Engine: ClassificationEngine,
    v5Engine: ClassificationEngine
  ): Promise<void> {
    console.log('🧪 开始合成用户实验室测试\n');

    // 确定要测试的用户画像
    const personasToTest = this.config.personaTypes
      ? ALL_PERSONAS.filter((p) => this.config.personaTypes!.includes(p.type))
      : ALL_PERSONAS;

    console.log(`📋 测试用户画像: ${personasToTest.map((p) => p.name).join(', ')}\n`);

    // 为每个用户画像运行测试
    for (const persona of personasToTest) {
      await this.runTestForPersona(persona, v4Engine, v5Engine);
    }

    console.log('\n✅ 所有测试完成！');
    console.log(`📁 测试结果保存在: ${this.config.outputDir}`);
  }

  /**
   * 为单个用户画像运行测试
   */
  private async runTestForPersona(
    persona: any,
    v4Engine: ClassificationEngine,
    v5Engine: ClassificationEngine
  ): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎭 测试用户画像: ${persona.name}`);
    console.log(`${'='.repeat(60)}\n`);

    // 1. 生成测试数据集
    console.log('📊 生成测试数据集...');
    const dataset = await this.datasetGenerator.generateDataset(persona);
    console.log(`✅ 生成 ${dataset.bookmarks.length} 条测试书签\n`);

    // 保存数据集
    if (this.config.saveDataset) {
      const datasetPath = path.join(
        this.config.outputDir,
        `dataset-${persona.type}.json`
      );
      fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
      console.log(`💾 数据集已保存: ${datasetPath}\n`);
    }

    // 2. 运行对比测试
    console.log('🔬 运行对比测试...');
    const comparisonReport = await this.comparisonRunner.runComparison(
      dataset,
      v4Engine,
      v5Engine
    );

    // 3. 生成报告
    console.log('\n📝 生成测试报告...');
    const markdownReport = this.reportGenerator.generateMarkdownReport(comparisonReport);

    // 保存报告
    if (this.config.saveReport) {
      const reportPath = path.join(
        this.config.outputDir,
        `report-${persona.type}.md`
      );
      fs.writeFileSync(reportPath, markdownReport);
      console.log(`✅ 报告已保存: ${reportPath}`);

      // 同时保存 JSON 格式
      const jsonPath = path.join(
        this.config.outputDir,
        `report-${persona.type}.json`
      );
      fs.writeFileSync(jsonPath, JSON.stringify(comparisonReport, null, 2));
      console.log(`✅ JSON 报告已保存: ${jsonPath}`);
    }
  }
}

/**
 * 示例：如何使用测试框架
 */
export async function exampleUsage() {
  // 创建模拟的分类引擎
  const mockV4Engine: ClassificationEngine = {
    version: 'v4.1',
    async classify(request) {
      // 这里应该调用实际的 V4.1 分类服务
      return {
        bookmarkId: request.bookmarkId,
        predictedFolderId: 'folder-1',
        predictedFolderName: 'Folder 1',
        confidence: 0.85,
        topCandidates: [
          { folderId: 'folder-1', folderName: 'Folder 1', confidence: 0.85 },
          { folderId: 'folder-2', folderName: 'Folder 2', confidence: 0.75 },
        ],
        usedT1: false,
        latencyMs: 150,
      };
    },
  };

  const mockV5Engine: ClassificationEngine = {
    version: 'v5.0',
    async classify(request) {
      // 这里应该调用实际的 V5.0 分类服务
      return {
        bookmarkId: request.bookmarkId,
        predictedFolderId: 'folder-1',
        predictedFolderName: 'Folder 1',
        confidence: 0.92,
        topCandidates: [
          { folderId: 'folder-1', folderName: 'Folder 1', confidence: 0.92 },
          { folderId: 'folder-2', folderName: 'Folder 2', confidence: 0.78 },
        ],
        usedT1: true,
        latencyMs: 95,
      };
    },
  };

  // 创建测试运行器
  const runner = new SyntheticLabRunner({
    outputDir: './test-results',
    saveDataset: true,
    saveReport: true,
    personaTypes: ['hardcore-dev'], // 只测试硬核开发者画像
  });

  // 运行测试
  await runner.runFullTest(mockV4Engine, mockV5Engine);
}
