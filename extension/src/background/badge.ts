/**
 * 扩展图标徽章管理模块
 *
 * 功能：
 * 1. 显示保存状态（成功/失败/进行中）
 * 2. 显示离线队列数量
 * 3. 显示未读通知数量
 */

// 徽章颜色
const BADGE_COLORS = {
  SUCCESS: "#22c55e", // 绿色 - 保存成功
  ERROR: "#ef4444", // 红色 - 保存失败
  PENDING: "#f59e0b", // 黄色 - 正在保存
  OFFLINE: "#6b7280", // 灰色 - 离线队列
  DEFAULT: "#0ea5e9", // 蓝色 - 默认
} as const;

// 徽章状态
type BadgeStatus =
  | "success"
  | "error"
  | "pending"
  | "offline"
  | "count"
  | "clear";

/**
 * 设置徽章状态
 */
export async function setBadge(
  status: BadgeStatus,
  text?: string,
  tabId?: number,
): Promise<void> {
  const options = tabId ? { tabId } : undefined;

  switch (status) {
    case "success":
      await chrome.action.setBadgeText({ text: "✓", ...options });
      await chrome.action.setBadgeBackgroundColor({
        color: BADGE_COLORS.SUCCESS,
        ...options,
      });
      // 2秒后自动清除
      setTimeout(() => clearBadge(tabId), 2000);
      break;

    case "error":
      await chrome.action.setBadgeText({ text: "!", ...options });
      await chrome.action.setBadgeBackgroundColor({
        color: BADGE_COLORS.ERROR,
        ...options,
      });
      // 3秒后自动清除
      setTimeout(() => clearBadge(tabId), 3000);
      break;

    case "pending":
      await chrome.action.setBadgeText({ text: "...", ...options });
      await chrome.action.setBadgeBackgroundColor({
        color: BADGE_COLORS.PENDING,
        ...options,
      });
      break;

    case "offline":
      await chrome.action.setBadgeText({ text: text || "○", ...options });
      await chrome.action.setBadgeBackgroundColor({
        color: BADGE_COLORS.OFFLINE,
        ...options,
      });
      break;

    case "count":
      if (text && parseInt(text) > 0) {
        await chrome.action.setBadgeText({ text, ...options });
        await chrome.action.setBadgeBackgroundColor({
          color: BADGE_COLORS.DEFAULT,
          ...options,
        });
      } else {
        await clearBadge(tabId);
      }
      break;

    case "clear":
    default:
      await clearBadge(tabId);
      break;
  }
}

/**
 * 清除徽章
 */
export async function clearBadge(tabId?: number): Promise<void> {
  const options = tabId ? { tabId } : undefined;
  await chrome.action.setBadgeText({ text: "", ...options });
}

/**
 * 更新离线队列计数
 */
export async function updateOfflineQueueBadge(count: number): Promise<void> {
  if (count > 0) {
    await setBadge("offline", count > 99 ? "99+" : String(count));
  } else {
    await clearBadge();
  }
}

/**
 * 显示保存成功
 */
export async function showSaveSuccess(tabId?: number): Promise<void> {
  await setBadge("success", undefined, tabId);
}

/**
 * 显示保存失败
 */
export async function showSaveError(tabId?: number): Promise<void> {
  await setBadge("error", undefined, tabId);
}

/**
 * 显示正在保存
 */
export async function showSaving(tabId?: number): Promise<void> {
  await setBadge("pending", undefined, tabId);
}

/**
 * 初始化徽章模块
 */
export async function initializeBadge(): Promise<void> {
  // 清除所有徽章
  await clearBadge();

  // 监听标签页切换，更新徽章状态
  chrome.tabs.onActivated.addListener(async (_activeInfo) => {
    // 可以在这里根据当前页面是否已收藏来更新徽章
  });
}

/**
 * 简化的徽章更新接口
 * @param status 状态：'default' | 'saved' | 'error' | 'syncing'
 */
export async function updateBadge(
  status: "default" | "saved" | "error" | "syncing",
): Promise<void> {
  switch (status) {
    case "saved":
      await showSaveSuccess();
      break;
    case "error":
      await showSaveError();
      break;
    case "syncing":
      await showSaving();
      break;
    case "default":
    default:
      await clearBadge();
      break;
  }
}
