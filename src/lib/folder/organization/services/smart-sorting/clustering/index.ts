/**
 * 聚类模块索引
 *
 * @module folder/organization/services/smart-sorting/clustering
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

export { performClustering } from "./dbscan";
export {
  computeSimilarityMatrix,
  cosineSimilarity,
  computeCentroid,
  computeAverageSimilarity,
} from "./similarity";
