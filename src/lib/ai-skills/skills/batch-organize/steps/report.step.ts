/**
 * 报告生成步骤
 *
 * 职责：
 * - 生成整理摘要
 * - 生成整理建议
 * - 构建确认消息
 *
 * @module ai-skills/skills/batch-organize/steps/report
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { OrganizeStats, OrganizeAction } from "../types";

// ============================================
// 摘要生成
// ============================================

/**
 * 生成摘要
 */
export function generateSummary(
  stats: OrganizeStats,
  _actions: OrganizeAction[],
): string {
  const parts: string[] = [];

  parts.push(`处理了 **${stats.totalProcessed}** 条书签`);

  if (stats.categorizeSuggestions > 0) {
    parts.push(`生成 **${stats.categorizeSuggestions}** 条分类建议`);
  }
  if (stats.tagSuggestions > 0) {
    parts.push(`生成 **${stats.tagSuggestions}** 条标签建议`);
  }
  if (stats.duplicatesFound > 0) {
    parts.push(`发现 **${stats.duplicatesFound}** 组重复书签`);
  }
  if (stats.archiveCandidates > 0) {
    parts.push(`发现 **${stats.archiveCandidates}** 条可归档内容`);
  }

  return parts.join("，") + "。";
}

// ============================================
// 建议生成
// ============================================

/**
 * 生成整理建议
 */
export function generateOrganizeSuggestions(stats: OrganizeStats): string[] {
  const suggestions: string[] = [];

  if (stats.categorizeSuggestions > 10) {
    suggestions.push("建议分批处理分类建议，每次处理 10-20 条以便仔细审核");
  }

  if (stats.duplicatesFound > 0) {
    suggestions.push("建议审核重复书签，保留最完整的版本");
  }

  if (stats.archiveCandidates > 20) {
    suggestions.push("旧书签较多，可以考虑创建「归档」文件夹统一管理");
  }

  if (suggestions.length === 0) {
    suggestions.push("您的书签整理状态良好，继续保持！");
  }

  return suggestions;
}

// ============================================
// 确认消息构建
// ============================================

/**
 * 构建确认消息
 */
export function buildConfirmationMessage(stats: OrganizeStats): string {
  const parts: string[] = [];

  if (stats.categorizeSuggestions > 0) {
    parts.push(`${stats.categorizeSuggestions} 条分类建议`);
  }
  if (stats.tagSuggestions > 0) {
    parts.push(`${stats.tagSuggestions} 条标签建议`);
  }
  if (stats.duplicatesFound > 0) {
    parts.push(`${stats.duplicatesFound} 组重复书签`);
  }
  if (stats.archiveCandidates > 0) {
    parts.push(`${stats.archiveCandidates} 条归档候选`);
  }

  if (parts.length === 0) {
    return "没有需要执行的整理操作。";
  }

  return `将执行以下整理操作：${parts.join("、")}。确认后将自动应用这些建议。`;
}
