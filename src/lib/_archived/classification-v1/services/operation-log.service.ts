/**
 * Operation Log Service (V4.2.1) - 向后兼容重导出
 *
 * 注意：此文件是向后兼容的重导出入口
 * 实际实现已移至 ./operation-log/ 目录
 *
 * @see ./operation-log/operation-log.service.ts
 * @version 4.2.1
 * @since 2025-12-25 - Refactored into modular structure
 */

// 从新模块结构重导出所有内容
export {
  // 类型
  type UndoResult,
  type OperationHistoryOptions,
  type FolderInfo,
  type BookmarkInfo,
  type BookmarkMoveInfo,
  // 服务
  OperationLogService,
  operationLogService,
} from "./operation-log";
