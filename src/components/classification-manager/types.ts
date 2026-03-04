export interface ClassificationStats {
  totalBookmarks: number;
  classifiedCount: number;
  pendingCount: number;
  acceptanceRate: number;
  autoClassificationRate: number;
}

export interface ClassificationHistoryItem {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  suggestedFolderName: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: string;
}

export interface WeightConfig {
  vector: number;
  history: number;
  ai: number;
}

export interface ThresholdConfig {
  high: number;
  medium: number;
}

export interface FeatureConfig {
  tieredOptimization: boolean;
  knnDirect: boolean;
  universalCategories: boolean;
  tagMatcher: boolean;
}

export const WEIGHT_LABELS = {
  vector: { name: "向量匹配", description: "基于语义相似度匹配文件夹" },
  history: { name: "历史匹配", description: "基于用户历史分类行为" },
  ai: { name: "AI 推荐", description: "基于 AI 理解推荐分类" },
} as const;

export const STATUS_COLORS = {
  pending:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  accepted:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
} as const;

export const STATUS_LABELS = {
  pending: "待确认",
  accepted: "已接受",
  rejected: "已拒绝",
  expired: "已过期",
} as const;
