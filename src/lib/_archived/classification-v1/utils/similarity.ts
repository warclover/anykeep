/**
 * Similarity calculation utilities
 */

/**
 * Calculate cosine similarity between two vectors
 * Returns 0 if vectors are invalid or have different lengths (graceful degradation)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  // 安全检查：确保向量有效
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) {
    return 0;
  }

  // 安全检查：向量长度必须一致且非空
  if (a.length !== b.length || a.length === 0) {
    // 优雅降级：返回 0 表示不相似，而不是抛出错误
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Calculate euclidean distance between two vectors
 * Returns Infinity if vectors are invalid or have different lengths
 */
export function euclideanDistance(a: number[], b: number[]): number {
  // 安全检查
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) {
    return Infinity;
  }

  if (a.length !== b.length || a.length === 0) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate centroid (average) of multiple vectors
 */
export function calculateCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    return [];
  }

  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vector[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

/**
 * Calculate average similarity of vectors to their centroid
 */
export function calculateInternalSimilarity(vectors: number[][]): number {
  if (vectors.length < 2) {
    return 1; // Single vector is perfectly similar to itself
  }

  const centroid = calculateCentroid(vectors);
  let totalSimilarity = 0;

  for (const vector of vectors) {
    totalSimilarity += cosineSimilarity(vector, centroid);
  }

  return totalSimilarity / vectors.length;
}

/**
 * Find top-k most similar vectors to a query
 */
export function findTopKSimilar(
  query: number[],
  vectors: Array<{ id: number; embedding: number[] }>,
  k: number,
): Array<{ id: number; similarity: number }> {
  const similarities = vectors.map((v) => ({
    id: v.id,
    similarity: cosineSimilarity(query, v.embedding),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, k);
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (norm === 0) {
    return vector;
  }

  return vector.map((val) => val / norm);
}
