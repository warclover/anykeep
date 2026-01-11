/**
 * 核心共享类型定义
 *
 * 跨 AI 模块共享的基础类型
 *
 * @module @/lib/shared/types/core
 * @version 1.0.0
 * @since 2026-01-11
 */

// ============================================
// Agent 类型
// ============================================

/**
 * Agent 类型枚举
 */
export type AgentType = "knowledge" | "research" | "learning";

/**
 * Agent 状态
 */
export type AgentStatus =
  | "idle" // 空闲
  | "thinking" // 思考中
  | "executing" // 执行工具
  | "responding" // 生成响应
  | "error"; // 错误

// ============================================
// 消息角色
// ============================================

/**
 * 消息角色（完整版本，包含 tool）
 *
 * 用于 AI Agent 内部处理
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * 基础消息角色（不含 tool）
 *
 * 用于对话历史存储和展示
 */
export type BasicMessageRole = "user" | "assistant" | "system";
