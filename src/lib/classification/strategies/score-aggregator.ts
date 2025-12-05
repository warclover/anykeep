/**
 * Score Aggregator
 * Aggregates results from multiple matchers into a final classification decision
 */

import type { IScoreAggregator, IMatcher } from './interfaces'
import type { MatchResult, ClassificationResult } from '../types'
import { CLASSIFICATION_THRESHOLDS } from '../constants'

/**
 * Weighted score aggregator
 * Combines scores from multiple matchers using their configured weights
 */
export class WeightedScoreAggregator implements IScoreAggregator {
  private lowConfidenceThreshold: number

  constructor(options?: { lowConfidenceThreshold?: number }) {
    this.lowConfidenceThreshold = options?.lowConfidenceThreshold ?? CLASSIFICATION_THRESHOLDS.LOW_CONFIDENCE
  }

  /**
   * Aggregate results from all matchers
   */
  aggregate(
    results: Map<string, MatchResult[]>,
    matchers: IMatcher[]
  ): ClassificationResult {
    // Build weight map
    const weights = new Map<string, number>()
    for (const matcher of matchers) {
      weights.set(matcher.name, matcher.weight)
    }

    // Collect all unique folder IDs
    const folderScores = new Map<number, {
      folderName: string
      vectorScore: number
      historyScore: number
      aiScore: number
      reasons: string[]
    }>()

    // Process vector results
    const vectorResults = results.get('vector') || []
    for (const result of vectorResults) {
      if (!folderScores.has(result.folderId)) {
        folderScores.set(result.folderId, {
          folderName: result.folderName,
          vectorScore: 0,
          historyScore: 0,
          aiScore: 0,
          reasons: [],
        })
      }
      const entry = folderScores.get(result.folderId)!
      entry.vectorScore = result.score
      entry.reasons.push(`Vector: ${result.score}%`)
    }

    // Process history results
    const historyResults = results.get('history') || []
    for (const result of historyResults) {
      if (!folderScores.has(result.folderId)) {
        folderScores.set(result.folderId, {
          folderName: result.folderName,
          vectorScore: 0,
          historyScore: 0,
          aiScore: 0,
          reasons: [],
        })
      }
      const entry = folderScores.get(result.folderId)!
      entry.historyScore = result.score
      entry.reasons.push(`History: ${result.score}%`)
    }

    // Process AI results
    const aiResults = results.get('ai') || []
    for (const result of aiResults) {
      if (!folderScores.has(result.folderId)) {
        folderScores.set(result.folderId, {
          folderName: result.folderName,
          vectorScore: 0,
          historyScore: 0,
          aiScore: 0,
          reasons: [],
        })
      }
      const entry = folderScores.get(result.folderId)!
      entry.aiScore = result.score
      entry.reasons.push(`AI: ${result.score}%`)
    }

    // Calculate weighted scores
    const vectorWeight = weights.get('vector') || 0
    const historyWeight = weights.get('history') || 0
    const aiWeight = weights.get('ai') || 0

    const scoredFolders = Array.from(folderScores.entries()).map(([folderId, data]) => {
      const totalWeight = vectorWeight + historyWeight + aiWeight
      const weightedScore = totalWeight > 0
        ? (data.vectorScore * vectorWeight + data.historyScore * historyWeight + data.aiScore * aiWeight) / totalWeight
        : 0

      return {
        folderId,
        folderName: data.folderName,
        score: Math.round(weightedScore),
        vectorScore: data.vectorScore,
        historyScore: data.historyScore,
        aiScore: data.aiScore,
        reasons: data.reasons,
      }
    })

    // Sort by weighted score
    scoredFolders.sort((a, b) => b.score - a.score)

    // Get best match
    const bestMatch = scoredFolders[0]

    // Determine action
    if (!bestMatch || bestMatch.score < this.lowConfidenceThreshold) {
      // Low confidence - go to inbox
      return {
        folderId: null,
        folderName: '待整理',
        confidence: bestMatch?.score ?? 0,
        reason: bestMatch
          ? `Confidence ${bestMatch.score}% below threshold ${this.lowConfidenceThreshold}%`
          : 'No matching folders found',
        action: 'inbox',
        scores: {
          vectorScore: bestMatch?.vectorScore ?? 0,
          historyScore: bestMatch?.historyScore ?? 0,
          aiScore: bestMatch?.aiScore ?? 0,
        },
        matchDetails: scoredFolders.slice(0, 5).map(f => ({
          folderId: f.folderId,
          folderName: f.folderName,
          score: f.score,
          confidence: f.score,
          reason: f.reasons.join(', '),
        })),
      }
    }

    // High enough confidence - classify
    return {
      folderId: bestMatch.folderId,
      folderName: bestMatch.folderName,
      confidence: bestMatch.score,
      reason: bestMatch.reasons.join(', '),
      action: 'classify',
      scores: {
        vectorScore: bestMatch.vectorScore,
        historyScore: bestMatch.historyScore,
        aiScore: bestMatch.aiScore,
      },
      matchDetails: scoredFolders.slice(0, 5).map(f => ({
        folderId: f.folderId,
        folderName: f.folderName,
        score: f.score,
        confidence: f.score,
        reason: f.reasons.join(', '),
      })),
    }
  }
}
