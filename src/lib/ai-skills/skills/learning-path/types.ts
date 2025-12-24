/**
 * LearningPathSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 学习路径难度
 */
export type PathDifficulty = "beginner" | "intermediate" | "advanced" | "mixed";

/**
 * 学习路径状态
 */
export type PathStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

/**
 * 学习节点类型
 */
export type NodeType = "bookmark" | "milestone" | "quiz" | "review";

/**
 * 学习节点状态
 */
export type NodeStatus = "pending" | "in_progress" | "completed" | "skipped";

/**
 * 学习路径输入
 */
export interface LearningPathInput {
  /** 操作类型 */
  action: "create" | "update" | "progress" | "suggest" | "analyze";
  /** 路径 ID（update/progress 时使用） */
  pathId?: string;
  /** 创建选项（action 为 create 时使用） */
  createOptions?: {
    /** 主题 */
    topic: string;
    /** 描述 */
    description?: string;
    /** 难度 */
    difficulty?: PathDifficulty;
    /** 预计天数 */
    estimatedDays?: number;
    /** 书签 ID 列表（手动指定） */
    bookmarkIds?: number[];
    /** 文件夹 ID（从文件夹自动生成） */
    folderId?: number;
    /** 标签（从标签自动生成） */
    tag?: string;
  };
  /** 进度更新选项（action 为 progress 时使用） */
  progressOptions?: {
    /** 节点 ID */
    nodeId: string;
    /** 新状态 */
    status: NodeStatus;
    /** 笔记 */
    note?: string;
    /** 评分 */
    rating?: number;
  };
}

/**
 * 学习节点
 */
export interface LearningNode {
  /** 节点 ID */
  id: string;
  /** 节点类型 */
  type: NodeType;
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 书签 ID（type 为 bookmark 时） */
  bookmarkId?: number;
  /** 书签 URL */
  url?: string;
  /** 平台 */
  platform?: string;
  /** 预计学习时长（分钟） */
  estimatedMinutes: number;
  /** 状态 */
  status: NodeStatus;
  /** 完成时间 */
  completedAt?: string;
  /** 学习笔记 */
  note?: string;
  /** 用户评分 */
  rating?: number;
  /** 顺序 */
  order: number;
  /** 里程碑名称（type 为 milestone 时） */
  milestoneName?: string;
}

/**
 * 学习路径
 */
export interface LearningPath {
  /** 路径 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 主题 */
  topic: string;
  /** 难度 */
  difficulty: PathDifficulty;
  /** 状态 */
  status: PathStatus;
  /** 学习节点列表 */
  nodes: LearningNode[];
  /** 预计总时长（分钟） */
  estimatedTotalMinutes: number;
  /** 预计天数 */
  estimatedDays: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 开始时间 */
  startedAt?: string;
  /** 完成时间 */
  completedAt?: string;
}

/**
 * 学习进度
 */
export interface LearningProgress {
  /** 已完成节点数 */
  completedNodes: number;
  /** 总节点数 */
  totalNodes: number;
  /** 完成百分比 */
  completionRate: number;
  /** 已学习时长（分钟） */
  learnedMinutes: number;
  /** 剩余时长（分钟） */
  remainingMinutes: number;
  /** 当前节点 */
  currentNode?: LearningNode;
  /** 下一个节点 */
  nextNode?: LearningNode;
  /** 连续学习天数 */
  streakDays: number;
  /** 本周学习时长 */
  weeklyMinutes: number;
}

/**
 * 学习统计
 */
export interface LearningStats {
  /** 活跃路径数 */
  activePathsCount: number;
  /** 已完成路径数 */
  completedPathsCount: number;
  /** 总学习时长（分钟） */
  totalLearnedMinutes: number;
  /** 总完成节点数 */
  totalCompletedNodes: number;
  /** 平均完成率 */
  avgCompletionRate: number;
  /** 最长连续学习天数 */
  longestStreak: number;
  /** 热门主题 */
  topTopics: Array<{ topic: string; count: number }>;
}

/**
 * 学习建议
 */
export interface LearningSuggestion {
  /** 建议类型 */
  type: "path" | "node" | "habit" | "review";
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 相关数据 */
  data?: {
    pathId?: string;
    nodeId?: string;
    bookmarkId?: number;
  };
}

/**
 * 学习路径输出
 */
export interface LearningPathOutput {
  /** 操作类型 */
  action: LearningPathInput["action"];
  /** 学习路径（create/update 时） */
  path?: LearningPath;
  /** 学习进度（progress 时） */
  progress?: LearningProgress;
  /** 学习统计（analyze 时） */
  stats?: LearningStats;
  /** 建议（suggest 时） */
  suggestions?: LearningSuggestion[];
  /** 摘要 */
  summary: string;
  /** 后续建议 */
  nextSteps: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 难度配置
 */
export const DIFFICULTY_CONFIG: Record<
  PathDifficulty,
  {
    name: string;
    icon: string;
    estimatedMinutesPerNode: number;
  }
> = {
  beginner: {
    name: "入门",
    icon: "🌱",
    estimatedMinutesPerNode: 10,
  },
  intermediate: {
    name: "进阶",
    icon: "🌿",
    estimatedMinutesPerNode: 20,
  },
  advanced: {
    name: "高级",
    icon: "🌳",
    estimatedMinutesPerNode: 30,
  },
  mixed: {
    name: "混合",
    icon: "🎯",
    estimatedMinutesPerNode: 15,
  },
};

/**
 * 默认学习路径配置
 */
export const DEFAULT_LEARNING_PATH_CONFIG = {
  difficulty: "intermediate" as PathDifficulty,
  estimatedDays: 7,
  minutesPerDay: 30,
  nodesPerMilestone: 5,
};

/**
 * 生成路径 ID
 */
export function generatePathId(): string {
  return `path_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 生成节点 ID
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
