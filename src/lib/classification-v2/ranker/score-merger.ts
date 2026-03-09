/**
 * ScoreMerger - 加权分数融合
 *
 * 将多个 Scorer 的评分结果，按权重合并为统一的排序分数。
 *
 * 设计要点：
 * - 增量式融合：每个 tier 完成后调用一次，累积到已有结果上
 * - 自适应信号强度：如果某个 Scorer 的 Top1 与 Top2 差距大，
 *   说明该 Scorer 对这次分类更有把握，动态提高其有效权重
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import type { Score, MergedScore, FolderContext } from "../types";

/**
 * 将一组 Scorer 的评分结果融合到已有的累积分数中
 *
 * @param accumulated - 当前已累积的融合分数（首次调用时为空 Map）
 * @param scorerResults - 本 tier 各 Scorer 的结果
 * @param scorerWeights - 各 Scorer 的权重 Map<scorerName, weight>
 * @param candidates - 候选文件夹列表（用于补充 folderName）
 * @returns 更新后的 accumulated Map
 */
export function mergeScores(
  accumulated: Map<number, MergedScore>,
  scorerResults: Array<{ name: string; scores: Map<number, Score> }>,
  scorerWeights: Map<string, number>,
  candidates: FolderContext[],
): Map<number, MergedScore> {
  const folderNameMap = new Map(candidates.map((c) => [c.id, c.name]));

  for (const { name: scorerName, scores } of scorerResults) {
    const weight = scorerWeights.get(scorerName) ?? 0;
    if (weight === 0 || scores.size === 0) continue;

    // 自适应权重：Scorer 的区分度越高，有效权重越高
    const effectiveWeight = weight * computeDiscriminationBonus(scores);

    for (const [folderId, score] of scores) {
      const existing = accumulated.get(folderId);

      if (existing) {
        // 增量累加
        const newValue = existing.value + score.value * effectiveWeight;
        const newConfidence = Math.max(existing.confidence, score.confidence);

        accumulated.set(folderId, {
          ...existing,
          value: newValue,
          confidence: newConfidence,
          breakdown: {
            ...existing.breakdown,
            [scorerName]: score.value,
          },
          signals: [...existing.signals, ...score.signals],
        });
      } else {
        // 首次出现
        accumulated.set(folderId, {
          folderId,
          folderName: folderNameMap.get(folderId) ?? `folder_${folderId}`,
          value: score.value * effectiveWeight,
          confidence: score.confidence,
          breakdown: { [scorerName]: score.value },
          signals: [...score.signals],
        });
      }
    }
  }

  return accumulated;
}

/**
 * 从融合结果中提取 Top-K
 *
 * @param accumulated - 融合后的分数 Map
 * @param topK - 返回前几名
 * @returns 按分数降序排列的 Top-K 结果
 */
export function getTopK(
  accumulated: Map<number, MergedScore>,
  topK: number,
): MergedScore[] {
  return Array.from(accumulated.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, topK);
}

/**
 * 计算区分度奖励系数
 *
 * 如果 Scorer 的 Top1 分数远超 Top2，说明它对这次分类更有把握。
 * 返回 1.0-1.3 的乘数。
 */
function computeDiscriminationBonus(scores: Map<number, Score>): number {
  if (scores.size < 2) return 1.0;

  const sorted = Array.from(scores.values())
    .map((s) => s.value)
    .sort((a, b) => b - a);

  const gap = sorted[0] - sorted[1];

  // gap 在 0-0.3 范围内线性映射到 1.0-1.3
  return 1.0 + Math.min(gap, 0.3);
}

/**
 * 归一化融合分数到 0-1 范围
 *
 * 由于是多个 Scorer 的加权叠加，原始 value 可能超过 1。
 * 在最终输出前调用此函数归一化。
 */
export function normalizeMergedScores(
  accumulated: Map<number, MergedScore>,
): Map<number, MergedScore> {
  const maxValue = Math.max(
    ...Array.from(accumulated.values()).map((s) => s.value),
    0.001, // 避免除以 0
  );

  if (maxValue <= 1.0) return accumulated;

  for (const [folderId, score] of accumulated) {
    accumulated.set(folderId, {
      ...score,
      value: score.value / maxValue,
    });
  }

  return accumulated;
}
