/**
 * Folder Feature Module
 *
 * Phase 5: 模块解耦
 * 文件夹功能模块统一入口
 *
 * 模块边界契约：
 * - 公共组件通过 components 导出
 * - 公共 Hooks 通过 hooks 导出
 * - 公共服务通过 services 导出
 * - 公共类型通过 types 导出
 *
 * 使用示例：
 * ```typescript
 * import { CreateFolderDialog, useFolders } from "@/features/folder";
 * ```
 */

// ============================================================================
// Components - 公共组件
// ============================================================================

// 对话框组件
export { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
export { DeleteFolderDialog } from "@/components/folders/delete-folder-dialog";
export { MergeFolderDialog } from "@/components/folders/merge-folder-dialog";
export { RenameFolderDialog } from "@/components/folders/rename-folder-dialog";

// 页面和功能组件
export { FoldersPageClient } from "@/components/folders/folders-page-client";
export { FolderActionMenu } from "@/components/folders/folder-action-menu";
export { FolderAIProfile } from "@/components/folders/folder-ai-profile";

// ============================================================================
// Hooks - 公共 Hooks
// ============================================================================

// 数据获取
export { useFolders } from "@/hooks/data/use-folders";
export { useFolderProfile } from "@/hooks/data/use-folder-profile";

// 文件夹操作建议
export { useLibrarianAnalysis } from "@/hooks/domain/folder/use-librarian-analysis";
export { useMergeSuggestions } from "@/hooks/domain/folder/use-merge-suggestions";
export { useSplitSuggestions } from "@/hooks/domain/folder/use-split-suggestions";
export { useRenameSuggestions } from "@/hooks/domain/folder/use-rename-suggestions";
export { useOperationHistory } from "@/hooks/domain/folder/use-operation-history";

// ============================================================================
// Services - 公共服务
// ============================================================================

// 文件夹操作执行器
export {
  FolderExecutorService,
  folderExecutorService,
  type FolderCreateInput,
  type FolderMergeInput,
  type FolderSplitInput,
  type FolderRenameInput,
  type FolderCreateResult,
  type FolderMergeResult,
  type FolderSplitResult,
  type FolderRenameResult,
  type ExecutionResult,
} from "@/lib/folder";

// 文件夹自组织服务
export {
  FolderAutoOrganizationService,
  createFolderAutoOrganizationService,
  initFolderOrganization,
  getFolderOrganizationStatus,
  type OrganizationSuggestion,
  type OrganizationSuggestionType,
  type AutoOrganizationConfig,
} from "@/lib/folder";

// 热度追踪
export {
  initHeatTracker,
  getHeatTracker,
  stopHeatTracker,
  getPendingSuggestionsCount,
} from "@/lib/folder";

// ============================================================================
// Repository - 数据仓库
// ============================================================================

export {
  folderRepository,
  useFolderTree,
} from "@/lib/repositories/folder.repository";
export type { FolderRepository } from "@/lib/repositories/folder.repository";

// ============================================================================
// Types - 公共类型
// ============================================================================

export type { Folder } from "@/types/supabase";
