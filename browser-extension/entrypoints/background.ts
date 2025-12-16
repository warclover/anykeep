/* eslint-disable no-console */
/**
 * AnyKeep 浏览器扩展 - Background Service Worker
 * PRD v4.1: 浏览器扩展完善
 *
 * 职责：
 * 1. 处理来自 Web 应用的认证消息
 * 2. 管理扩展存储
 * 3. 右键菜单快速收藏
 * 4. 快捷键 Ctrl+Shift+S 支持
 * 5. 保存成功通知
 * 6. 离线队列管理
 */

import type { PageMetadata, SaveResult } from "@/types";
import { api, auth, offlineQueue, storage } from "@/lib";

/** 扩展版本 */
const EXTENSION_VERSION = "1.0.0";

/**
 * 显示通知
 */
function showNotification(
  title: string,
  message: string,
  isSuccess: boolean,
): void {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("/icon/128.png"),
    title,
    message,
    priority: isSuccess ? 0 : 2,
  });
}

/**
 * 从 Content Script 获取页面信息
 */
async function getPageInfoFromContentScript(
  tabId: number,
): Promise<PageMetadata | null> {
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      type: "GET_PAGE_INFO",
    });
    return response as PageMetadata;
  } catch (error) {
    console.warn(
      "[Background] Failed to get page info from content script:",
      error,
    );
    return null;
  }
}

/**
 * 保存页面到 AnyKeep
 * 支持在线保存和离线队列
 */
async function saveToAnyKeep(
  url: string,
  title: string,
  metadata?: Partial<PageMetadata>,
): Promise<SaveResult> {
  try {
    // 检查登录状态
    const loggedIn = await auth.isLoggedIn();
    if (!loggedIn) {
      return { success: false, message: "请先登录 AnyKeep" };
    }

    // 检查网络状态
    if (!navigator.onLine) {
      // 离线模式：存入队列
      const platform = api.detectPlatform(url);
      await offlineQueue.init();
      await offlineQueue.add({
        url,
        title,
        platform,
        metadata,
      });

      const count = await offlineQueue.getCount();
      return {
        success: true,
        message: `已保存到离线队列 (${count} 条待同步)`,
        isOffline: true,
      };
    }

    // 在线模式：直接保存
    const platform = api.detectPlatform(url);
    const response = await api.saveBookmark({
      url,
      title,
      platform,
      description: metadata?.description,
      coverUrl: metadata?.coverUrl,
      author: metadata?.author,
      publishTime: metadata?.publishTime,
      wordCount: metadata?.wordCount,
      imageCount: metadata?.imageCount,
    });

    if (response.success && response.data) {
      return {
        success: true,
        message: "保存成功！",
        bookmarkId: response.data.id,
      };
    }

    return {
      success: false,
      message: response.error?.message || "保存失败",
    };
  } catch (error) {
    console.error("[Background] Save error:", error);

    // 网络错误时尝试离线保存
    if (error instanceof TypeError && error.message.includes("fetch")) {
      try {
        const platform = api.detectPlatform(url);
        await offlineQueue.init();
        await offlineQueue.add({
          url,
          title,
          platform,
          metadata,
        });

        const count = await offlineQueue.getCount();
        return {
          success: true,
          message: `网络异常，已保存到离线队列 (${count} 条待同步)`,
          isOffline: true,
        };
      } catch (offlineError) {
        console.error("[Background] Offline save error:", offlineError);
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "保存失败，请重试",
    };
  }
}

/**
 * 同步离线队列
 */
async function syncOfflineQueue(): Promise<void> {
  try {
    await offlineQueue.init();
    const count = await offlineQueue.getCount();

    if (count === 0) {
      console.log("[Background] No offline bookmarks to sync");
      return;
    }

    console.log(`[Background] Syncing ${count} offline bookmarks`);
    const result = await offlineQueue.syncAll();

    if (result.synced > 0) {
      showNotification(
        "离线同步完成",
        `已同步 ${result.synced} 条收藏${result.failed > 0 ? `，${result.failed} 条失败` : ""}`,
        result.failed === 0,
      );
    }
  } catch (error) {
    console.error("[Background] Sync error:", error);
  }
}

/**
 * 判断是否为浏览器内部页面
 */
function isInternalPage(url: string): boolean {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("moz-extension://") ||
    url.startsWith("file://")
  );
}

export default defineBackground(() => {
  console.log(
    "[AnyKeep] Background script loaded, version:",
    EXTENSION_VERSION,
  );

  // ==================== 网络状态监听 ====================
  // 监听网络恢复
  self.addEventListener("online", () => {
    console.log("[Background] Network restored, syncing offline queue");
    syncOfflineQueue();
  });

  // ==================== 右键菜单 ====================
  // 创建右键菜单
  browser.contextMenus.create({
    id: "save-page-to-anykeep",
    title: "保存此页面到 AnyKeep",
    contexts: ["page"],
  });

  browser.contextMenus.create({
    id: "save-link-to-anykeep",
    title: "保存此链接到 AnyKeep",
    contexts: ["link"],
  });

  // 右键菜单点击处理
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    let url: string;
    let title: string;
    let metadata: Partial<PageMetadata> | undefined;

    if (info.menuItemId === "save-page-to-anykeep" && tab) {
      url = info.pageUrl || tab.url || "";
      title = tab.title || url;

      // 尝试从 Content Script 获取更丰富的信息
      if (tab.id) {
        metadata = (await getPageInfoFromContentScript(tab.id)) || undefined;
      }
    } else if (info.menuItemId === "save-link-to-anykeep") {
      url = info.linkUrl || "";
      title = info.linkText || url;
    } else {
      return;
    }

    if (!url) {
      showNotification("AnyKeep", "无法获取页面 URL", false);
      return;
    }

    const result = await saveToAnyKeep(url, title, metadata);
    showNotification(
      result.success ? "✓ 收藏成功" : "✗ 收藏失败",
      result.message,
      result.success,
    );
  });

  // ==================== 快捷键 ====================
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "save-current-page") {
      // 获取当前活动标签页
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url) {
        showNotification("AnyKeep", "无法获取当前页面", false);
        return;
      }

      // 过滤浏览器内部页面
      if (isInternalPage(tab.url)) {
        showNotification("AnyKeep", "不支持保存浏览器内部页面", false);
        return;
      }

      // 尝试从 Content Script 获取更丰富的信息
      let metadata: Partial<PageMetadata> | undefined;
      if (tab.id) {
        metadata = (await getPageInfoFromContentScript(tab.id)) || undefined;
      }

      const result = await saveToAnyKeep(
        tab.url,
        tab.title || tab.url,
        metadata,
      );
      showNotification(
        result.success ? "✓ 收藏成功" : "✗ 收藏失败",
        result.message,
        result.success,
      );
    }
  });

  // ==================== 消息监听 ====================
  // 监听来自网页的消息（用于登录认证）
  browser.runtime.onMessageExternal.addListener(
    async (message, _sender, sendResponse) => {
      console.log("[Background] Received external message:", message.type);

      // 健康检查
      if (message.type === "PING") {
        sendResponse({ success: true, version: EXTENSION_VERSION });
        return true;
      }

      if (message.type === "ANYKEEP_AUTH") {
        // 存储认证信息
        const expiresIn = message.expiresIn || 7 * 24 * 60 * 60; // 默认 7 天
        await auth.setAuth(message.token, message.userId, expiresIn);

        // 同时更新 API URL
        if (message.apiUrl) {
          await auth.setApiUrl(message.apiUrl);
        }

        // 登录后尝试同步离线队列
        if (navigator.onLine) {
          syncOfflineQueue();
        }

        sendResponse({ success: true });
        return true;
      }

      if (message.type === "ANYKEEP_LOGOUT") {
        // 清除认证信息
        await auth.logout();
        sendResponse({ success: true });
        return true;
      }

      return false;
    },
  );

  // 监听来自 popup 的消息
  browser.runtime.onMessage.addListener(
    async (message, _sender, sendResponse) => {
      console.log("[Background] Received message:", message.type);

      if (message.type === "GET_AUTH_STATUS") {
        const status = await auth.getStatus();
        const authInfo = await auth.getAuth();
        sendResponse({
          status,
          isLoggedIn: status === "loggedIn",
          isExpired: status === "expired",
          userId: authInfo?.userId,
        });
        return true;
      }

      if (message.type === "CLEAR_AUTH") {
        await auth.logout();
        sendResponse({ success: true });
        return true;
      }

      if (message.type === "SAVE_BOOKMARK") {
        const result = await saveToAnyKeep(
          message.url,
          message.title,
          message.metadata,
        );
        sendResponse(result);
        return true;
      }

      if (message.type === "GET_PAGE_INFO") {
        // 从当前标签页获取页面信息
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab?.id) {
          const pageInfo = await getPageInfoFromContentScript(tab.id);
          sendResponse(pageInfo);
        } else {
          sendResponse(null);
        }
        return true;
      }

      if (message.type === "SYNC_OFFLINE_QUEUE") {
        await syncOfflineQueue();
        sendResponse({ success: true });
        return true;
      }

      if (message.type === "GET_OFFLINE_COUNT") {
        await offlineQueue.init();
        const count = await offlineQueue.getCount();
        sendResponse({ count });
        return true;
      }

      return false;
    },
  );

  // ==================== 初始化 ====================
  // 扩展安装/更新时的初始化
  browser.runtime.onInstalled.addListener(async (details) => {
    console.log("[AnyKeep] Extension installed/updated:", details.reason);

    if (details.reason === "install") {
      // 首次安装，设置默认值（生产环境 URL）
      await storage.set("apiUrl", "https://anykeep.vercel.app");

      // 显示欢迎通知
      showNotification(
        "欢迎使用 AnyKeep",
        "使用 Ctrl+Shift+S 快速保存当前页面",
        true,
      );
    }

    if (details.reason === "update") {
      // 更新时检查并同步离线队列
      if (navigator.onLine) {
        syncOfflineQueue();
      }
    }
  });

  // 启动时检查离线队列
  (async () => {
    if (navigator.onLine) {
      const loggedIn = await auth.isLoggedIn();
      if (loggedIn) {
        await offlineQueue.init();
        const count = await offlineQueue.getCount();
        if (count > 0) {
          console.log(`[AnyKeep] Found ${count} offline bookmarks, syncing...`);
          syncOfflineQueue();
        }
      }
    }
  })();
});
