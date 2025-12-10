/**
 * Similarity Utilities Unit Tests
 * 测试向量相似度计算核心函数
 */

import {
  cosineSimilarity,
  euclideanDistance,
  calculateCentroid,
  calculateInternalSimilarity,
  findTopKSimilar,
  normalizeVector,
} from "../utils/similarity";

describe("cosineSimilarity", () => {
  it("should return 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("should return -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it("should return 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("should handle normalized vectors correctly", () => {
    // Two normalized vectors at 45 degrees
    const a = [1, 0];
    const b = [Math.SQRT1_2, Math.SQRT1_2]; // cos(45°) ≈ 0.707
    expect(cosineSimilarity(a, b)).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("should return 0 for vectors of different lengths (graceful degradation)", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    // 优雅降级：返回 0 表示不相似，而不是抛出错误
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("should return 0 when one vector is zero", () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("should be commutative", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

describe("euclideanDistance", () => {
  it("should return 0 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(euclideanDistance(v, v)).toBe(0);
  });

  it("should calculate correct distance for simple case", () => {
    const a = [0, 0];
    const b = [3, 4];
    expect(euclideanDistance(a, b)).toBe(5); // 3-4-5 triangle
  });

  it("should calculate correct distance in 3D", () => {
    const a = [0, 0, 0];
    const b = [1, 1, 1];
    expect(euclideanDistance(a, b)).toBeCloseTo(Math.sqrt(3), 5);
  });

  it("should return Infinity for vectors of different lengths (graceful degradation)", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    // 优雅降级：返回 Infinity 表示无限距离，而不是抛出错误
    expect(euclideanDistance(a, b)).toBe(Infinity);
  });

  it("should be commutative", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(euclideanDistance(a, b)).toBeCloseTo(euclideanDistance(b, a), 10);
  });
});

describe("calculateCentroid", () => {
  it("should return empty array for empty input", () => {
    expect(calculateCentroid([])).toEqual([]);
  });

  it("should return the vector itself for single vector", () => {
    const v = [1, 2, 3];
    expect(calculateCentroid([v])).toEqual([1, 2, 3]);
  });

  it("should calculate correct centroid for two vectors", () => {
    const vectors = [
      [0, 0],
      [2, 4],
    ];
    expect(calculateCentroid(vectors)).toEqual([1, 2]);
  });

  it("should calculate correct centroid for multiple vectors", () => {
    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    // Centroid: (1+4+7)/3, (2+5+8)/3, (3+6+9)/3 = 4, 5, 6
    expect(calculateCentroid(vectors)).toEqual([4, 5, 6]);
  });

  it("should handle negative values", () => {
    const vectors = [
      [-1, -2],
      [1, 2],
    ];
    expect(calculateCentroid(vectors)).toEqual([0, 0]);
  });
});

describe("calculateInternalSimilarity", () => {
  it("should return 1 for single vector", () => {
    const vectors = [[1, 2, 3]];
    expect(calculateInternalSimilarity(vectors)).toBe(1);
  });

  it("should return 1 for identical vectors", () => {
    const v = [1, 2, 3];
    const vectors = [v, v, v];
    expect(calculateInternalSimilarity(vectors)).toBeCloseTo(1, 5);
  });

  it("should return lower similarity for diverse vectors", () => {
    const vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const similarity = calculateInternalSimilarity(vectors);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it("should return higher similarity for similar vectors", () => {
    const vectors = [
      [1, 0.1, 0],
      [1, 0, 0.1],
      [1, 0.05, 0.05],
    ];
    const similarity = calculateInternalSimilarity(vectors);
    expect(similarity).toBeGreaterThan(0.9);
  });
});

describe("findTopKSimilar", () => {
  it("should return empty array for empty vectors", () => {
    const query = [1, 2, 3];
    expect(findTopKSimilar(query, [], 5)).toEqual([]);
  });

  it("should return all vectors if k is larger than array size", () => {
    const query = [1, 0, 0];
    const vectors = [
      { id: 1, embedding: [1, 0, 0] },
      { id: 2, embedding: [0, 1, 0] },
    ];
    const result = findTopKSimilar(query, vectors, 10);
    expect(result.length).toBe(2);
  });

  it("should return top k most similar vectors", () => {
    const query = [1, 0, 0];
    const vectors = [
      { id: 1, embedding: [1, 0, 0] }, // similarity: 1
      { id: 2, embedding: [0.9, 0.1, 0] }, // similarity: ~0.99
      { id: 3, embedding: [0, 1, 0] }, // similarity: 0
      { id: 4, embedding: [0.5, 0.5, 0] }, // similarity: ~0.71
    ];
    const result = findTopKSimilar(query, vectors, 2);

    expect(result.length).toBe(2);
    expect(result[0].id).toBe(1); // Most similar
    expect(result[0].similarity).toBeCloseTo(1, 2);
    expect(result[1].id).toBe(2); // Second most similar
  });

  it("should sort by similarity descending", () => {
    const query = [1, 1, 1];
    const vectors = [
      { id: 1, embedding: [1, 0, 0] },
      { id: 2, embedding: [1, 1, 0] },
      { id: 3, embedding: [1, 1, 1] },
    ];
    const result = findTopKSimilar(query, vectors, 3);

    expect(result[0].id).toBe(3); // Identical
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(1);

    // Verify descending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].similarity).toBeGreaterThanOrEqual(
        result[i].similarity,
      );
    }
  });
});

describe("normalizeVector", () => {
  it("should return same vector for zero vector", () => {
    const v = [0, 0, 0];
    expect(normalizeVector(v)).toEqual([0, 0, 0]);
  });

  it("should normalize unit vector to itself", () => {
    const v = [1, 0, 0];
    const normalized = normalizeVector(v);
    expect(normalized).toEqual([1, 0, 0]);
  });

  it("should normalize to unit length", () => {
    const v = [3, 4, 0];
    const normalized = normalizeVector(v);
    // Length should be 1
    const length = Math.sqrt(
      normalized.reduce((sum, val) => sum + val * val, 0),
    );
    expect(length).toBeCloseTo(1, 5);
    // Check values: 3/5, 4/5, 0
    expect(normalized[0]).toBeCloseTo(0.6, 5);
    expect(normalized[1]).toBeCloseTo(0.8, 5);
    expect(normalized[2]).toBe(0);
  });

  it("should preserve direction", () => {
    const v = [2, 4, 6];
    const normalized = normalizeVector(v);
    // Ratios should be same: 1:2:3
    expect(normalized[1] / normalized[0]).toBeCloseTo(2, 5);
    expect(normalized[2] / normalized[0]).toBeCloseTo(3, 5);
  });

  it("should work with negative values", () => {
    const v = [-3, 4, 0];
    const normalized = normalizeVector(v);
    const length = Math.sqrt(
      normalized.reduce((sum, val) => sum + val * val, 0),
    );
    expect(length).toBeCloseTo(1, 5);
    expect(normalized[0]).toBeLessThan(0);
    expect(normalized[1]).toBeGreaterThan(0);
  });
});
