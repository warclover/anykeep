/**
 * AI Agent 客户端模块
 *
 * 提供客户端侧的 AI 相关功能：
 * - 快捷命令解析（绕过 AI 意图理解）
 * - 上下文预处理（减少 Token 消耗）
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

// 快捷命令
export {
  // Types
  type FastCommandConfig,
  type FastCommandResult,
  // Constants
  FAST_COMMANDS,
  // Functions
  parseFastCommand,
  isFastCommand,
  getAllFastCommands,
  generateHelpText,
} from "./fast-commands";

// 上下文预处理
export {
  // Types
  type LightweightBookmark,
  type SelectionSummary,
  type PreprocessConfig,
  // Functions
  preprocessBookmarks,
  preprocessSelectionSummary,
  estimateTokens,
  calculateTokenSavings,
  smartPreprocess,
} from "./context-preprocessor";
