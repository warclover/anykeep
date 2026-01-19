/**
 * 智能分类 v5.0 - 合成用户实验室类型定义
 *
 * 用于构建科学的分类性能测试框架
 * @version 1.0.0
 * @date 2026-01-18
 */

// ============================================
// 用户画像类型
// ============================================

/**
 * 用户画像类型
 */
export type UserPersonaType = 'hardcore-dev' | 'knowledge-omnivore' | 'minimalist' | 'chaotic-hoarder';

/**
 * 用户画像定义
 */
export interface UserPersona {
  /** 画像ID */
  id: string;
  /** 画像类型 */
  type: UserPersonaType;
  /** 画像名称 */
  name: string;
  /** 画像描述 */
  description: string;
  /** 文件夹结构 */
  folders: FolderStructure[];
  /** 测试重点 */
  testFocus: string[];
  /** 特征标签 */
  characteristics: string[];
}

/**
 * 文件夹结构定义
 */
export interface FolderStructure {
  /** 文件夹ID */
  id: string;
  /** 文件夹名称 */
  name: string;
  /** 父文件夹ID */
  parentId?: string;
  /** 文件夹描述 */
  description?: string;
  /** 预期的书签主题 */
  expectedTopics: string[];
  /** 初始书签数量 */
  initialBookmarkCount: number;
}

// ============================================
// 测试数据类型
// ============================================

/**
 * 测试书签
 */
export interface TestBookmark {
  /** 书签ID */
  id: string;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 描述 */
  description?: string;
  /** 摘要 */
  summary?: string;
  /** 标签 */
  tags?: string[];
  /** 内容 */
  content?: string;
  /** 标准答案（应该分类到的文件夹ID） */
  groundTruthFolderId: string;
  /** 标准答案置信度 */
  groundTruthConfidence: number;
  /** 来源 */
  source: string;
  /** 主题分类 */
  topics: string[];
}

/**
 * 黄金评估集
 */
export interface GoldenDataset {
  /** 数据集ID */
  id: string;
  /** 数据集名称 */
  name: string;
  /** 数据集描述 */
  description: string;
  /** 用户画像 */
  persona: UserPersona;
  /** 测试书签列表 */
  bookmarks: TestBookmark[];
  /** 创建时间 */
  createdAt: Date;
  /** 版本 */
  version: string;
}

// ============================================
// 分类结果类型
// ============================================

/**
 * 分类结果
 */
export interface ClassificationResult {
  /** 书签ID */
  bookmarkId: string;
  /** 预测的文件夹ID */
  predictedFolderId: string;
  /** 预测的文件夹名称 */
  predictedFolderName: string;
  /** 置信度 */
  confidence: number;
  /** Top-3 候选 */
  topCandidates: Array<{
    folderId: string;
    folderName: string;
    confidence: number;
  }>;
  /** 是否使用 T1 */
  usedT1: boolean;
  /** 延迟（毫秒） */
  latencyMs: number;
  /** 推理过程 */
  reasoning?: string;
}

/**
 * 批量分类结果
 */
export interface BatchClassificationResult {
  /** 版本标识 */
  version: 'v4.1' | 'v5.0';
  /** 用户画像 */
  persona: UserPersona;
  /** 分类结果列表 */
  results: ClassificationResult[];
  /** 总耗时 */
  totalLatencyMs: number;
  /** 平均延迟 */
  avgLatencyMs: number;
  /** 测试时间 */
  timestamp: Date;
}

// ============================================
// 评估指标类型
// ============================================

/**
 * 准确率指标
 */
export interface AccuracyMetrics {
  /** Top-1 准确率 */
  top1Accuracy: number;
  /** Top-3 召回率 */
  top3Recall: number;
  /** 总样本数 */
  totalSamples: number;
  /** 正确样本数（Top-1） */
  correctTop1: number;
  /** 正确样本数（Top-3） */
  correctTop3: number;
}

/**
 * 冷启动指标
 */
export interface ColdStartMetrics {
  /** 冷启动成功率 */
  successRate: number;
  /** 测试的文件夹数量 */
  totalFolders: number;
  /** 成功的文件夹数量 */
  successfulFolders: number;
  /** 平均前5篇准确率 */
  avgFirst5Accuracy: number;
  /** 详细结果 */
  details: Array<{
    folderId: string;
    folderName: string;
    first5Accuracy: number;
  }>;
}

/**
 * 语义漂移指标
 */
export interface SemanticDriftMetrics {
  /** 漂移稳定性得分（0-1，越高越稳定） */
  stabilityScore: number;
  /** 测试的文件夹数量 */
  totalFolders: number;
  /** 平均质心偏移距离 */
  avgCentroidDrift: number;
  /** 详细结果 */
  details: Array<{
    folderId: string;
    folderName: string;
    initialCentroid: number[];
    finalCentroid: number[];
    driftDistance: number;
  }>;
}

/**
 * 置信度校准指标
 */
export interface ConfidenceCalibrationMetrics {
  /** 高置信度段（>0.9）误判率 */
  highConfidenceErrorRate: number;
  /** 中置信度段（0.7-0.9）误判率 */
  mediumConfidenceErrorRate: number;
  /** 低置信度段（<0.7）误判率 */
  lowConfidenceErrorRate: number;
  /** 校准得分（0-1，越高越好） */
  calibrationScore: number;
  /** 详细结果 */
  details: Array<{
    confidenceRange: string;
    totalSamples: number;
    errorCount: number;
    errorRate: number;
  }>;
}

/**
 * 综合评估报告
 */
export interface EvaluationReport {
  /** 报告ID */
  id: string;
  /** 报告名称 */
  name: string;
  /** 测试版本 */
  version: 'v4.1' | 'v5.0';
  /** 用户画像 */
  persona: UserPersona;
  /** 准确率指标 */
  accuracy: AccuracyMetrics;
  /** 冷启动指标 */
  coldStart: ColdStartMetrics;
  /** 语义漂移指标 */
  semanticDrift: SemanticDriftMetrics;
  /** 置信度校准指标 */
  confidenceCalibration: ConfidenceCalibrationMetrics;
  /** 失败案例 */
  failureCases: FailureCase[];
  /** 生成时间 */
  generatedAt: Date;
}

/**
 * 失败案例
 */
export interface FailureCase {
  /** 书签ID */
  bookmarkId: string;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 标准答案文件夹 */
  groundTruthFolder: string;
  /** 预测文件夹 */
  predictedFolder: string;
  /** 置信度 */
  confidence: number;
  /** 失败原因分析 */
  failureReason: string;
  /** 失败类型 */
  failureType: 'semantic-confusion' | 'cold-start' | 'low-confidence' | 'edge-case';
}

/**
 * 对比报告
 */
export interface ComparisonReport {
  /** 报告ID */
  id: string;
  /** 报告名称 */
  name: string;
  /** 用户画像 */
  persona: UserPersona;
  /** V4.1 报告 */
  v4Report: EvaluationReport;
  /** V5.0 报告 */
  v5Report: EvaluationReport;
  /** 提升指标 */
  improvements: {
    /** 准确率提升 */
    accuracyDelta: number;
    /** 冷启动提升 */
    coldStartDelta: number;
    /** 漂移稳定性提升 */
    driftStabilityDelta: number;
    /** 置信度校准提升 */
    calibrationDelta: number;
  };
  /** 生成时间 */
  generatedAt: Date;
}
