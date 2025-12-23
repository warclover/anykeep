/**
 * 设置 Tools 导出
 *
 * 这些 Tools 处理用户设置的读取和更新，
 * 包括信任模式、分类配置、兴趣领域等。
 *
 * @version 1.2.0
 * @since 2025-12-23
 */

export { updateTrustModeTool } from "./update-trust-mode.tool";
export { getUserSettingsTool } from "./get-user-settings.tool";
export { getClassificationSettingsTool } from "./get-classification-settings.tool";
export { updateClassificationSettingsTool } from "./update-classification-settings.tool";
export { getUserInterestsTool } from "./get-user-interests.tool";
export { updateUserInterestsTool } from "./update-user-interests.tool";

// 导出所有设置 Tools 数组
import { updateTrustModeTool } from "./update-trust-mode.tool";
import { getUserSettingsTool } from "./get-user-settings.tool";
import { getClassificationSettingsTool } from "./get-classification-settings.tool";
import { updateClassificationSettingsTool } from "./update-classification-settings.tool";
import { getUserInterestsTool } from "./get-user-interests.tool";
import { updateUserInterestsTool } from "./update-user-interests.tool";

export const settingsTools = [
  updateTrustModeTool,
  getUserSettingsTool,
  getClassificationSettingsTool,
  updateClassificationSettingsTool,
  getUserInterestsTool,
  updateUserInterestsTool,
];
