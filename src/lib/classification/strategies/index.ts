/**
 * Strategy layer exports
 */

export * from "./interfaces";
export { VectorMatcher } from "./vector-matcher";
export { HistoryMatcher } from "./history-matcher";
export { AIRecommender } from "./ai-recommender";
export { WeightedScoreAggregator } from "./score-aggregator";

// V4.2: Negative Sample Matcher
export {
  NegativeSampleMatcher,
  negativeSampleMatcher,
} from "./negative-sample-matcher";

export type {
  NegativeSampleMatcherConfig,
  NegativeSampleMatcherContext,
} from "./negative-sample-matcher";
