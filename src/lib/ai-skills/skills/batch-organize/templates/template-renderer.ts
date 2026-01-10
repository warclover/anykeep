/**
 * 模板渲染器
 *
 * 将整理数据渲染为专业格式的输出文本
 * 使用简单的字符串替换而非 Mustache，减少依赖
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import {
  ORGANIZE_EXPERT_TEMPLATES,
  SEVERITY_ICONS,
  SEVERITY_LABELS,
  ACTION_ICONS,
  OPTION_LABELS,
  type OptionLabel,
} from "./expert-response";

// ============================================
// 类型定义
// ============================================

/**
 * 问题项
 */
export interface OrganizeIssue {
  /** 问题类型 */
  type: "uncategorized" | "untagged" | "duplicates" | "stale" | "invalid_urls";
  /** 问题标题 */
  title: string;
  /** 问题数量 */
  count: number;
  /** 严重程度 */
  severity: "critical" | "warning" | "info";
}

/**
 * 整理方案选项
 */
export interface OrganizeOption {
  /** 方案 ID */
  id: string;
  /** 方案名称 */
  name: string;
  /** 方案标签 */
  label: OptionLabel;
  /** 操作描述 */
  actions: string;
  /** 预计耗时 */
  duration: string;
}

/**
 * 诊断数据
 */
export interface DiagnosisData {
  /** 收藏统计 */
  stats: CollectionStats;
  /** 发现的问题 */
  issues: OrganizeIssue[];
  /** 整理方案选项 */
  options: OrganizeOption[];
}

/**
 * 收藏统计
 */
export interface CollectionStats {
  /** 总数 */
  total: number;
  /** 未分类数 */
  uncategorized: number;
  /** 重复数 */
  duplicates: number;
  /** 无标签数 */
  untagged: number;
  /** 长期未读数 */
  stale: number;
  /** 失效链接数 */
  invalidUrls?: number;
}

/**
 * 确认数据
 */
export interface ConfirmData {
  /** 方案名称 */
  optionName: string;
  /** 操作列表 */
  actions: Array<{
    icon: string;
    name: string;
    count: number;
  }>;
  /** 总影响数量 */
  totalAffected: number;
  /** 是否可撤销 */
  canUndo: boolean;
}

/**
 * 完成数据
 */
export interface CompleteData {
  /** 统计变化 */
  stats: Array<{
    label: string;
    before: number;
    after: number;
  }>;
  /** 下一步建议 */
  nextSuggestion?: string;
}

/**
 * 进度数据
 */
export interface ProgressData {
  /** 当前步骤 */
  currentStep: string;
  /** 进度百分比 */
  progress: number;
  /** 已处理数量 */
  processed: number;
  /** 总数量 */
  total: number;
}

// ============================================
// 模板渲染函数
// ============================================

/**
 * 渲染诊断报告
 */
export function renderDiagnosisReport(data: DiagnosisData): string {
  const { stats, issues, options } = data;

  // 构建问题列表部分
  const issuesText = issues
    .map((issue) => {
      const percentage =
        stats.total > 0 ? ((issue.count / stats.total) * 100).toFixed(1) : "0";
      return `│  ${SEVERITY_ICONS[issue.severity]} ${SEVERITY_LABELS[issue.severity]}                                 │
│  └── ${issue.title}（${issue.count}条，${percentage}%）          │`;
    })
    .join("\n");

  // 构建方案列表部分
  const optionsText = options
    .map((opt, index) => {
      return `${index + 1}️⃣ 【${opt.label}】${opt.name}
   操作：${opt.actions}
   耗时：约 ${opt.duration}`;
    })
    .join("\n\n");

  return `📋 **收藏诊断报告**

我分析了您的 **${stats.total.toLocaleString()}** 条收藏，发现以下可优化项：

┌─ 🔍 发现的问题 ─────────────────────────┐
│                                          │
${issuesText}
│                                          │
└──────────────────────────────────────────┘

💡 **整理方案**（${options.length} 选 1）

${optionsText}

回复数字选择方案，或说"我想只整理 XXX"自定义`;
}

/**
 * 渲染执行确认
 */
export function renderConfirmation(data: ConfirmData): string {
  const { optionName, actions, totalAffected, canUndo } = data;

  const actionsText = actions
    .map((action) => `  ${action.icon} ${action.name}：${action.count} 条`)
    .join("\n");

  const undoText = canUndo ? "\n🔙 **可撤销**：执行后可一键恢复" : "";

  return `⚠️ **确认执行整理**

即将执行【${optionName}】方案：

${actionsText}

📊 **影响范围**：共 ${totalAffected} 条书签${undoText}

[确认执行] [取消]`;
}

/**
 * 渲染完成报告
 */
export function renderComplete(data: CompleteData): string {
  const { stats, nextSuggestion } = data;

  const statsText = stats
    .map((stat) => {
      const statusIcon =
        stat.after < stat.before
          ? "✅"
          : stat.after === stat.before
            ? "➖"
            : "⚠️";
      return `├── ${stat.label}: ${stat.before} → ${stat.after} ${statusIcon}`;
    })
    .join("\n");

  const suggestionText = nextSuggestion
    ? `\n💡 **下一步建议**\n${nextSuggestion}`
    : "";

  return `✅ **整理完成！**

📊 **执行统计**
${statsText}
${suggestionText}

[查看详细报告] [分享整理成果] [撤销操作]`;
}

/**
 * 渲染空状态
 */
export function renderEmpty(): string {
  return ORGANIZE_EXPERT_TEMPLATES.empty;
}

/**
 * 渲染进度
 */
export function renderProgress(data: ProgressData): string {
  const { currentStep, progress, processed, total } = data;

  return `⏳ **正在整理中...**

当前步骤：${currentStep}
进度：${progress}%（${processed}/${total}）

请稍候，这不会影响您的其他操作`;
}

/**
 * 渲染错误
 */
export function renderError(errorMessage: string, canRetry = true): string {
  const retryText = canRetry
    ? "\n[重试] [取消]"
    : "\n请稍后再试，或联系支持团队";

  return `❌ **整理遇到问题**

${errorMessage}
${retryText}`;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 从统计数据生成问题列表
 */
export function generateIssuesFromStats(
  stats: CollectionStats,
): OrganizeIssue[] {
  const issues: OrganizeIssue[] = [];

  // 未分类
  if (stats.uncategorized > 0) {
    issues.push({
      type: "uncategorized",
      title: "未分类收藏",
      count: stats.uncategorized,
      severity:
        stats.uncategorized > stats.total * 0.3 ? "critical" : "warning",
    });
  }

  // 重复
  if (stats.duplicates > 0) {
    issues.push({
      type: "duplicates",
      title: "重复书签",
      count: stats.duplicates,
      severity: stats.duplicates > 10 ? "warning" : "info",
    });
  }

  // 无标签
  if (stats.untagged > 0) {
    issues.push({
      type: "untagged",
      title: "无标签收藏",
      count: stats.untagged,
      severity: stats.untagged > stats.total * 0.5 ? "warning" : "info",
    });
  }

  // 长期未读
  if (stats.stale > 0) {
    issues.push({
      type: "stale",
      title: "长期未读内容",
      count: stats.stale,
      severity: "info",
    });
  }

  // 失效链接
  if (stats.invalidUrls && stats.invalidUrls > 0) {
    issues.push({
      type: "invalid_urls",
      title: "失效链接",
      count: stats.invalidUrls,
      severity: stats.invalidUrls > 5 ? "warning" : "info",
    });
  }

  // 按严重程度排序
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

/**
 * 生成整理方案选项
 */
export function generateOrganizeOptions(
  stats: CollectionStats,
  issues: OrganizeIssue[],
): OrganizeOption[] {
  const options: OrganizeOption[] = [];
  const hasUncategorized = stats.uncategorized > 0;
  const hasDuplicates = stats.duplicates > 0;
  const hasUntagged = stats.untagged > 0;
  const hasStale = stats.stale > 0;

  // 推荐方案：智能一键整理
  if (issues.length > 0) {
    const actionParts: string[] = [];
    if (hasUncategorized) actionParts.push("分类");
    if (hasUntagged) actionParts.push("打标签");
    if (hasDuplicates) actionParts.push("去重");
    if (hasStale) actionParts.push("归档");

    const totalCount =
      stats.uncategorized + stats.duplicates + stats.untagged + stats.stale;
    const estimatedMinutes = Math.max(1, Math.ceil(totalCount / 50));

    options.push({
      id: "one-click",
      name: "一键智能整理",
      label: OPTION_LABELS.recommended,
      actions: actionParts.join(" + "),
      duration: `${estimatedMinutes} 分钟`,
    });
  }

  // 快速方案：只处理最紧急的问题
  const criticalIssue = issues.find((i) => i.severity === "critical");
  if (criticalIssue) {
    const quickAction =
      criticalIssue.type === "uncategorized"
        ? "智能分类"
        : criticalIssue.type === "duplicates"
          ? "清理重复"
          : criticalIssue.type === "untagged"
            ? "自动打标"
            : "快速归档";

    options.push({
      id: `quick-${criticalIssue.type}`,
      name: quickAction,
      label: OPTION_LABELS.quick,
      actions: `仅处理 ${criticalIssue.title}`,
      duration: "30 秒",
    });
  }

  // 彻底方案：全面清理
  if (issues.length >= 3) {
    options.push({
      id: "thorough",
      name: "全面深度整理",
      label: OPTION_LABELS.thorough,
      actions: "分类 + 打标签 + 去重 + 归档 + 链接验证",
      duration: "3-5 分钟",
    });
  }

  return options;
}

/**
 * 渲染完整的诊断报告（便捷方法）
 */
export function renderFullDiagnosisReport(stats: CollectionStats): string {
  // 检查是否有需要整理的内容
  const hasIssues =
    stats.uncategorized > 0 ||
    stats.duplicates > 0 ||
    stats.untagged > 0 ||
    stats.stale > 0;

  if (!hasIssues) {
    return renderEmpty();
  }

  const issues = generateIssuesFromStats(stats);
  const options = generateOrganizeOptions(stats, issues);

  return renderDiagnosisReport({
    stats,
    issues,
    options,
  });
}

// 导出常量供外部使用
export { SEVERITY_ICONS, SEVERITY_LABELS, ACTION_ICONS, OPTION_LABELS };
