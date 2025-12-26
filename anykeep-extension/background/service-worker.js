/**
 * AnyKeep Background Service Worker
 *
 * 处理扩展后台任务：
 * - API 通信
 * - 认证状态管理
 * - 离线队列
 */

// =============================================================================
// 配置
// =============================================================================

const CONFIG = {
  // API 基础 URL（支持本地开发和生产环境）
  apiBaseUrl: "http://localhost:3000", // 生产环境改为 https://anykeep.app
  // 登录页面 URL
  loginUrl: "http://localhost:3000/login",
  // 离线队列最大长度
  maxQueueSize: 50,
  // 重试延迟（ms）
  retryDelay: 5000,
  // 最大重试次数
  maxRetries: 3,
};

// =============================================================================
// 认证状态
// =============================================================================

let authToken = null;
let userId = null;

/**
 * 获取存储的认证信息
 */
async function getAuthInfo() {
  try {
    const result = await chrome.storage.local.get(["authToken", "userId"]);
    authToken = result.authToken || null;
    userId = result.userId || null;
    return { authToken, userId };
  } catch (error) {
    console.error("[AnyKeep] Failed to get auth info:", error);
    return { authToken: null, userId: null };
  }
}

/**
 * 保存认证信息
 */
async function setAuthInfo(token, uid) {
  try {
    authToken = token;
    userId = uid;
    await chrome.storage.local.set({ authToken: token, userId: uid });
  } catch (error) {
    console.error("[AnyKeep] Failed to save auth info:", error);
  }
}

/**
 * 清除认证信息
 */
async function clearAuthInfo() {
  try {
    authToken = null;
    userId = null;
    await chrome.storage.local.remove(["authToken", "userId"]);
  } catch (error) {
    console.error("[AnyKeep] Failed to clear auth info:", error);
  }
}

// =============================================================================
// 离线队列
// =============================================================================

/**
 * 获取离线队列
 */
async function getOfflineQueue() {
  try {
    const result = await chrome.storage.local.get("offlineQueue");
    return result.offlineQueue || [];
  } catch (error) {
    console.error("[AnyKeep] Failed to get offline queue:", error);
    return [];
  }
}

/**
 * 添加到离线队列
 */
async function addToOfflineQueue(articleData) {
  try {
    const queue = await getOfflineQueue();

    // 检查是否已存在（基于 URL）
    const exists = queue.some((item) => item.url === articleData.url);
    if (exists) {
      console.log("[AnyKeep] Article already in queue:", articleData.url);
      return;
    }

    // 限制队列大小
    if (queue.length >= CONFIG.maxQueueSize) {
      queue.shift(); // 移除最早的
    }

    queue.push({
      ...articleData,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    });

    await chrome.storage.local.set({ offlineQueue: queue });
    console.log("[AnyKeep] Added to offline queue:", articleData.title);
  } catch (error) {
    console.error("[AnyKeep] Failed to add to offline queue:", error);
  }
}

/**
 * 从离线队列移除
 */
async function removeFromOfflineQueue(url) {
  try {
    const queue = await getOfflineQueue();
    const newQueue = queue.filter((item) => item.url !== url);
    await chrome.storage.local.set({ offlineQueue: newQueue });
  } catch (error) {
    console.error("[AnyKeep] Failed to remove from offline queue:", error);
  }
}

/**
 * 处理离线队列
 */
async function processOfflineQueue() {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`[AnyKeep] Processing ${queue.length} queued articles...`);

  for (const item of queue) {
    try {
      const result = await saveArticleToApi(item);
      if (result.success) {
        await removeFromOfflineQueue(item.url);
        console.log("[AnyKeep] Synced queued article:", item.title);
      }
    } catch (error) {
      console.error("[AnyKeep] Failed to sync queued article:", item.url, error);
      // 更新重试计数
      item.retryCount = (item.retryCount || 0) + 1;
      if (item.retryCount >= CONFIG.maxRetries) {
        await removeFromOfflineQueue(item.url);
        console.log("[AnyKeep] Removed after max retries:", item.url);
      }
    }
  }
}

// =============================================================================
// API 通信
// =============================================================================

/**
 * 保存文章到 AnyKeep API
 */
async function saveArticleToApi(articleData) {
  const { authToken } = await getAuthInfo();

  if (!authToken) {
    throw new Error("未登录，请先登录 AnyKeep");
  }

  const response = await fetch(`${CONFIG.apiBaseUrl}/api/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      url: articleData.url,
      title: articleData.title,
      description: articleData.description,
      coverImage: articleData.coverImage,
      platform: articleData.platform,
      // 额外的微信文章元数据
      metadata: {
        author: articleData.author,
        publishTime: articleData.publishTime,
        biz: articleData.biz,
        wordCount: articleData.wordCount,
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearAuthInfo();
      throw new Error("登录已过期，请重新登录");
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败 (${response.status})`);
  }

  return await response.json();
}

/**
 * 检查登录状态
 */
async function checkAuthStatus() {
  const { authToken } = await getAuthInfo();

  if (!authToken) {
    return { authenticated: false };
  }

  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { authenticated: true, user: data.user };
    } else {
      await clearAuthInfo();
      return { authenticated: false };
    }
  } catch (error) {
    console.error("[AnyKeep] Auth check failed:", error);
    return { authenticated: false, offline: true };
  }
}

// =============================================================================
// 消息处理
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[AnyKeep] Received message:", message.type);

  switch (message.type) {
    case "SAVE_ARTICLE":
      handleSaveArticle(message.data)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // 异步响应

    case "CHECK_AUTH":
      checkAuthStatus()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ authenticated: false, error: error.message })
        );
      return true;

    case "SET_AUTH":
      setAuthInfo(message.token, message.userId)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "LOGOUT":
      clearAuthInfo()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "OPEN_LOGIN":
      chrome.tabs.create({ url: CONFIG.loginUrl });
      sendResponse({ success: true });
      return false;

    case "GET_QUEUE_STATUS":
      getOfflineQueue()
        .then((queue) => sendResponse({ success: true, queue }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "SYNC_QUEUE":
      processOfflineQueue()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    default:
      sendResponse({ success: false, error: "Unknown message type" });
      return false;
  }
});

/**
 * 处理保存文章请求
 */
async function handleSaveArticle(articleData) {
  try {
    // 尝试直接保存
    const result = await saveArticleToApi(articleData);
    return { success: true, data: result };
  } catch (error) {
    // 如果是网络错误，添加到离线队列
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError")
    ) {
      await addToOfflineQueue(articleData);
      return {
        success: true,
        queued: true,
        message: "已添加到离线队列，网络恢复后自动同步",
      };
    }

    throw error;
  }
}

// =============================================================================
// 定时任务
// =============================================================================

// 设置定时同步离线队列（每 5 分钟）
chrome.alarms.create("syncOfflineQueue", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncOfflineQueue") {
    processOfflineQueue();
  }
});

// =============================================================================
// 初始化
// =============================================================================

// 扩展安装/更新时
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[AnyKeep] Extension installed/updated:", details.reason);

  if (details.reason === "install") {
    // 首次安装，打开欢迎页面
    chrome.tabs.create({ url: `${CONFIG.loginUrl}?from=extension` });
  }
});

// 启动时加载认证信息
getAuthInfo().then(() => {
  console.log("[AnyKeep] Auth info loaded, token:", authToken ? "present" : "none");
});

console.log("[AnyKeep] Service worker initialized");
