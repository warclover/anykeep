/**
 * Knowledge Link Types
 *
 * 知识关联模块类型定义
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

// ============================================================================
// Link Types
// ============================================================================

/**
 * 关联类型枚举
 */
export type LinkType = "semantic" | "entity" | "tag" | "topic";

/**
 * 关联类型标签（用于 UI 展示）
 */
export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  semantic: "语义相似",
  entity: "共享实体",
  tag: "共享标签",
  topic: "同主题",
};

/**
 * 关联类型图标
 */
export const LINK_TYPE_ICONS: Record<LinkType, string> = {
  semantic: "brain",
  entity: "users",
  tag: "tag",
  topic: "folder",
};

// ============================================================================
// Knowledge Link
// ============================================================================

/**
 * 知识关联记录
 */
export interface KnowledgeLink {
  /** 关联 ID */
  id: string;

  /** 用户 ID */
  userId: string;

  /** 源书签 ID（较小的 ID） */
  sourceBookmarkId: number;

  /** 目标书签 ID（较大的 ID） */
  targetBookmarkId: number;

  /** 关联类型 */
  linkType: LinkType;

  /** 关联强度 (0-1) */
  strength: number;

  /** 关联依据 */
  evidence: LinkEvidence;

  /** 生成算法标识 */
  algorithm?: string;

  /** 创建时间 */
  createdAt: string;
}

/**
 * 关联依据
 */
export interface LinkEvidence {
  /** 依据类型 */
  type: LinkType;

  /** 分数 */
  score: number;

  /** 详细信息 */
  details: LinkEvidenceDetails;
}

/**
 * 关联依据详情
 */
export interface LinkEvidenceDetails {
  /** 共享实体列表 */
  sharedEntities?: string[];

  /** 向量相似度分数 */
  similarityScore?: number;

  /** 共享标签列表 */
  sharedTags?: string[];

  /** 所属主题簇 */
  topicCluster?: string;
}

// ============================================================================
// Related Bookmark
// ============================================================================

/**
 * 相关书签（带关联信息）
 */
export interface RelatedBookmark {
  /** 书签基本信息 */
  bookmark: {
    id: number;
    title: string;
    url: string;
    favicon?: string;
    platform?: string;
  };

  /** 关联信息 */
  link: {
    /** 关联类型 */
    type: LinkType;

    /** 关联强度 */
    strength: number;

    /** 共享的实体/标签 */
    sharedItems: string[];
  };
}

/**
 * 相关书签查询选项
 */
export interface GetRelatedOptions {
  /** 最大返回数量 */
  limit?: number;

  /** 最小关联强度 */
  minStrength?: number;

  /** 关联类型过滤 */
  types?: LinkType[];
}

// ============================================================================
// Link Discovery
// ============================================================================

/**
 * 关联发现输入
 */
export interface LinkDiscoveryInput {
  /** 用户 ID */
  userId: string;

  /** 书签 ID */
  bookmarkId: number;

  /** 书签标题 */
  title?: string;

  /** 书签标签 */
  tags?: string[];

  /** 实体名称列表 */
  entities?: string[];

  /** 书签 embedding 向量 */
  embedding?: number[];
}

/**
 * 关联发现选项
 */
export interface LinkDiscoveryOptions {
  /** 语义相似度配置 */
  semantic?: {
    enabled: boolean;
    minSimilarity: number;
    limit: number;
  };

  /** 实体匹配配置 */
  entity?: {
    enabled: boolean;
    minShared: number;
    limit: number;
  };

  /** 标签匹配配置 */
  tag?: {
    enabled: boolean;
    minShared: number;
    limit: number;
  };
}

/**
 * 默认关联发现选项
 */
export const DEFAULT_DISCOVERY_OPTIONS: LinkDiscoveryOptions = {
  semantic: {
    enabled: true,
    minSimilarity: 0.7,
    limit: 10,
  },
  entity: {
    enabled: true,
    minShared: 1,
    limit: 10,
  },
  tag: {
    enabled: true,
    minShared: 2,
    limit: 10,
  },
};

/**
 * 发现的关联（待保存）
 */
export interface DiscoveredLink {
  /** 目标书签 ID */
  targetBookmarkId: number;

  /** 关联类型 */
  linkType: LinkType;

  /** 关联强度 */
  strength: number;

  /** 关联依据 */
  evidence: LinkEvidence;

  /** 算法标识 */
  algorithm: string;
}

// ============================================================================
// Graph Stats
// ============================================================================

/**
 * 知识图谱统计
 */
export interface KnowledgeGraphStats {
  /** 书签总数 */
  totalBookmarks: number;

  /** 关联总数 */
  totalLinks: number;

  /** 平均每书签关联数 */
  avgLinksPerBookmark: number;

  /** 按类型统计 */
  linksByType: Record<LinkType, number>;

  /** 按强度统计 */
  linksByStrength: {
    strong: number; // >= 0.7
    medium: number; // 0.4 - 0.7
    weak: number; // < 0.4
  };
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * 知识关联服务配置
 */
export interface LinkServiceConfig {
  /** 是否启用语义相似度 */
  enableSemantic: boolean;

  /** 是否启用实体匹配 */
  enableEntity: boolean;

  /** 是否启用标签匹配 */
  enableTag: boolean;

  /** 语义相似度阈值 */
  semanticThreshold: number;

  /** 实体匹配最小共享数 */
  entityMinShared: number;

  /** 标签匹配最小共享数 */
  tagMinShared: number;

  /** 每种类型最大关联数 */
  maxLinksPerType: number;

  /** 是否发送事件通知 */
  emitEvents: boolean;
}

/**
 * 默认服务配置
 */
export const DEFAULT_LINK_SERVICE_CONFIG: LinkServiceConfig = {
  enableSemantic: true,
  enableEntity: true,
  enableTag: true,
  semanticThreshold: 0.7,
  entityMinShared: 1,
  tagMinShared: 2,
  maxLinksPerType: 10,
  emitEvents: true,
};

// ============================================================================
// Repository Types
// ============================================================================

/**
 * 保存关联的输入
 */
export interface SaveLinkInput {
  userId: string;
  bookmarkId1: number;
  bookmarkId2: number;
  linkType: LinkType;
  strength: number;
  evidence: LinkEvidence;
  algorithm?: string;
}

/**
 * 批量保存关联的输入
 */
export interface BatchSaveLinkInput {
  userId: string;
  links: Array<{
    bookmarkId1: number;
    bookmarkId2: number;
    linkType: LinkType;
    strength: number;
    evidence: LinkEvidence;
    algorithm?: string;
  }>;
}

/**
 * 关联查询过滤条件
 */
export interface LinkQueryFilter {
  userId?: string;
  bookmarkId?: number;
  linkTypes?: LinkType[];
  minStrength?: number;
  limit?: number;
  offset?: number;
}
