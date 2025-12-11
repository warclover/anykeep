/**
 * Core-Edge Profile Module
 * V4.2 核心区/边缘区画像模块
 *
 * @module classification/profile
 * @description
 * 提供文件夹的核心区与边缘区向量画像服务：
 * - 核心区：文件夹最典型内容的中心向量（高置信度匹配）
 * - 边缘区：文件夹边界内容的向量（较低置信度但仍属于该文件夹）
 *
 * @example
 * ```typescript
 * import { createCoreEdgeProfileService, type CoreEdgeProfile } from '@/lib/classification/profile';
 *
 * const service = createCoreEdgeProfileService(supabase);
 * const profile = await service.computeZoneProfile(userId, folderId);
 * const zoneMatch = await service.checkBookmarkZone(folderId, embedding);
 * ```
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 服务导出
// ============================================================================

export {
  CoreEdgeProfileService,
  createCoreEdgeProfileService,
} from "./core-edge-profile.service";

// ============================================================================
// 类型导出
// ============================================================================

export type {
  // 基础类型
  ZoneType,
  BookmarkVector,

  // 画像数据
  CoreEdgeProfile,
  CoreEdgeComputeConfig,

  // 匹配结果
  ZoneMatchResult,
  FolderZoneMatch,
} from "./core-edge-profile.service";
