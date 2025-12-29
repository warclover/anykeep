/**
 * Brain-Sync Active Recall Tools 模块导出
 *
 * 提供 AI 主动复习功能的工具集：
 * - generate_flashcards: 为书签生成复习卡片
 * - get_review_queue: 获取待复习队列
 * - submit_review_response: 提交复习反馈
 * - get_mastery_stats: 获取掌握度统计
 * - update_review_preferences: 更新复习偏好设置
 *
 * 服务层：
 * - 标签变更监听器: 自动触发 Flashcard 生成
 *
 * @module tools/active-recall
 * @version 1.1.0
 * @since 2025-12-29
 */

// 类型导出
export * from "./types";

// 错误处理导出
export * from "./errors";

// 服务层导出
export * from "./services";

// 工具导出
export { generateFlashcardsTool } from "./generate-flashcards.tool";
export { getReviewQueueTool } from "./get-review-queue.tool";
export { submitReviewResponseTool } from "./submit-review-response.tool";
export { getMasteryStatsTool } from "./get-mastery-stats.tool";
export { updateReviewPreferencesTool } from "./update-review-preferences.tool";

// 工具数组（用于批量注册）
import { generateFlashcardsTool } from "./generate-flashcards.tool";
import { getReviewQueueTool } from "./get-review-queue.tool";
import { submitReviewResponseTool } from "./submit-review-response.tool";
import { getMasteryStatsTool } from "./get-mastery-stats.tool";
import { updateReviewPreferencesTool } from "./update-review-preferences.tool";

/**
 * 所有 Active Recall Tools
 */
export const activeRecallTools = [
  generateFlashcardsTool,
  getReviewQueueTool,
  submitReviewResponseTool,
  getMasteryStatsTool,
  updateReviewPreferencesTool,
];
