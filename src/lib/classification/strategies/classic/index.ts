/**
 * Classic Strategy (V4.2) - 匹配器模块导出
 *
 * 包含向量匹配、历史匹配、AI推荐等经典分类策略
 */

export * from "./interfaces";
export { VectorMatcher } from "./vector-matcher";
export type { ZoneAwareVectorMatchDetail } from "./vector-matcher";
export { HistoryMatcher } from "./history-matcher";
export { AIRecommender } from "./ai-recommender";
export { WeightedScoreAggregator } from "./score-aggregator";

// V4.2: Negative Sample Matcher - 类型导出（安全）
export type {
  NegativeSampleMatcherConfig,
  NegativeSampleMatcherContext,
} from "./negative-sample-matcher";

// 注意：NegativeSampleMatcher 和 negativeSampleMatcher 实例
// 依赖服务端代码，需从 "./negative-sample-matcher" 直接导入
