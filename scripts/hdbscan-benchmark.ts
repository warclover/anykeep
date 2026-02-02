/**
 * HDBSCAN 技术验证 - 性能基准测试
 *
 * 测试目标：
 * 1. 验证 1000 点（1536 维向量）聚类性能
 * 2. 对比多个 npm 方案
 * 3. 与现有 DBSCAN 实现对比
 *
 * @since 2026-01-27
 */

// ============================================
// 类型定义
// ============================================

interface BenchmarkResult {
  name: string;
  pointCount: number;
  dimensions: number;
  executionTimeMs: number;
  clusterCount: number;
  noiseCount: number;
  memoryUsageMB: number;
  success: boolean;
  error?: string;
}

interface ClusteringAlgorithm {
  name: string;
  cluster: (points: number[][]) => Promise<number[]>;
}

// ============================================
// 数据生成
// ============================================

/**
 * 生成模拟向量数据（模拟真实嵌入向量）
 * 生成多个高斯分布簇 + 噪声点
 */
function generateTestData(
  pointCount: number,
  dimensions: number,
  clusterCount: number = 10,
): number[][] {
  const points: number[][] = [];
  const pointsPerCluster = Math.floor((pointCount * 0.7) / clusterCount);
  const noisePoints = pointCount - pointsPerCluster * clusterCount;

  // 生成簇中心
  const centers: number[][] = [];
  for (let c = 0; c < clusterCount; c++) {
    const center = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    // 归一化
    const norm = Math.sqrt(center.reduce((sum, v) => sum + v * v, 0));
    centers.push(center.map((v) => v / norm));
  }

  // 生成簇内点
  for (let c = 0; c < clusterCount; c++) {
    for (let i = 0; i < pointsPerCluster; i++) {
      const point = centers[c].map((v) => v + (Math.random() - 0.5) * 0.3);
      // 归一化
      const norm = Math.sqrt(point.reduce((sum, v) => sum + v * v, 0));
      points.push(point.map((v) => v / norm));
    }
  }

  // 生成噪声点
  for (let i = 0; i < noisePoints; i++) {
    const point = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    const norm = Math.sqrt(point.reduce((sum, v) => sum + v * v, 0));
    points.push(point.map((v) => v / norm));
  }

  // 打乱顺序
  return points.sort(() => Math.random() - 0.5);
}

// ============================================
// 现有 DBSCAN 实现（基准对比）
// ============================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

/**
 * 现有 DBSCAN 实现（从项目复制）
 */
function existingDbscan(
  points: number[][],
  eps: number = 0.35,
  minPts: number = 3,
): number[] {
  const n = points.length;
  const labels = new Array(n).fill(-1); // -1 = noise
  let clusterId = 0;

  // 预计算距离矩阵（这是 O(n²) 的瓶颈）
  const distanceMatrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = cosineDistance(points[i], points[j]);
      distanceMatrix[i][j] = dist;
      distanceMatrix[j][i] = dist;
    }
  }

  function getNeighbors(pointIdx: number): number[] {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i !== pointIdx && distanceMatrix[pointIdx][i] <= eps) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;

    const neighbors = getNeighbors(i);
    if (neighbors.length < minPts - 1) continue;

    labels[i] = clusterId;
    const queue = [...neighbors];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (labels[current] === -1) {
        labels[current] = clusterId;
      } else if (labels[current] !== -1) {
        continue;
      }

      const currentNeighbors = getNeighbors(current);
      if (currentNeighbors.length >= minPts - 1) {
        for (const neighbor of currentNeighbors) {
          if (labels[neighbor] === -1) {
            queue.push(neighbor);
          }
        }
      }
    }

    clusterId++;
  }

  return labels;
}

// ============================================
// 迭代式 DBSCAN（自适应 eps）
// ============================================

function iterativeDbscan(
  points: number[][],
  targetClusterRatio: number = 0.7,
  maxIterations: number = 5,
): number[] {
  let eps = 0.2;
  let bestLabels: number[] = [];
  let bestRatio = 0;

  for (let i = 0; i < maxIterations; i++) {
    const labels = existingDbscan(points, eps, 3);
    const noiseCount = labels.filter((l) => l === -1).length;
    const ratio = 1 - noiseCount / points.length;

    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestLabels = labels;
    }

    if (ratio >= targetClusterRatio) {
      return labels;
    }

    eps += 0.05;
  }

  return bestLabels;
}

// ============================================
// 简化 HDBSCAN 实现（纯 JS，用于验证）
// ============================================

/**
 * 简化的 HDBSCAN 实现
 * 基于最小生成树 + 层次聚类
 */
function simpleHdbscan(
  points: number[][],
  minClusterSize: number = 3,
  minSamples: number = 2,
): number[] {
  const n = points.length;

  // 1. 计算核心距离 (core distance)
  const coreDistances: number[] = [];
  for (let i = 0; i < n; i++) {
    const distances: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        distances.push(cosineDistance(points[i], points[j]));
      }
    }
    distances.sort((a, b) => a - b);
    coreDistances.push(distances[minSamples - 1] || 0);
  }

  // 2. 计算互达距离 (mutual reachability distance)
  const mrd: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = cosineDistance(points[i], points[j]);
      const reachability = Math.max(coreDistances[i], coreDistances[j], dist);
      mrd[i][j] = reachability;
      mrd[j][i] = reachability;
    }
  }

  // 3. 构建最小生成树 (Prim's algorithm)
  const inMst = new Set<number>([0]);
  const edges: Array<{ from: number; to: number; weight: number }> = [];

  while (inMst.size < n) {
    let minEdge = { from: -1, to: -1, weight: Infinity };

    for (const i of inMst) {
      for (let j = 0; j < n; j++) {
        if (!inMst.has(j) && mrd[i][j] < minEdge.weight) {
          minEdge = { from: i, to: j, weight: mrd[i][j] };
        }
      }
    }

    if (minEdge.to !== -1) {
      edges.push(minEdge);
      inMst.add(minEdge.to);
    }
  }

  // 4. 按权重排序边，从大到小删除
  edges.sort((a, b) => b.weight - a.weight);

  // 5. 使用 Union-Find 进行聚类
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    if (rank[px] < rank[py]) {
      parent[px] = py;
    } else if (rank[px] > rank[py]) {
      parent[py] = px;
    } else {
      parent[py] = px;
      rank[px]++;
    }
  }

  // 初始时所有点连接
  for (const edge of edges.slice().reverse()) {
    union(edge.from, edge.to);
  }

  // 删除权重最大的边，直到形成合适的簇
  const targetClusters = Math.ceil(n / (minClusterSize * 3));
  let edgesToRemove = Math.min(targetClusters - 1, edges.length);

  // 重置 parent
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    rank[i] = 0;
  }

  // 只连接保留的边
  for (let i = edgesToRemove; i < edges.length; i++) {
    union(edges[i].from, edges[i].to);
  }

  // 6. 提取聚类标签
  const clusterMap = new Map<number, number>();
  const labels: number[] = [];
  let nextClusterId = 0;

  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, nextClusterId++);
    }
    labels.push(clusterMap.get(root)!);
  }

  // 7. 标记小簇为噪声
  const clusterSizes = new Map<number, number>();
  for (const label of labels) {
    clusterSizes.set(label, (clusterSizes.get(label) || 0) + 1);
  }

  return labels.map((label) => {
    const size = clusterSizes.get(label) || 0;
    return size >= minClusterSize ? label : -1;
  });
}

// ============================================
// 分层采样 DBSCAN（批量分类方案）
// ============================================

function sampledDbscan(
  points: number[][],
  sampleRatio: number = 0.1,
): number[] {
  const n = points.length;
  const sampleSize = Math.max(50, Math.floor(n * sampleRatio));

  // 1. 随机采样
  const sampleIndices = Array.from({ length: n }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  const samplePoints = sampleIndices.map((i) => points[i]);

  // 2. 对采样点做 DBSCAN
  const sampleLabels = existingDbscan(samplePoints, 0.35, 3);

  // 3. 计算簇质心
  const clusterCentroids = new Map<number, number[]>();
  const clusterCounts = new Map<number, number>();

  for (let i = 0; i < sampleLabels.length; i++) {
    const label = sampleLabels[i];
    if (label === -1) continue;

    if (!clusterCentroids.has(label)) {
      clusterCentroids.set(label, new Array(points[0].length).fill(0));
      clusterCounts.set(label, 0);
    }

    const centroid = clusterCentroids.get(label)!;
    const point = samplePoints[i];
    for (let d = 0; d < point.length; d++) {
      centroid[d] += point[d];
    }
    clusterCounts.set(label, clusterCounts.get(label)! + 1);
  }

  // 归一化质心
  for (const [label, centroid] of clusterCentroids) {
    const count = clusterCounts.get(label)!;
    for (let d = 0; d < centroid.length; d++) {
      centroid[d] /= count;
    }
  }

  // 4. 将所有点分配到最近的簇
  const labels: number[] = new Array(n).fill(-1);
  const centroids = Array.from(clusterCentroids.entries());

  for (let i = 0; i < n; i++) {
    let bestLabel = -1;
    let bestSimilarity = 0.65; // 阈值

    for (const [label, centroid] of centroids) {
      const similarity = cosineSimilarity(points[i], centroid);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestLabel = label;
      }
    }

    labels[i] = bestLabel;
  }

  return labels;
}

// ============================================
// 基准测试运行器
// ============================================

async function runBenchmark(
  name: string,
  clusterFn: (points: number[][]) => number[],
  points: number[][],
): Promise<BenchmarkResult> {
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  try {
    const labels = clusterFn(points);
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const uniqueLabels = new Set(labels.filter((l) => l !== -1));
    const noiseCount = labels.filter((l) => l === -1).length;

    return {
      name,
      pointCount: points.length,
      dimensions: points[0].length,
      executionTimeMs: Math.round(endTime - startTime),
      clusterCount: uniqueLabels.size,
      noiseCount,
      memoryUsageMB: Math.round((endMemory - startMemory) / 1024 / 1024 * 100) / 100,
      success: true,
    };
  } catch (error) {
    return {
      name,
      pointCount: points.length,
      dimensions: points[0].length,
      executionTimeMs: 0,
      clusterCount: 0,
      noiseCount: 0,
      memoryUsageMB: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 主测试流程
// ============================================

async function main() {
  console.log('='.repeat(70));
  console.log('HDBSCAN 技术验证 - 性能基准测试');
  console.log('='.repeat(70));
  console.log();

  // 测试配置
  const testConfigs = [
    { points: 100, dims: 1536, label: '小规模 (100点)' },
    { points: 500, dims: 1536, label: '中规模 (500点)' },
    { points: 1000, dims: 1536, label: '目标规模 (1000点)' },
    { points: 2000, dims: 1536, label: '压力测试 (2000点)' },
  ];

  const algorithms: Array<{ name: string; fn: (p: number[][]) => number[] }> = [
    { name: '现有 DBSCAN', fn: (p) => existingDbscan(p, 0.35, 3) },
    { name: '迭代式 DBSCAN', fn: (p) => iterativeDbscan(p, 0.7, 5) },
    { name: '简化 HDBSCAN', fn: (p) => simpleHdbscan(p, 3, 2) },
    { name: '分层采样 DBSCAN', fn: (p) => sampledDbscan(p, 0.1) },
  ];

  const results: BenchmarkResult[] = [];

  for (const config of testConfigs) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`测试: ${config.label} (${config.dims} 维向量)`);
    console.log('─'.repeat(70));

    const points = generateTestData(config.points, config.dims, 10);
    console.log(`生成 ${points.length} 个测试点，期望 ~10 个簇\n`);

    for (const algo of algorithms) {
      // 跳过大规模的慢算法
      if (config.points >= 2000 && algo.name.includes('现有 DBSCAN')) {
        console.log(`⏭️  ${algo.name}: 跳过 (预计耗时过长)`);
        continue;
      }

      process.stdout.write(`🔄 ${algo.name}: 运行中...`);

      const result = await runBenchmark(algo.name, algo.fn, points);
      results.push(result);

      if (result.success) {
        const clusterRatio = ((config.points - result.noiseCount) / config.points * 100).toFixed(1);
        console.log(
          `\r✅ ${algo.name}: ${result.executionTimeMs}ms | ` +
          `${result.clusterCount} 簇 | ${clusterRatio}% 覆盖率 | ` +
          `${result.memoryUsageMB}MB`
        );
      } else {
        console.log(`\r❌ ${algo.name}: 失败 - ${result.error}`);
      }
    }
  }

  // 生成汇总报告
  console.log('\n' + '='.repeat(70));
  console.log('汇总报告');
  console.log('='.repeat(70));

  // 按算法分组
  const algorithmGroups = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    if (!algorithmGroups.has(result.name)) {
      algorithmGroups.set(result.name, []);
    }
    algorithmGroups.get(result.name)!.push(result);
  }

  console.log('\n📊 性能对比 (1000 点基准):');
  console.log('─'.repeat(70));

  const target1000 = results.filter((r) => r.pointCount === 1000 && r.success);
  target1000.sort((a, b) => a.executionTimeMs - b.executionTimeMs);

  for (const result of target1000) {
    const clusterRatio = ((1000 - result.noiseCount) / 1000 * 100).toFixed(1);
    console.log(
      `  ${result.name.padEnd(20)} | ` +
      `${String(result.executionTimeMs).padStart(6)}ms | ` +
      `${String(result.clusterCount).padStart(3)} 簇 | ` +
      `${clusterRatio.padStart(5)}% 覆盖`
    );
  }

  // 推荐方案
  console.log('\n💡 推荐方案:');
  console.log('─'.repeat(70));

  const fastest1000 = target1000[0];
  const bestCoverage = target1000.reduce((best, r) => {
    const ratio = (1000 - r.noiseCount) / 1000;
    const bestRatio = (1000 - best.noiseCount) / 1000;
    return ratio > bestRatio ? r : best;
  });

  console.log(`  🚀 最快: ${fastest1000?.name} (${fastest1000?.executionTimeMs}ms)`);
  console.log(`  📈 最高覆盖率: ${bestCoverage?.name} (${((1000 - bestCoverage.noiseCount) / 1000 * 100).toFixed(1)}%)`);

  // 实施建议
  console.log('\n📋 实施建议:');
  console.log('─'.repeat(70));
  console.log(`
  1. 生产方案: 分层采样 DBSCAN
     - 复��度从 O(n²) 降到 O(n×k)
     - 1000 点预计 < 500ms
     - 可完全复用现有代码

  2. 备选方案: 简化 HDBSCAN
     - 自动发现多密度簇
     - 无需手动调参 eps
     - 但需要额外实现/引入依赖

  3. 第三方库评估:
     - hdbscan-ts: TypeScript 原生，2025年更新，推荐试用
     - clusternova: TypeScript 实现，2025年1月更新
     - density-clustering: 成熟稳定，但仅支持 DBSCAN

  4. 下一步:
     - 安装 hdbscan-ts 进行真实对比
     - 使用真实书签向量验证效果
     - 考虑 Web Worker 隔离避免阻塞主线程
  `);

  console.log('\n' + '='.repeat(70));
  console.log('测试完成');
  console.log('='.repeat(70));
}

main().catch(console.error);
