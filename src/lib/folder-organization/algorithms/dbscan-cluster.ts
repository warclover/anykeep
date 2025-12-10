/**
 * DBSCAN Clustering Algorithm
 * 基于密度的空间聚类算法 - 用于书签聚类和文件夹分拆建议
 *
 * 算法特点：
 * - 不需要预先指定聚类数量
 * - 能够发现任意形状的簇
 * - 对噪声点有良好的鲁棒性
 *
 * 在文件夹自组织中的应用：
 * - 识别文件夹内的不同主题群
 * - 为分拆建议提供依据
 * - 聚类待归类的书签
 *
 * @version 4.2
 */

// ============================================================================
// Types
// ============================================================================

/**
 * DBSCAN 算法配置
 */
export interface DBSCANOptions {
  /** 邻域半径（向量距离阈值） */
  epsilon: number;

  /** 最小邻居数量（形成核心点的条件） */
  minPoints: number;

  /** 距离计算函数（默认余弦距离） */
  distanceFunction?: (a: number[], b: number[]) => number;
}

/**
 * 聚类结果
 */
export interface ClusterResult<T> {
  /** 簇 ID (-1 表示噪声点) */
  clusterId: number;

  /** 原始数据项 */
  item: T;

  /** 是否为核心点 */
  isCore: boolean;
}

/**
 * 聚类摘要
 */
export interface ClusterSummary {
  /** 簇 ID */
  clusterId: number;

  /** 簇内成员数量 */
  size: number;

  /** 核心点数量 */
  coreCount: number;

  /** 簇质心（平均向量） */
  centroid: number[] | null;
}

// ============================================================================
// Default Distance Functions
// ============================================================================

/**
 * 余弦距离 (1 - 余弦相似度)
 */
export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 1; // 最大距离
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 1;
  }

  const similarity = dotProduct / denominator;
  return 1 - similarity;
}

/**
 * 欧氏距离
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

// ============================================================================
// DBSCAN Implementation
// ============================================================================

/**
 * DBSCAN 聚类算法实现
 */
export class DBSCANCluster<T> {
  private options: Required<DBSCANOptions>;

  constructor(options: DBSCANOptions) {
    this.options = {
      epsilon: options.epsilon,
      minPoints: options.minPoints,
      distanceFunction: options.distanceFunction || cosineDistance,
    };
  }

  /**
   * 执行聚类
   *
   * @param items 数据项数组
   * @param getEmbedding 获取数据项向量的函数
   * @returns 聚类结果
   */
  cluster<TItem extends T>(
    items: TItem[],
    getEmbedding: (item: TItem) => number[] | null,
  ): ClusterResult<TItem>[] {
    const n = items.length;
    if (n === 0) return [];

    // 预计算所有向量
    const embeddings = items.map(getEmbedding);

    // 标记数组：-2=未访问, -1=噪声, >=0=簇ID
    const labels: number[] = new Array(n).fill(-2);

    // 核心点标记
    const isCore: boolean[] = new Array(n).fill(false);

    // 当前簇ID
    let currentClusterId = 0;

    // 主循环
    for (let i = 0; i < n; i++) {
      if (labels[i] !== -2) continue; // 已处理

      const embedding = embeddings[i];
      if (!embedding) {
        labels[i] = -1; // 无向量视为噪声
        continue;
      }

      // 查找邻居
      const neighbors = this.regionQuery(embeddings, embedding, i);

      if (neighbors.length < this.options.minPoints) {
        labels[i] = -1; // 噪声点
      } else {
        // 找到核心点，开始扩展簇
        isCore[i] = true;
        this.expandCluster(
          items,
          embeddings,
          labels,
          isCore,
          i,
          neighbors,
          currentClusterId,
        );
        currentClusterId++;
      }
    }

    // 构建结果
    return items.map((item, index) => ({
      clusterId: labels[index],
      item,
      isCore: isCore[index],
    }));
  }

  /**
   * 获取聚类摘要
   */
  getSummary<TItem extends T>(
    results: ClusterResult<TItem>[],
    getEmbedding: (item: TItem) => number[] | null,
  ): ClusterSummary[] {
    const clusters = new Map<number, { items: TItem[]; coreCount: number }>();

    // 按簇分组
    for (const result of results) {
      if (result.clusterId < 0) continue; // 跳过噪声

      if (!clusters.has(result.clusterId)) {
        clusters.set(result.clusterId, { items: [], coreCount: 0 });
      }

      const cluster = clusters.get(result.clusterId)!;
      cluster.items.push(result.item);
      if (result.isCore) {
        cluster.coreCount++;
      }
    }

    // 计算摘要
    const summaries: ClusterSummary[] = [];
    for (const [clusterId, cluster] of clusters) {
      const centroid = this.computeCentroid(cluster.items, getEmbedding);
      summaries.push({
        clusterId,
        size: cluster.items.length,
        coreCount: cluster.coreCount,
        centroid,
      });
    }

    return summaries.sort((a, b) => b.size - a.size);
  }

  /**
   * 区域查询 - 查找给定点的所有邻居
   */
  private regionQuery(
    embeddings: (number[] | null)[],
    queryEmbedding: number[],
    queryIndex: number,
  ): number[] {
    const neighbors: number[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      if (i === queryIndex) continue;

      const embedding = embeddings[i];
      if (!embedding) continue;

      const distance = this.options.distanceFunction(queryEmbedding, embedding);
      if (distance <= this.options.epsilon) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * 扩展簇
   */
  private expandCluster<TItem extends T>(
    items: TItem[],
    embeddings: (number[] | null)[],
    labels: number[],
    isCore: boolean[],
    pointIndex: number,
    neighbors: number[],
    clusterId: number,
  ): void {
    labels[pointIndex] = clusterId;

    // 使用队列进行 BFS 扩展
    const queue = [...neighbors];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const neighborIndex = queue[queueIndex++];

      // 如果是噪声点，重新分配到当前簇
      if (labels[neighborIndex] === -1) {
        labels[neighborIndex] = clusterId;
        continue;
      }

      // 如果已处理，跳过
      if (labels[neighborIndex] !== -2) {
        continue;
      }

      // 标记为当前簇
      labels[neighborIndex] = clusterId;

      const neighborEmbedding = embeddings[neighborIndex];
      if (!neighborEmbedding) continue;

      // 查找邻居的邻居
      const neighborsOfNeighbor = this.regionQuery(
        embeddings,
        neighborEmbedding,
        neighborIndex,
      );

      if (neighborsOfNeighbor.length >= this.options.minPoints) {
        isCore[neighborIndex] = true;
        // 添加到队列
        for (const nn of neighborsOfNeighbor) {
          if (labels[nn] === -2 || labels[nn] === -1) {
            queue.push(nn);
          }
        }
      }
    }
  }

  /**
   * 计算簇质心
   */
  private computeCentroid<TItem extends T>(
    items: TItem[],
    getEmbedding: (item: TItem) => number[] | null,
  ): number[] | null {
    const embeddings = items
      .map(getEmbedding)
      .filter((e): e is number[] => e !== null);

    if (embeddings.length === 0) return null;

    const dimension = embeddings[0].length;
    const centroid = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 创建书签聚类器（默认配置）
 */
export function createBookmarkClusterer(): DBSCANCluster<{
  embedding?: number[];
}> {
  return new DBSCANCluster({
    epsilon: 0.3, // 余弦距离阈值（相似度 > 0.7）
    minPoints: 3, // 至少 3 个相似书签形成簇
  });
}

/**
 * 创建文件夹分拆分析器
 */
export function createFolderSplitAnalyzer(): DBSCANCluster<{
  embedding?: number[];
}> {
  return new DBSCANCluster({
    epsilon: 0.4, // 更宽松的阈值，允许更大的簇
    minPoints: 2, // 至少 2 个形成子主题
  });
}
