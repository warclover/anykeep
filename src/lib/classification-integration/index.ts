/**
 * 分类集成层桥接模块
 *
 * 包含 classifyBookmarkV2、文件夹画像更新等集成函数。
 * 实际实现位于 classification/integration.ts。
 *
 * @deprecated 过渡桥接，后续将内联化
 */
export {
  classifyBookmarkV2,
  shouldUseV2Classification,
  updateFolderProfilesOnBookmarkChange,
  updateFolderProfileAfterClassification,
  initializeFolderNameProfile,
  preserveOldNameAsAlias,
} from "@/lib/classification/integration";
