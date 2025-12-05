/**
 * Strategy interfaces for classification system
 */

import type {
  MatchResult,
  MatcherContext,
  ClassificationResult,
} from '../types'

/**
 * Matcher strategy interface
 * All matching strategies must implement this interface
 */
export interface IMatcher {
  /** Strategy name */
  readonly name: string

  /** Strategy weight (0-1) */
  readonly weight: number

  /**
   * Execute matching
   * @param context Matcher context
   * @returns Match results list
   */
  match(context: MatcherContext): Promise<MatchResult[]>

  /**
   * Check if strategy is available
   * @param context Matcher context
   * @returns Whether available
   */
  isAvailable(context: MatcherContext): Promise<boolean>
}

/**
 * Score aggregator interface
 */
export interface IScoreAggregator {
  /**
   * Aggregate results from multiple matchers
   * @param results Results from each matcher (keyed by matcher name)
   * @param matchers Matcher list (for getting weights)
   * @returns Final classification result
   */
  aggregate(
    results: Map<string, MatchResult[]>,
    matchers: IMatcher[]
  ): ClassificationResult
}

/**
 * Matcher options
 */
export interface MatcherOptions {
  /** Custom weight override */
  weight?: number
  /** Custom thresholds */
  thresholds?: Record<string, number>
}
