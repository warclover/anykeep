/**
 * AI Agent 模块导出
 *
 * @version 1.4.0
 * @since 2025-12-22
 * @updated 2025-12-26 添加偏好和配置模块
 * @updated 2026-01-06 添加 AIAgentContainer
 */

// DI Container (推荐使用)
export {
  AIAgentContainer,
  getAIAgentContainer,
  tryGetAIAgentContainer,
  type AIAgentContainerConfig,
  type AIAgentContainerOverrides,
} from "./container";

// Core
export * from "./core";

// Tools
export * from "./tools";

// Services
export * from "./services";

// Context
export * from "./context";

// Error Recovery
export * from "./error-recovery";

// Preferences (P2-8, P2-9)
export * from "./preferences";

// Config (P2-10)
export * from "./config";
