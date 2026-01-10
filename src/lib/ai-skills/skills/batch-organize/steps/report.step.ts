/**
 * 报告生成步骤
 *
 * 职责：
 * - 生成整理摘要
 * - 生成整理建议
 * - 构建确认消息
 * - 渲染专家级诊断报告
 *
 * @module ai-skills/skills/batch-organize/steps/report
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2026-01-10 - 添加专家模板支持
 */

import type { OrganizeStats, OrganizeAction } from "../types";
import {
  renderFullDiagnosisReport,
  renderConfirmation,
  renderComplete,
  renderEmpty,
  type CollectionStats,
  type ConfirmData,
  type CompleteData,
  ACTION_ICONS,
} from "../templates";

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

// ============================================
// 专家模板渲染（v1.1.0 新增）
// ============================================

/**
 * 渲染专家级诊断报告
 *
 * @param stats 收藏统计数据
 * @returns 格式化的诊断报告字符串
 */
export function renderExpertDiagnosisReport(stats: CollectionStats): string {
  return renderFullDiagnosisReport(stats);
}

/**
 * 渲染专家级确认消息
 *
 * @param optionName 选择的方案名称
 * @param stats 整理统计
 * @returns 格式化的确认消息字符串
 */
export function renderExpertConfirmation(
  optionName: string,
  stats: OrganizeStats,
): string {
  const actions: ConfirmData["actions"] = [];

  if (stats.categorizeSuggestions > 0) {
    actions.push({
      icon: ACTION_ICONS.categorize,
      name: "智能分类",
      count: stats.categorizeSuggestions,
    });
  }
  if (stats.tagSuggestions > 0) {
    actions.push({
      icon: ACTION_ICONS.tag,
      name: "自动打标",
      count: stats.tagSuggestions,
    });
  }
  if (stats.duplicatesFound > 0) {
    actions.push({
      icon: ACTION_ICONS.duplicate,
      name: "清理重复",
      count: stats.duplicatesFound,
    });
  }
  if (stats.archiveCandidates > 0) {
    actions.push({
      icon: ACTION_ICONS.archive,
      name: "归档旧内容",
      count: stats.archiveCandidates,
    });
  }

  const totalAffected =
    stats.categorizeSuggestions +
    stats.tagSuggestions +
    stats.duplicatesFound +
    stats.archiveCandidates;

  return renderConfirmation({
    optionName,
    actions,
    totalAffected,
    canUndo: true,
  });
}

/**
 * 渲染专家级完成报告
 *
 * @param before 整理前统计
 * @param after 整理后统计
 * @param nextSuggestion 下一步建议
 * @returns 格式化的完成报告字符串
 */
export function renderExpertComplete(
  before: CollectionStats,
  after: CollectionStats,
  nextSuggestion?: string,
): string {
  const stats: CompleteData["stats"] = [
    {
      label: "未分类",
      before: before.uncategorized,
      after: after.uncategorized,
    },
    { label: "重复项", before: before.duplicates, after: after.duplicates },
    { label: "无标签", before: before.untagged, after: after.untagged },
    { label: "长期未读", before: before.stale, after: after.stale },
  ];

  return renderComplete({ stats, nextSuggestion });
}

/**
 * 渲染空状态消息
 *
 * @returns 空状态消息字符串
 */
export function renderExpertEmpty(): string {
  return renderEmpty();
}

/**
 * 将 OrganizeStats 转换为 CollectionStats
 *
 * @param stats 整理统计
 * @param totalBookmarks 总书签数
 * @returns CollectionStats 格式
 */
export function toCollectionStats(
  stats: OrganizeStats,
  totalBookmarks: number,
): CollectionStats {
  return {
    total: totalBookmarks,
    uncategorized: stats.categorizeSuggestions,
    duplicates: stats.duplicatesFound,
    untagged: stats.tagSuggestions,
    stale: stats.archiveCandidates,
    invalidUrls: stats.invalidUrls,
  };
}
