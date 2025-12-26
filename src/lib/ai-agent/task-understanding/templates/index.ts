/**
 * 任务模板模块导出
 *
 * @module ai-agent/task-understanding/templates
 * @version 1.0.0
 * @since 2025-12-26
 */

// 类型导出
export type {
  TaskTemplate,
  TaskTemplateType,
  ExecutionStepTemplate,
  TemplateMatchResult,
  TemplateMatchDetails,
  TaskTemplateEngineConfig,
} from "./types";

// 模板引擎
export {
  TaskTemplateEngine,
  createTaskTemplateEngine,
} from "./task-template-engine";

// 预定义模板
export {
  // 取消模板
  cancelOperationTemplate,
  // 搜索模板
  searchSimpleTemplate,
  // 整理模板
  organizeToFolderTemplate,
  organizeGeneralTemplate,
  organizeByTimeTemplate,
  // 移动模板
  moveToFolderTemplate,
  // 导出模板
  exportGeneralTemplate,
  exportWithFormatTemplate,
  // 查询模板
  queryStatsTemplate,
  // 删除模板
  deleteBookmarksTemplate,
  // 批量标签模板
  batchAddTagsTemplate,
  batchRemoveTagsTemplate,
  // 复习模板
  reviewKnowledgeTemplate,
  // 默认模板集合
  defaultTemplates,
} from "./templates";
