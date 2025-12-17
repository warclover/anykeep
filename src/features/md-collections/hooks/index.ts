/**
 * MD 收藏功能 - Hooks 模块入口
 * P2-007: Markdown 内容收藏
 */

// 数据获取
export { useMdCollections, useMdCollection } from "./use-md-collections";

// 数据变更
export {
  useCreateMdCollection,
  useUpdateMdCollection,
  useDeleteMdCollection,
  useUploadMdFile,
  useCheckDuplicate,
  useTriggerAIProcess,
} from "./use-md-mutations";

// 视图偏好
export { useMdViewPreference } from "./use-md-view-preference";
