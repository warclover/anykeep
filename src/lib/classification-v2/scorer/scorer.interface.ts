/**
 * Scorer 接口定义
 *
 * 系统的核心契约。每个 Scorer 独立为候选文件夹打分，
 * 同 tier 内的 Scorer 并行执行。
 *
 * 从 types.ts 提取为独立文件，与设计文档保持一致。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

// 直接从 types.ts 重导出 Scorer 相关类型
// 保持 types.ts 作为唯一类型源，此文件仅提供语义化入口
export type { Scorer, Score, Signal, SignalType, ScorerTier } from "../types";
