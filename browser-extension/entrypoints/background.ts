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
 */

// 平台检测函数
function detectPlatform(url: string): string {
  const platformPatterns: Record<string, RegExp[]> = {
    WECHAT_OFFICIAL_ACCOUNT: [/mp\.weixin\.qq\.com/],
    BILIBILI: [/bilibili\.com/, /b23\.tv/],
    XIAOHONGSHU: [/xiaohongshu\.com/, /xhslink\.com/],
    ZHIHU: [/zhihu\.com/, /zhuanlan\.zhihu\.com/],
    DOUYIN: [/douyin\.com/, /v\.douyin\.com/],
    WEIBO: [/weibo\.com/, /weibo\.cn/],
    JUEJIN: [/juejin\.cn/],
    JIANSHU: [/jianshu\.com/],
    CSDN: [/csdn\.net/, /blog\.csdn\.net/],
    GITHUB: [/github\.com/],
    YOUTUBE: [/youtube\.com/, /youtu\.be/],
    TWITTER: [/twitter\.com/, /x\.com/],
    MEDIUM: [/medium\.com/],
    NOTION: [/notion\.so/],
  };

  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    if (patterns.some((pattern) => pattern.test(url))) {
      return platform;
    }
  }

  return "OTHER";
}

// 保存页面到 AnyKeep
async function saveToAnyKeep(
  url: string,
  title: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const storage = await browser.storage.local.get([
      "authToken",
      "userId",
      "apiUrl",
    ]);

    if (!storage.authToken || !storage.userId) {
      return { success: false, message: "请先登录 AnyKeep" };
    }

    const apiUrl = storage.apiUrl || "https://anykeep.vercel.app";
    const platform = detectPlatform(url);

    const response = await fetch(`${apiUrl}/api/bookmarks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${storage.authToken}`,
      },
      body: JSON.stringify({
        url,
        title,
        platform,
        user_id: storage.userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || "保存失败" };
    }

    return { success: true, message: "保存成功！" };
  } catch (error) {
    console.error("Save error:", error);
    return { success: false, message: "网络错误，请稍后重试" };
  }
}

// 显示通知
function showNotification(title: string, message: string, isSuccess: boolean) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("/icon/128.png"),
    title,
    message,
    priority: isSuccess ? 0 : 2,
  });
}

export default defineBackground(() => {
  console.log("AnyKeep Extension: Background script loaded");

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

    if (info.menuItemId === "save-page-to-anykeep" && tab) {
      url = info.pageUrl || tab.url || "";
      title = tab.title || url;
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

    const result = await saveToAnyKeep(url, title);
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
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:")
      ) {
        showNotification("AnyKeep", "不支持保存浏览器内部页面", false);
        return;
      }

      const result = await saveToAnyKeep(tab.url, tab.title || tab.url);
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
    async (message, sender, sendResponse) => {
      console.log("Received external message:", message);

      // 健康检查
      if (message.type === "PING") {
        sendResponse({ success: true, version: "1.0.0" });
        return true;
      }

      if (message.type === "ANYKEEP_AUTH") {
        // 存储认证信息
        await browser.storage.local.set({
          authToken: message.token,
          userId: message.userId,
          apiUrl: message.apiUrl || "http://localhost:3000",
        });

        sendResponse({ success: true });
        return true;
      }

      if (message.type === "ANYKEEP_LOGOUT") {
        // 清除认证信息
        await browser.storage.local.remove(["authToken", "userId"]);
        sendResponse({ success: true });
        return true;
      }

      return false;
    },
  );

  // 监听来自 popup 的消息
  browser.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      console.log("Received message:", message);

      if (message.type === "GET_AUTH_STATUS") {
        const storage = await browser.storage.local.get([
          "authToken",
          "userId",
        ]);
        sendResponse({
          isLoggedIn: !!(storage.authToken && storage.userId),
          userId: storage.userId,
        });
        return true;
      }

      if (message.type === "CLEAR_AUTH") {
        await browser.storage.local.remove(["authToken", "userId"]);
        sendResponse({ success: true });
        return true;
      }

      if (message.type === "SAVE_BOOKMARK") {
        const result = await saveToAnyKeep(message.url, message.title);
        sendResponse(result);
        return true;
      }

      return false;
    },
  );

  // ==================== 初始化 ====================
  // 扩展安装/更新时的初始化
  browser.runtime.onInstalled.addListener(async (details) => {
    console.log("Extension installed/updated:", details.reason);

    if (details.reason === "install") {
      // 首次安装，设置默认值（生产环境 URL）
      await browser.storage.local.set({
        apiUrl: "https://anykeep.vercel.app",
      });

      // 显示欢迎通知
      showNotification(
        "欢迎使用 AnyKeep",
        "使用 Ctrl+Shift+S 快速保存当前页面",
        true,
      );
    }
  });
});
