/**
 * AI Domain Hooks - AI 相关业务逻辑
 *
 * 包含：
 * - use-ai-chat: AI 对话 Hook（核心）
 * - use-vision-analysis: 图像分析 Hook
 * - use-unified-confirmation: 统一确认处理 Hook（Tool/Skill 适配器）
 * - use-tts-player: TTS 播放器 Hook
 * - use-persona: 用户画像 Hook（Phase 4 新增）
 *
 * 历史遗留（与 AI 分类相关，建议未来迁移到 domain/folder/）：
 * - use-inbox-organization: 待整理文件夹智能整理（聚类分析）
 *
 * @module hooks/domain/ai
 */

// 核心 AI 对话
export * from "./use-ai-chat";

// 会话历史管理 (P1: 历史会话管理)
export * from "./use-conversation-history";

// AI 图像分析
export * from "./use-vision-analysis";

// 统一确认处理（Phase 0.3）
export * from "./use-unified-confirmation";

// TTS 播放器
export * from "./use-tts-player";

// 主动简报（AI Secretary Evolution Phase 0）
export * from "./use-briefing";

// 用户画像（Phase 4 新增）
export * from "./use-persona";

// AI 分类相关（历史遗留，见文件头部注释关于未来迁移计划）
export * from "./use-inbox-organization";

// AI 成本统计（2026-02-07 新增）
export * from "./use-ai-cost-stats";
