/**
 * Strategy layer exports (Client-safe)
 *
 * @deprecated 请使用 './classic' 或 './modern' 子目录导入
 * 此文件仅为向后兼容保留，将在 Phase 6 删除
 */

// Re-export from classic strategy for backward compatibility
export * from "./classic";

// Modern strategy exports
export * from "./modern";

// 注意：NegativeSampleMatcher 和 negativeSampleMatcher 实例
// 依赖服务端代码，需从 "./negative-sample-matcher" 直接导入
