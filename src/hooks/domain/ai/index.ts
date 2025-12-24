/**
 * AI Domain Hooks - AI 相关业务逻辑
 *
 * 包含：
 * - use-ai-chat: AI 对话 Hook（核心）
 * - use-vision-analysis: 图像分析 Hook
 * - use-unified-confirmation: 统一确认处理 Hook（Tool/Skill 适配器）
 *
 * 历史遗留（与 AI 分类相关，建议未来迁移到 domain/folder/）：
 * - use-evolution-reports: 月度 AI 进化报告（文件夹分类统计）
 * - use-inbox-organization: 待整理文件夹智能整理（聚类分析）
 *
 * @module hooks/domain/ai
 */

// 核心 AI 对话
export * from "./use-ai-chat";

// AI 图像分析
export * from "./use-vision-analysis";

// 统一确认处理（Phase 0.3）
export * from "./use-unified-confirmation";

// AI 分类相关（历史遗留，与 AI Chat 无关）
// TODO: 未来版本考虑迁移到 domain/folder/ 或 domain/analytics/
export * from "./use-evolution-reports";
export * from "./use-inbox-organization";
