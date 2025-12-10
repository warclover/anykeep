/**
 * Folder Organization Module (V4.2)
 * 文件夹自组织模块
 *
 * 职责：
 * - 订阅分类模块事件
 * - 管理文件夹画像（读写权限）
 * - 执行文件夹演进操作（创建、分拆、合并、重命名）
 * - 生成演进报告
 *
 * 与分类模块通过事件总线解耦：
 * - 分类模块发布 classification:* 事件
 * - 自组织模块订阅并处理
 *
 * @module folder-organization
 * @version 4.2
 */

// ============================================================================
// Types
// ============================================================================
export * from "./types/domain-types";

// ============================================================================
// Services
// ============================================================================

// 注意：以下服务从 classification 模块迁移，当前通过 re-export 方式引用
// 后续迭代将逐步将实现迁移到本模块

// 智能分拣服务（从 services 目录）
export {
  SmartSortingService,
  smartSortingService,
} from "@/lib/classification/services/smart-sorting.service";

// 增量画像更新服务（从 v3 目录）
export {
  IncrementalProfileService,
  createIncrementalProfileService,
  type BookmarkChangeEvent,
  type ProfileUpdateResult,
  type IncrementalProfileConfig,
} from "@/lib/classification/v3/services/incremental-profile.service";

// ============================================================================
// Algorithms
// ============================================================================
export {
  DBSCANCluster,
  type DBSCANOptions,
  type ClusterResult,
} from "./algorithms/dbscan-cluster";

// ============================================================================
// Module Initialization
// ============================================================================
export { initFolderOrganization, getFolderOrganizationStatus } from "./init";
