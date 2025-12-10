/**
 * v3对比v4 - 类型定义
 */

import type { ClassificationAction } from "@/lib/classification/types/classification";

/**
 * 测试书签输入
 */
export interface TestBookmarkInput {
  url: string;
  title: string;
  description?: string;
  tags?: string[];
}

/**
 * 测试场景
 */
export type TestScenario = "cold-start" | "learning" | "mature";

/**
 * 选中的版本
 */
export type SelectedVersions = {
  v3: boolean;
  v41: boolean;
  v42: boolean;
};

/**
 * 单版本分类结果
 */
export interface VersionResult {
  version: "v3" | "v4.1" | "v4.2";
  folderId: number | null;
  folderName: string;
  confidence: number;
  executionTime: number;
  tier: "T1" | "T2" | "T3";
  action: ClassificationAction;
  aiCalled: boolean;
  details?: {
    matchType?: string;
    tagBoost?: number;
    reasoning?: string;
  };
}

/**
 * 版本间差异
 */
export interface VersionDiff {
  from: string;
  to: string;
  sameFolder: boolean;
  confidenceDiff: number;
  timeDiff: number;
  tierChange: string | null;
  improvements: string[];
}

/**
 * 对比请求
 */
export interface CompareRequest {
  bookmark: TestBookmarkInput;
  scenario: TestScenario;
  versions: SelectedVersions;
}

/**
 * 对比响应
 */
export interface CompareResponse {
  success: boolean;
  results: VersionResult[];
  diffs: VersionDiff[];
  error?: string;
}

/**
 * UI 状态
 */
export interface CompareUIState {
  isLoading: boolean;
  bookmark: TestBookmarkInput;
  scenario: TestScenario;
  versions: SelectedVersions;
  result: CompareResponse | null;
  error: string | null;
}
