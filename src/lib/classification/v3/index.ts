/**
 * V3.0 智能分类模块入口
 *
 * 解耦设计：所有 V3 新功能都在此目录下，
 * 通过配置开关与 V2 共存，支持渐进式迁移。
 */

// 配置
export * from "./config";

// 常量
export * from "./constants";

// Prompts
export * from "./prompts";

// 策略
export * from "./strategies";

// Repositories
export * from "./repositories";

// Services
export * from "./services";

// 版本信息
export const V3_VERSION = "3.0.0";
export const V3_RELEASE_DATE = "2025-12-07";
