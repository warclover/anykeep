/**
 * 智能分类调试工具 - 类型定义
 *
 * 用于 V3 vs V4 分类对比调试
 */

import type {
  DecisionPath,
  ClassificationAction,
} from "@/lib/classification/types/classification";
import type { V3Config } from "@/lib/classification/v3/config";

// ============================================================================
// 对比请求/响应类型
// ============================================================================

/**
 * 测试书签输入
 */
export interface DebugBookmarkInput {
  /** URL */
  url: string;
  /** 标题 */
  title: string;
  /** 描述（可选） */
  description?: string;
  /** 标签（可选） */
  tags?: string[];
}

/**
 * 测试场景类型
 */
export type DebugScenario =
  | "cold-start" // 冷启动用户
  | "learning" // 学习期用户
  | "mature" // 成熟用户
  | "real-readonly"; // 只读真实数据

/**
 * 预设配置类型
 */
export type PresetConfigKey =
  | "default"
  | "high-precision"
  | "fast-mode"
  | "cold-start-optimized";

/**
 * 对比请求
 */
export interface CompareRequest {
  /** 测试书签数据 */
  bookmark: DebugBookmarkInput;
  /** 测试场景 */
  scenario: DebugScenario;
  /** 预设配置 */
  preset?: PresetConfigKey;
  /** 自定义 V4 配置（覆盖预设） */
  customV4Config?: Partial<V3Config>;
}

/**
 * 单版本分类结果
 */
export interface VersionResult {
  /** 推荐文件夹 ID */
  folderId: number | null;
  /** 推荐文件夹名称 */
  folderName: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 推理过程 */
  reasoning: string;
  /** 执行耗时 (ms) */
  executionTime: number;
  /** 分层级别 */
  tier: "T1" | "T2" | "T3";
  /** 分类动作 */
  action: ClassificationAction;
  /** V4 扩展信息 */
  v4Details?: {
    /** 场景权重 */
    scenarioWeight?: number;
    /** 是否命中纠错缓存 */
    correctionApplied?: boolean;
    /** 是否启用命名引擎 */
    namingEngineUsed?: boolean;
    /** 分层执行详情 */
    tieredDetails?: {
      /** 实际使用的分层 (0=缓存/兜底, 1=快速匹配, 2=AI确认, 3=自动创建) */
      tier: 0 | 1 | 2 | 3;
      /** 是否调用了 AI */
      aiCalled: boolean;
      /** 各层耗时 */
      timings: {
        tier0Ms?: number;
        tier1Ms?: number;
        tier2Ms?: number;
        tier3Ms?: number;
      };
      /** 追踪 ID */
      traceId: string;
    };
  };
  /** 完整决策路径（可选，用于深度调试） */
  decisionPath?: DecisionPath;
}

/**
 * 差异分析
 */
export interface ComparisonDiff {
  /** 是否推荐同一文件夹 */
  sameFolder: boolean;
  /** 置信度差异 */
  confidenceDiff: number;
  /** 置信度差异百分比 */
  confidenceDiffPercent: number;
  /** 耗时差异 (ms) */
  timeDiff: number;
  /** 分层差异 */
  tierDiff: string | null;
  /** V4 改进点 */
  v4Improvements: string[];
}

/**
 * 对比响应
 */
export interface CompareResponse {
  /** 是否成功 */
  success: boolean;
  /** V3 结果 */
  v3Result: VersionResult;
  /** V4 结果 */
  v4Result: VersionResult;
  /** 差异分析 */
  comparison: ComparisonDiff;
  /** 错误信息（如果失败） */
  error?: string;
  /** 使用的配置摘要 */
  configSummary: {
    scenario: DebugScenario;
    preset: PresetConfigKey | "custom";
    v4Features: string[];
  };
}

// ============================================================================
// Mock 场景类型
// ============================================================================

/**
 * Mock 文件夹
 */
export interface MockFolder {
  /** 文件夹 ID */
  id: string;
  /** 文件夹名称 */
  name: string;
  /** 书签数量 */
  bookmarkCount: number;
  /** 代表性标签 */
  topTags?: string[];
}

/**
 * Mock 分类历史
 */
export interface MockHistoryItem {
  /** 书签标题 */
  title: string;
  /** 分类到的文件夹 */
  folderId: string;
  /** 分类置信度 */
  confidence: number;
}

/**
 * Mock 场景数据
 */
export interface MockScenarioData {
  /** 用户 ID */
  userId: string;
  /** 场景描述 */
  description: string;
  /** 文件夹列表 */
  folders: MockFolder[];
  /** 分类历史 */
  classificationHistory: MockHistoryItem[];
  /** 用户画像 */
  profile: {
    /** 场景阶段 */
    scenario: "cold_start" | "learning" | "growing" | "mature";
    /** 总书签数 */
    totalBookmarks: number;
    /** 主要兴趣领域 */
    mainInterests?: string[];
  };
  /** 是否使用真实数据 */
  useRealData?: boolean;
  /** 强制只读模式 */
  dryRun?: boolean;
}

// ============================================================================
// 预设配置类型
// ============================================================================

/**
 * 预设配置项
 */
export interface PresetConfig {
  /** 预设名称 */
  name: string;
  /** 预设描述 */
  description: string;
  /** V4 配置 */
  v4Config: Partial<V3Config>;
}

/**
 * 预设配置集合
 */
export type PresetConfigs = Record<PresetConfigKey, PresetConfig>;

// ============================================================================
// UI 状态类型
// ============================================================================

/**
 * 调试器 UI 状态
 */
export interface DebuggerUIState {
  /** 是否正在执行 */
  isLoading: boolean;
  /** 当前选中的场景 */
  selectedScenario: DebugScenario;
  /** 当前选中的预设 */
  selectedPreset: PresetConfigKey;
  /** 自定义配置模式 */
  isCustomConfig: boolean;
  /** 最近一次结果 */
  lastResult: CompareResponse | null;
  /** 错误信息 */
  error: string | null;
}
