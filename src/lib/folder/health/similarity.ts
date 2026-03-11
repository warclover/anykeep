/**
 * 余弦相似度计算
 *
 * 从 classification-v1/utils/similarity 提取，
 * 保留完整的安全检查逻辑。
 *
 * @module folder/health
 * @version 1.0.0
 * @since 2026-03-11
 */

/**
 * Calculate cosine similarity between two vectors
 * Returns 0 if vectors are invalid or have different lengths (graceful degradation)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) {
    return 0;
  }

  if (a.length !== b.length || a.length === 0) {
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
