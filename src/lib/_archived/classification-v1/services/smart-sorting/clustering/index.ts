/**
 * 聚类模块索引
 *
 * @module classification/smart-sorting/clustering
 * @version 1.0.0
 * @since 2025-12-25
 */

export { performClustering } from "./dbscan";
export {
  computeSimilarityMatrix,
  cosineSimilarity,
  computeCentroid,
  computeAverageSimilarity,
} from "./similarity";
