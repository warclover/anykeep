/**
 * AI Skills Execution Module
 *
 * 导出推测执行相关的类型和实现
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

// 类型导出
export * from "./types";

// 实现导出
export {
  SpeculativeExecutor,
  createSpeculativeExecutor,
} from "./speculative-executor";
