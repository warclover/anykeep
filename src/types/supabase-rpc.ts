/**
 * Supabase RPC 调用类型定义
 *
 * 为 Supabase RPC 函数提供类型安全
 *
 * @version 1.0.0
 * @since 2026-02-05
 */

// import type { Database } from "./supabase"; // 保留以备将来使用

// ============================================
// 通用 RPC 返回类型
// ============================================

/**
 * RPC 调用成功响应
 */
export interface RpcSuccess<T> {
  data: T | null;
  error: null;
}

/**
 * RPC 调用失败响应
 */
export interface RpcError {
  data: null;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  };
}

/**
 * RPC 调用响应（联合类型）
 */
export type RpcResponse<T> = RpcSuccess<T> | RpcError;

// ============================================
// 具体的 RPC 函数返回类型
// ============================================

/**
 * Notion Database 属性
 */
export interface NotionDatabaseProperty {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

/**
 * 蓝图推荐结果
 */
export interface BlueprintRecommendation {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: "beginner" | "intermediate" | "advanced";
  estimatedTime: string;
  tags: string[];
  [key: string]: unknown;
}

/**
 * MD 集合处理状态
 */
export interface MdCollectionProcessStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  [key: string]: unknown;
}

/**
 * 监控配置
 */
export interface MonitorConfig {
  id: string;
  name: string;
  url: string;
  interval: number;
  active: boolean;
  [key: string]: unknown;
}

/**
 * 快照处理结果
 */
export interface SnapshotProcessResult {
  snapshotId: string;
  status: "pending" | "processing" | "completed" | "failed";
  processedAt?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * 合成预览结果
 */
export interface SynthesisPreviewResult {
  bookmarks: Array<{
    id: number;
    title: string;
    url: string;
    platform: string | null;
    [key: string]: unknown;
  }>;
  total: number;
  [key: string]: unknown;
}

/**
 * TTS 合成结果
 */
export interface TtsSynthesisResult {
  audioUrl?: string;
  duration?: number;
  status: "success" | "failed";
  error?: string;
  [key: string]: unknown;
}

/**
 * 浏览器书签历史记录
 */
export interface BrowserBookmarkHistory {
  id: number;
  title: string;
  url: string;
  folder_id: number | null;
  visited_at: string;
  [key: string]: unknown;
}

// ============================================
// 类型安全的 RPC 调用辅助函数
// ============================================

/**
 * 检查 RPC 响应是否成功
 */
export function isRpcSuccess<T>(
  response: RpcResponse<T>,
): response is RpcSuccess<T> {
  return response.error === null;
}

/**
 * 检查 RPC 响应是否失败
 */
export function isRpcError<T>(response: RpcResponse<T>): response is RpcError {
  return response.error !== null;
}

/**
 * 从 RPC 响应中提取数据
 * @throws {Error} 如果响应失败
 */
export function getRpcData<T>(response: RpcResponse<T>): T | null {
  if (isRpcError(response)) {
    throw new Error(response.error.message);
  }
  return response.data;
}

/**
 * 安全地从 RPC 响应中提取数据
 * @returns 数据或 null（如果失败）
 */
export function getRpcDataSafe<T>(response: RpcResponse<T>): T | null {
  if (isRpcError(response)) {
    return null;
  }
  return response.data;
}
