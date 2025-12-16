/**
 * Graph Builder Service
 *
 * 知识图谱构建服务
 * 负责管理和更新用户的知识图谱结构
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { KnowledgeGraphStats, LinkType } from "../types/link.types";

// ============================================================================
// Types
// ============================================================================

/**
 * 图谱节点（书签）
 */
export interface GraphNode {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform?: string;
  /** 连接数 */
  connectionCount: number;
  /** 平均关联强度 */
  avgStrength: number;
}

/**
 * 图谱边（关联）
 */
export interface GraphEdge {
  /** 源节点 ID */
  source: number;
  /** 目标节点 ID */
  target: number;
  /** 关联类型 */
  type: LinkType;
  /** 关联强度 */
  strength: number;
}

/**
 * 图谱数据
 */
export interface GraphData {
  /** 节点列表 */
  nodes: GraphNode[];
  /** 边列表 */
  edges: GraphEdge[];
  /** 统计信息 */
  stats: KnowledgeGraphStats;
}

/**
 * 图谱构建选项
 */
export interface GraphBuildOptions {
  /** 最小关联强度 */
  minStrength?: number;
  /** 最大节点数 */
  maxNodes?: number;
  /** 关联类型过滤 */
  linkTypes?: LinkType[];
  /** 是否包含孤立节点 */
  includeIsolated?: boolean;
}

/**
 * 图谱服务配置
 */
export interface GraphBuilderConfig {
  /** 默认最小强度 */
  defaultMinStrength: number;
  /** 默认最大节点数 */
  defaultMaxNodes: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存过期时间（毫秒） */
  cacheExpiry: number;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: GraphBuilderConfig = {
  defaultMinStrength: 0.3,
  defaultMaxNodes: 200,
  enableCache: true,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Service Interface
// ============================================================================

export interface IGraphBuilderService {
  /**
   * 获取用户的知识图谱数据
   */
  getGraphData(userId: string, options?: GraphBuildOptions): Promise<GraphData>;

  /**
   * 更新图谱统计信息
   */
  updateStats(userId: string, newLinksCount: number): Promise<void>;

  /**
   * 获取节点的邻居
   */
  getNodeNeighbors(
    bookmarkId: number,
    userId: string,
    depth?: number,
  ): Promise<GraphData>;

  /**
   * 获取图谱中心节点（连接最多的书签）
   */
  getCentralNodes(userId: string, limit?: number): Promise<GraphNode[]>;

  /**
   * 检测图谱中的社区/聚类
   */
  detectCommunities(userId: string): Promise<Map<number, number[]>>;

  /**
   * 清除缓存
   */
  clearCache(userId?: string): void;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 知识图谱构建服务
 */
export class GraphBuilderService implements IGraphBuilderService {
  private config: GraphBuilderConfig;
  private cache: Map<string, { data: GraphData; expiry: number }> = new Map();

  constructor(
    private supabase: SupabaseClient = createClient(),
    config?: Partial<GraphBuilderConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取用户的知识图谱数据
   */
  async getGraphData(
    userId: string,
    options?: GraphBuildOptions,
  ): Promise<GraphData> {
    const cacheKey = this.getCacheKey(userId, options);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        logger.debug({ userId }, "[GraphBuilder] Returning cached graph data");
        return cached.data;
      }
    }

    const minStrength = options?.minStrength ?? this.config.defaultMinStrength;
    const maxNodes = options?.maxNodes ?? this.config.defaultMaxNodes;
    const linkTypes = options?.linkTypes;
    const includeIsolated = options?.includeIsolated ?? false;

    try {
      // 1. 获取所有关联
      const { data: linksData, error: linksError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RPC 动态调用类型限制
        (this.supabase.rpc as any)("get_user_knowledge_links", {
          p_user_id: userId,
          p_min_strength: minStrength,
          p_link_types: linkTypes || null,
          p_limit: maxNodes * 10, // Allow more edges
        });

      if (linksError) {
        logger.error(
          { error: linksError },
          "[GraphBuilder] Failed to get links",
        );
        throw new Error(`Failed to get links: ${linksError.message}`);
      }

      // 2. 提取唯一书签 ID
      const bookmarkIds = new Set<number>();
      const edges: GraphEdge[] = [];

      for (const row of linksData || []) {
        bookmarkIds.add(row.source_bookmark_id);
        bookmarkIds.add(row.target_bookmark_id);
        edges.push({
          source: row.source_bookmark_id,
          target: row.target_bookmark_id,
          type: row.link_type as LinkType,
          strength: row.strength,
        });
      }

      // 3. 获取书签详情
      let nodeIds = Array.from(bookmarkIds);

      // 如果包含孤立节点，获取所有书签
      if (includeIsolated) {
        const { data: allBookmarks } = await this.supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", userId)
          .limit(maxNodes);

        if (allBookmarks) {
          for (const b of allBookmarks) {
            nodeIds.push(b.id);
          }
          nodeIds = [...new Set(nodeIds)];
        }
      }

      // 限制节点数
      nodeIds = nodeIds.slice(0, maxNodes);

      const { data: bookmarksData } = await this.supabase
        .from("bookmarks")
        .select("id, title, url, platform")
        .in("id", nodeIds);

      // 4. 计算每个节点的连接数
      const connectionCounts = new Map<
        number,
        { count: number; totalStrength: number }
      >();

      for (const edge of edges) {
        const sourceInfo = connectionCounts.get(edge.source) || {
          count: 0,
          totalStrength: 0,
        };
        sourceInfo.count++;
        sourceInfo.totalStrength += edge.strength;
        connectionCounts.set(edge.source, sourceInfo);

        const targetInfo = connectionCounts.get(edge.target) || {
          count: 0,
          totalStrength: 0,
        };
        targetInfo.count++;
        targetInfo.totalStrength += edge.strength;
        connectionCounts.set(edge.target, targetInfo);
      }

      // 5. 构建节点列表
      const nodes: GraphNode[] = (bookmarksData || []).map((b) => {
        const info = connectionCounts.get(b.id) || {
          count: 0,
          totalStrength: 0,
        };
        return {
          id: b.id,
          title: b.title,
          url: b.url,
          platform: b.platform || undefined,
          connectionCount: info.count,
          avgStrength: info.count > 0 ? info.totalStrength / info.count : 0,
        };
      });

      // 6. 获取统计信息
      const stats = await this.getStatsFromData(userId, nodes, edges);

      const graphData: GraphData = { nodes, edges, stats };

      // Cache the result
      if (this.config.enableCache) {
        this.cache.set(cacheKey, {
          data: graphData,
          expiry: Date.now() + this.config.cacheExpiry,
        });
      }

      logger.info(
        { userId, nodeCount: nodes.length, edgeCount: edges.length },
        "[GraphBuilder] Built graph data",
      );

      return graphData;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "[GraphBuilder] Failed to build graph",
      );
      throw error;
    }
  }

  /**
   * 更新图谱统计信息
   */
  async updateStats(userId: string, newLinksCount: number): Promise<void> {
    logger.info(
      { userId, newLinksCount },
      "[GraphBuilder] Updating graph stats",
    );

    // 清除该用户的缓存
    this.clearCache(userId);

    // 统计更新由数据库触发器处理
    // 这里只记录日志
  }

  /**
   * 获取节点的邻居
   */
  async getNodeNeighbors(
    bookmarkId: number,
    userId: string,
    depth: number = 1,
  ): Promise<GraphData> {
    const visited = new Set<number>([bookmarkId]);
    const allEdges: GraphEdge[] = [];
    let currentLevel = [bookmarkId];

    for (let d = 0; d < depth; d++) {
      if (currentLevel.length === 0) break;

      const nextLevel: number[] = [];

      for (const nodeId of currentLevel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (this.supabase.rpc as any)(
          "get_bookmark_links",
          {
            p_bookmark_id: nodeId,
            p_user_id: userId,
            p_min_strength: this.config.defaultMinStrength,
            p_limit: 20,
          },
        );

        for (const row of data || []) {
          const neighborId = row.related_bookmark_id;
          allEdges.push({
            source: Math.min(nodeId, neighborId),
            target: Math.max(nodeId, neighborId),
            type: row.link_type as LinkType,
            strength: row.strength,
          });

          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextLevel.push(neighborId);
          }
        }
      }

      currentLevel = nextLevel;
    }

    // 获取所有访问过的节点详情
    const { data: bookmarksData } = await this.supabase
      .from("bookmarks")
      .select("id, title, url, platform")
      .in("id", Array.from(visited));

    const nodes: GraphNode[] = (bookmarksData || []).map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      platform: b.platform || undefined,
      connectionCount: allEdges.filter(
        (e) => e.source === b.id || e.target === b.id,
      ).length,
      avgStrength: 0, // Simplified for neighbors view
    }));

    // 去重边
    const uniqueEdges = this.deduplicateEdges(allEdges);

    return {
      nodes,
      edges: uniqueEdges,
      stats: await this.getStatsFromData(userId, nodes, uniqueEdges),
    };
  }

  /**
   * 获取图谱中心节点（连接最多的书签）
   */
  async getCentralNodes(
    userId: string,
    limit: number = 10,
  ): Promise<GraphNode[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)(
      "get_central_bookmarks",
      {
        p_user_id: userId,
        p_limit: limit,
      },
    );

    if (error) {
      logger.error({ error }, "[GraphBuilder] Failed to get central nodes");
      return [];
    }

    return (data || []).map(
      (row: {
        bookmark_id: number;
        title: string;
        url: string;
        platform: string | null;
        connection_count: number;
        avg_strength: number;
      }) => ({
        id: row.bookmark_id,
        title: row.title,
        url: row.url,
        platform: row.platform || undefined,
        connectionCount: row.connection_count,
        avgStrength: row.avg_strength,
      }),
    );
  }

  /**
   * 检测图谱中的社区/聚类
   * 使用简化的标签传播算法
   */
  async detectCommunities(userId: string): Promise<Map<number, number[]>> {
    const graphData = await this.getGraphData(userId, {
      minStrength: 0.5,
      maxNodes: 500,
    });

    // 简化的社区检测：基于强连接组件
    const adjacency = new Map<number, Set<number>>();

    // 构建邻接表
    for (const node of graphData.nodes) {
      adjacency.set(node.id, new Set());
    }

    for (const edge of graphData.edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }

    // 标签传播
    const labels = new Map<number, number>();
    let communityId = 0;

    for (const node of graphData.nodes) {
      if (!labels.has(node.id)) {
        // BFS 找到所有连通节点
        const queue = [node.id];
        const community: number[] = [];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (labels.has(current)) continue;

          labels.set(current, communityId);
          community.push(current);

          const neighbors = adjacency.get(current) || new Set();
          for (const neighbor of neighbors) {
            if (!labels.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }

        communityId++;
      }
    }

    // 按社区分组
    const communities = new Map<number, number[]>();
    for (const [nodeId, cId] of labels) {
      if (!communities.has(cId)) {
        communities.set(cId, []);
      }
      communities.get(cId)!.push(nodeId);
    }

    logger.info(
      { userId, communityCount: communities.size },
      "[GraphBuilder] Detected communities",
    );

    return communities;
  }

  /**
   * 清除缓存
   */
  clearCache(userId?: string): void {
    if (userId) {
      // 清除特定用户的缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(`graph:${userId}`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 生成缓存键
   */
  private getCacheKey(userId: string, options?: GraphBuildOptions): string {
    const parts = [
      `graph:${userId}`,
      options?.minStrength?.toString() || "default",
      options?.maxNodes?.toString() || "default",
      options?.linkTypes?.join(",") || "all",
      options?.includeIsolated ? "isolated" : "connected",
    ];
    return parts.join(":");
  }

  /**
   * 从数据计算统计信息
   */
  private async getStatsFromData(
    userId: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<KnowledgeGraphStats> {
    // 按类型统计
    const linksByType: Record<LinkType, number> = {
      semantic: 0,
      entity: 0,
      tag: 0,
      topic: 0,
    };

    // 按强度统计
    const linksByStrength = { strong: 0, medium: 0, weak: 0 };

    for (const edge of edges) {
      linksByType[edge.type]++;
      if (edge.strength >= 0.7) {
        linksByStrength.strong++;
      } else if (edge.strength >= 0.4) {
        linksByStrength.medium++;
      } else {
        linksByStrength.weak++;
      }
    }

    return {
      totalBookmarks: nodes.length,
      totalLinks: edges.length,
      avgLinksPerBookmark:
        nodes.length > 0 ? (edges.length * 2) / nodes.length : 0,
      linksByType,
      linksByStrength,
    };
  }

  /**
   * 去重边
   */
  private deduplicateEdges(edges: GraphEdge[]): GraphEdge[] {
    const seen = new Set<string>();
    const result: GraphEdge[] = [];

    for (const edge of edges) {
      const key = `${Math.min(edge.source, edge.target)}-${Math.max(edge.source, edge.target)}-${edge.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(edge);
      }
    }

    return result;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let graphBuilderInstance: GraphBuilderService | null = null;

/**
 * 获取 GraphBuilderService 单例
 */
export function getGraphBuilderService(): GraphBuilderService {
  if (!graphBuilderInstance) {
    graphBuilderInstance = new GraphBuilderService();
  }
  return graphBuilderInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetGraphBuilderService(): void {
  graphBuilderInstance?.clearCache();
  graphBuilderInstance = null;
}
