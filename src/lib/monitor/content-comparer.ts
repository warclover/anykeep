/**
 * 内容对比服务
 *
 * 负责对比页面内容的变化
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import * as Diff from "diff";
import type { ContentCompareResult } from "./types";

/**
 * 对比两个文本内容的差异
 *
 * @param oldContent - 旧内容
 * @param newContent - 新内容
 * @returns 对比结果
 */
export function compareContent(
  oldContent: string,
  newContent: string,
): ContentCompareResult {
  // 使用 diff 库进行行级对比
  const diffResult = Diff.diffLines(oldContent || "", newContent || "");

  let addedLines = 0;
  let removedLines = 0;
  let unchangedLines = 0;

  for (const part of diffResult) {
    const lines = part.value.split("\n").filter((line) => line.length > 0);
    const lineCount = lines.length;

    if (part.added) {
      addedLines += lineCount;
    } else if (part.removed) {
      removedLines += lineCount;
    } else {
      unchangedLines += lineCount;
    }
  }

  // 计算相似度分数 (0-100)
  const totalLines = addedLines + removedLines + unchangedLines;
  const similarityScore =
    totalLines === 0 ? 100 : Math.round((unchangedLines / totalLines) * 100);

  // 判断是否有变化
  const hasChanged = addedLines > 0 || removedLines > 0;

  // 生成变更摘要
  const changeSummary = generateChangeSummary(
    addedLines,
    removedLines,
    similarityScore,
    hasChanged,
  );

  return {
    hasChanged,
    similarityScore,
    changeSummary,
    addedLines,
    removedLines,
  };
}

/**
 * 通过哈希快速检查是否有变化
 *
 * @param oldHash - 旧内容哈希
 * @param newHash - 新内容哈希
 * @returns 是否有变化
 */
export function hasContentChanged(
  oldHash: string | null,
  newHash: string | null,
): boolean {
  if (!oldHash || !newHash) return true;
  return oldHash !== newHash;
}

/**
 * 生成变更摘要
 */
function generateChangeSummary(
  addedLines: number,
  removedLines: number,
  similarityScore: number,
  hasChanged: boolean,
): string {
  if (!hasChanged) {
    return "内容无变化";
  }

  const parts: string[] = [];

  if (addedLines > 0) {
    parts.push(`新增 ${addedLines} 行`);
  }
  if (removedLines > 0) {
    parts.push(`删除 ${removedLines} 行`);
  }

  const changeLevel = getChangeLevel(similarityScore);
  const summary = parts.join("，");

  return `${changeLevel}：${summary}，相似度 ${similarityScore}%`;
}

/**
 * 根据相似度获取变更等级
 */
function getChangeLevel(similarityScore: number): string {
  if (similarityScore >= 95) return "微小变更";
  if (similarityScore >= 80) return "轻微变更";
  if (similarityScore >= 50) return "显著变更";
  return "重大变更";
}

/**
 * 判断是否为显著变更
 *
 * @param similarityScore - 相似度分数
 * @returns 是否显著变更
 */
export function isSignificantChange(similarityScore: number): boolean {
  return similarityScore < 80;
}

/**
 * 判断是否需要发送通知
 *
 * @param similarityScore - 相似度分数
 * @param notificationEnabled - 是否启用通知
 * @returns 是否发送通知
 */
export function shouldSendNotification(
  similarityScore: number,
  notificationEnabled: boolean,
): boolean {
  if (!notificationEnabled) return false;
  // 仅对显著变更发送通知
  return isSignificantChange(similarityScore);
}
