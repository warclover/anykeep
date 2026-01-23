/**
 * V5.5 晶体生长类型定义
 */

/**
 * 混沌池记录
 */
export interface ChaosPoolEntry {
  id: number;
  user_id: string;
  bookmark_id: number;
  crystal_processed: boolean;
  processed_at: string | null;
  result_folder_id: number | null;
  created_at: string;
  expires_at: string;
}

/**
 * 晶核检测结果
 */
export interface NucleusResult {
  /** 是否形成晶核 */
  formed: boolean;
  /** 找到的邻居数量 */
  neighborsCount: number;
  /** 晶核簇书签 ID（包含触发书签） */
  clusterBookmarkIds: number[];
  /** 晶核簇书签标题 */
  clusterTitles: string[];
  /** 平均相似度 */
  avgSimilarity?: number;
}

/**
 * 晶体生长处理结果
 */
export interface CrystalGrowthResult {
  /** 处理动作 */
  action:
    | "CLASSIFIED"
    | "CRYSTALLIZED"
    | "POOLED"
    | "QUOTA_BLOCKED"
    | "SHADOW_LOGGED";
  /** 文件夹 ID（如果命中或创建） */
  folderId?: number;
  /** 文件夹名称 */
  folderName?: string;
  /** 是否是新创建的文件夹 */
  isNewFolder?: boolean;
  /** 晶核簇大小 */
  clusterSize?: number;
  /** 通知配置 */
  notification?: {
    type: "success" | "info" | "warning";
    message: string;
  };
  /** 处理耗时（毫秒） */
  latencyMs?: number;
}

/**
 * 邻居书签信息
 */
export interface NeighborBookmark {
  bookmark_id: number;
  title: string;
  similarity: number;
}

/**
 * 晶体生长配置
 */
export const CRYSTAL_CONFIG = {
  /** 晶核形成阈值（最少书签数） */
  NUCLEATION_THRESHOLD: 3,
  /** 命中现有文件夹的距离阈值 */
  HIT_DISTANCE: 0.15,
  /** 晶核形成的邻居搜索半径 */
  NUCLEUS_RADIUS: 0.2,
  /** 邻居搜索最大数量 */
  MAX_NEIGHBORS: 10,
  /** 混沌池过期时间（天） */
  CHAOS_POOL_TTL_DAYS: 30,
} as const;
