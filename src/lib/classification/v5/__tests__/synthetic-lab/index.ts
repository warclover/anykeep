/**
 * 智能分类 v5.0 - 合成用户实验室测试框架
 *
 * 统一导出所有模块
 * @version 1.0.0
 * @date 2026-01-18
 */

// 类型定义
export * from './types';

// 用户画像
export * from './personas';

// 测试数据生成器
export { DatasetGenerator } from './dataset-generator';

// 评估指标计算器
export { MetricsCalculator } from './metrics-calculator';

// 对比测试运行器
export { ComparisonRunner } from './comparison-runner';
export type { ClassificationEngine, ComparisonConfig } from './comparison-runner';

// 报告生成器
export { ReportGenerator } from './report-generator';

// 测试执行脚本
export { SyntheticLabRunner, exampleUsage } from './run-synthetic-lab';
