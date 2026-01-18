/**
 * 智能分类 v5.0 - Entropy Reduction 类型定义
 */

/**
 * 文件夹熵值记录
 */
export interface FolderEntropyScore {
  id: number;
  userId: string;
  folderId: number;
  entropyScore: number; // 0-1
  bookmarkCount: number;
  avgSimilarity: number | null;
  similarityStddev: number | null;
  calculatedAt: string;
}

/**
 * 熵值计算结果
 */
export interface EntropyCalculationResult {
  folderId: number;
  folderName: string;
  entropyScore: number;
  bookmarkCount: number;
  avgSimilarity: number | null;
  similarityStddev: number | null;
}

/**
 * 高熵文件夹
 */
export interface HighEntropyFolder {
  folderId: number;
  folderName: string;
  entropyScore: number;
  bookmarkCount: number;
  severity: "high" | "medium" | "low";
}

/**
 * 熵减少操作类型
 */
export type EntropyReductionAction = "split" | "merge" | "reclassify";

/**
 * 熵减少建议
 */
export interface EntropyReductionSuggestion {
  folderId: number;
  folderName: string;
  currentEntropy: number;
  actionType: EntropyReductionAction;
  description: string;
  estimatedEntropyAfter: number;
  affectedBookmarkCount: number;
  details: Record<string, unknown>;
}

/**
 * 熵减少执行结果
 */
export interface EntropyReductionResult {
  success: boolean;
  folderId: number;
  actionType: EntropyReductionAction;
  beforeEntropy: number;
  afterEntropy: number | null;
  affectedBookmarkCount: number;
  error?: string;
}

/**
 * 熵减少日志
 */
export interface EntropyReductionLog {
  id: number;
  userId: string;
  folderId: number;
  actionType: EntropyReductionAction;
  beforeEntropy: number;
  afterEntropy: number | null;
  affectedBookmarkCount: number;
  actionDetails: Record<string, unknown>;
  executedAt: string;
}
