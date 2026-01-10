/**
 * 整理专家模板模块导出
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

// 模板常量
export {
  ORGANIZE_EXPERT_TEMPLATES,
  SEVERITY_ICONS,
  SEVERITY_LABELS,
  ACTION_ICONS,
  OPTION_LABELS,
  type OptionLabel,
} from "./expert-response";

// 模板渲染器
export {
  // 类型
  type OrganizeIssue,
  type OrganizeOption,
  type DiagnosisData,
  type CollectionStats,
  type ConfirmData,
  type CompleteData,
  type ProgressData,
  // 渲染函数
  renderDiagnosisReport,
  renderConfirmation,
  renderComplete,
  renderEmpty,
  renderProgress,
  renderError,
  // 辅助函数
  generateIssuesFromStats,
  generateOrganizeOptions,
  renderFullDiagnosisReport,
} from "./template-renderer";
