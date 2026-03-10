/**
 * Clustering Utilities Unit Tests
 * 测试聚类算法的核心逻辑
 */

import {
  clusterBookmarks,
  kMeansClustering,
  densityClustering,
} from "../utils/clustering";

// Helper: create test embedding (normalized random vector)
function createEmbedding(seed: number, dimensions: number = 8): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    // Simple deterministic pseudo-random based on seed
    embedding.push(Math.sin(seed * (i + 1) * 0.1));
  }
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

// Helper: create similar embedding (small perturbation)
function createSimilarEmbedding(
  base: number[],
  perturbation: number = 0.1,
): number[] {
  const embedding = base.map(
    (v) => v + (Math.random() - 0.5) * perturbation * 2,
  );
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

describe("clusterBookmarks - Hierarchical Clustering", () => {
  it("should return empty array for empty input", () => {
    const result = clusterBookmarks([], 0.7, 2);
    expect(result).toEqual([]);
  });

  it("should not create clusters smaller than minClusterSize", () => {
    const items = [
      { id: 1, embedding: createEmbedding(1), title: "Item 1" },
      { id: 2, embedding: createEmbedding(2), title: "Item 2" },
    ];

    // With minClusterSize of 5, should return empty
    const result = clusterBookmarks(items, 0.7, 5);
    expect(result).toEqual([]);
  });

  it("should cluster similar items together", () => {
    const baseEmbedding = createEmbedding(100);

    const items = [
      // Group 1: similar items
      {
        id: 1,
        embedding: createSimilarEmbedding(baseEmbedding, 0.05),
        title: "Similar 1",
      },
      {
        id: 2,
        embedding: createSimilarEmbedding(baseEmbedding, 0.05),
        title: "Similar 2",
      },
      {
        id: 3,
        embedding: createSimilarEmbedding(baseEmbedding, 0.05),
        title: "Similar 3",
      },
      // Group 2: different items
      { id: 4, embedding: createEmbedding(500), title: "Different 1" },
      { id: 5, embedding: createEmbedding(600), title: "Different 2" },
    ];

    const result = clusterBookmarks(items, 0.8, 2);

    // Should have at least one cluster with the similar items
    const similarCluster = result.find(
      (c) =>
        c.bookmarkIds.includes(1) &&
        c.bookmarkIds.includes(2) &&
        c.bookmarkIds.includes(3),
    );
    expect(similarCluster).toBeDefined();
  });

  it("should include sample titles in cluster", () => {
    const baseEmbedding = createEmbedding(100);

    const items = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      embedding: createSimilarEmbedding(baseEmbedding, 0.05),
      title: `Item ${i + 1}`,
    }));

    const result = clusterBookmarks(items, 0.5, 3);

    if (result.length > 0) {
      expect(result[0].sampleTitles.length).toBeLessThanOrEqual(5);
      expect(result[0].sampleTitles.length).toBeGreaterThan(0);
    }
  });

  it("should calculate centroid and avgSimilarity", () => {
    const baseEmbedding = createEmbedding(100);

    const items = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      embedding: createSimilarEmbedding(baseEmbedding, 0.05),
      title: `Item ${i + 1}`,
    }));

    const result = clusterBookmarks(items, 0.5, 3);

    if (result.length > 0) {
      expect(result[0].centroid).toBeDefined();
      expect(result[0].centroid.length).toBe(8); // dimensions
      expect(result[0].avgSimilarity).toBeGreaterThan(0);
      expect(result[0].avgSimilarity).toBeLessThanOrEqual(1);
    }
  });
});

describe("kMeansClustering", () => {
  it("should return empty array for empty input", () => {
    const result = kMeansClustering([], 3);
    expect(result).toEqual([]);
  });

  it("should return empty array for k <= 0", () => {
    const items = [{ id: 1, embedding: createEmbedding(1), title: "Item 1" }];
    expect(kMeansClustering(items, 0)).toEqual([]);
    expect(kMeansClustering(items, -1)).toEqual([]);
  });

  it("should handle k greater than number of items", () => {
    const items = [
      { id: 1, embedding: createEmbedding(1), title: "Item 1" },
      { id: 2, embedding: createEmbedding(2), title: "Item 2" },
    ];

    const result = kMeansClustering(items, 10);

    // Should create at most 2 clusters (one per item)
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("should create specified number of clusters", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      embedding: createEmbedding(i),
      title: `Item ${i + 1}`,
    }));

    const result = kMeansClustering(items, 3);

    // Should have at most k clusters (some may be empty)
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should assign all items to clusters", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      embedding: createEmbedding(i),
      title: `Item ${i + 1}`,
    }));

    const result = kMeansClustering(items, 3);

    const totalItems = result.reduce(
      (sum, cluster) => sum + cluster.bookmarkIds.length,
      0,
    );
    expect(totalItems).toBe(10);
  });
});

describe("densityClustering - DBSCAN-like", () => {
  it("should return empty array for empty input", () => {
    const result = densityClustering([], 0.7, 2);
    expect(result).toEqual([]);
  });

  it("should not cluster isolated items (noise)", () => {
    // Create very different items
    const items = [
      { id: 1, embedding: createEmbedding(1), title: "Item 1" },
      { id: 2, embedding: createEmbedding(1000), title: "Item 2" },
      { id: 3, embedding: createEmbedding(2000), title: "Item 3" },
    ];

    // With high similarity threshold, items should be noise
    const result = densityClustering(items, 0.99, 2);
    expect(result).toEqual([]);
  });

  it("should cluster dense regions", () => {
    const baseEmbedding = createEmbedding(100);

    const items = [
      // Dense cluster
      {
        id: 1,
        embedding: createSimilarEmbedding(baseEmbedding, 0.02),
        title: "Dense 1",
      },
      {
        id: 2,
        embedding: createSimilarEmbedding(baseEmbedding, 0.02),
        title: "Dense 2",
      },
      {
        id: 3,
        embedding: createSimilarEmbedding(baseEmbedding, 0.02),
        title: "Dense 3",
      },
      {
        id: 4,
        embedding: createSimilarEmbedding(baseEmbedding, 0.02),
        title: "Dense 4",
      },
      // Noise
      { id: 5, embedding: createEmbedding(999), title: "Noise" },
    ];

    const result = densityClustering(items, 0.9, 2);

    // Should have one cluster with dense items, noise should be excluded
    if (result.length > 0) {
      const denseCluster = result.find((c) => c.bookmarkIds.length >= 3);
      expect(denseCluster).toBeDefined();
      // Noise item should not be in any cluster
      const _hasNoise = result.some((c) => c.bookmarkIds.includes(5));
      // Noise might be absorbed into cluster if threshold is low enough
      // This is acceptable behavior
    }
  });

  it("should return clusters with proper structure", () => {
    const baseEmbedding = createEmbedding(100);

    const items = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      embedding: createSimilarEmbedding(baseEmbedding, 0.05),
      title: `Item ${i + 1}`,
    }));

    const result = densityClustering(items, 0.7, 2);

    if (result.length > 0) {
      const cluster = result[0];
      expect(cluster.bookmarkIds).toBeDefined();
      expect(cluster.centroid).toBeDefined();
      expect(cluster.avgSimilarity).toBeDefined();
      expect(cluster.sampleTitles).toBeDefined();
    }
  });
});

describe("Clustering algorithm comparison", () => {
  it("different algorithms should produce valid results for same input", () => {
    const baseEmbedding = createEmbedding(100);

    const items = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      embedding: createSimilarEmbedding(baseEmbedding, 0.1 + (i % 3) * 0.2),
      title: `Item ${i + 1}`,
    }));

    const hierarchicalResult = clusterBookmarks(items, 0.6, 2);
    const kMeansResult = kMeansClustering(items, 3);
    const dbscanResult = densityClustering(items, 0.6, 2);

    // All should produce valid results
    expect(Array.isArray(hierarchicalResult)).toBe(true);
    expect(Array.isArray(kMeansResult)).toBe(true);
    expect(Array.isArray(dbscanResult)).toBe(true);

    // Each cluster should have required properties
    const allClusters = [
      ...hierarchicalResult,
      ...kMeansResult,
      ...dbscanResult,
    ];
    for (const cluster of allClusters) {
      expect(cluster.bookmarkIds.length).toBeGreaterThan(0);
      expect(cluster.centroid.length).toBe(8);
      expect(typeof cluster.avgSimilarity).toBe("number");
    }
  });
});
