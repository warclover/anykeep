/**
 * 向量相似度工具
 *
 * 从 classification/smart-sorting/clustering/similarity 精简迁入。
 * 仅保留 batch-classification 模块使用的 cosineSimilarity。
 *
 * @version 1.0.0
 * @since 2026-03-10
 */

/**
 * 余弦相似度计算
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
