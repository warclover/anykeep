/**
 * V3 兼容层 (Compatibility Layer)
 *
 * 此文件为向后兼容保留，将在未来版本中移除。
 * 新代码请直接从以下位置导入：
 *
 * - 配置: @/lib/classification/config/v3
 * - 服务: @/lib/classification/services/advanced
 * - 策略: @/lib/classification/strategies/advanced
 * - 常量: @/lib/classification/constants
 * - Prompts: @/lib/classification/prompts
 * - Repositories: @/lib/classification/repositories
 *
 * @deprecated 请使用新的导入路径
 * @since 2025-12-24 (Phase 3.1 - V3 目录重组)
 */

// 配置 - 从 config/v3 重新导出
export * from "../config/v3";

// 常量 - 从 constants 重新导出
export * from "../constants";

// Prompts - 从 prompts 重新导出
export * from "../prompts";

// 策略 - 从 strategies/advanced 重新导出
export * from "../strategies/advanced";

// Repositories - 从 repositories 重新导出
export * from "../repositories";

// Services - 从 services/advanced 重新导出
export * from "../services/advanced";

// 版本信息
export const V3_VERSION = "3.0.0";
export const V3_RELEASE_DATE = "2025-12-07";
