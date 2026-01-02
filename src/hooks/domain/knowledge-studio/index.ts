/**
 * Knowledge Studio Hooks - 模块入口
 * @module hooks/domain/knowledge-studio
 */

// 生成 Hook
export { useGeneration } from "./use-generation";
export type {
  GenerationStatus,
  GenerationProgress,
  GenerationConfig,
  MaterialItem,
  GenerationResult,
  UseGenerationOptions,
  UseGenerationReturn,
} from "./use-generation";

// 聊天编辑 Hook
export { useChatEdit } from "./use-chat-edit";
export type {
  ChatEditStatus,
  ChatEditRequest,
  ChatEditResult,
  UseChatEditOptions,
  UseChatEditReturn,
} from "./use-chat-edit";

// 配额管理 Hook
export { useQuota } from "./use-quota";
export type {
  QuotaInfo,
  QuotaUsage,
  OperationCosts,
  QuotaData,
  UseQuotaReturn,
} from "./use-quota";

// 素材健康度 Hook
export { useMaterialHealth } from "./use-material-health";
export type {
  MaterialHealthScore,
  UseMaterialHealthReturn,
} from "./use-material-health";

// Brain-Sync 整合 Hook
export { useBrainSyncIntegration } from "./use-brain-sync-integration";
export type {
  BrainSyncStatus,
  GenerateFlashcardsRequest,
  GenerateFlashcardsResult,
  UseBrainSyncIntegrationOptions,
  UseBrainSyncIntegrationReturn,
} from "./use-brain-sync-integration";
