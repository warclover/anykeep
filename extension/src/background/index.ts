/**
 * AnyKeep Extension - Background Service Worker
 *
 * 职责：
 * 1. 处理扩展图标点击事件
 * 2. 管理 OAuth 认证流程
 * 3. 与 AnyKeep API 通信
 * 4. 管理离线队列
 * 5. Agent Bridge（AI 聊天）
 */

import { initializeAuth, getAuthStatus, startOAuthFlow, logout } from "./auth";
import {
  initializeApi,
  quickSaveBookmark,
  getRecentBookmarks,
  searchBookmarks,
  checkUrlSaved,
  chatWithAgent,
  getCurrentTabContext,
  type BrowserContext,
  type AgentStreamChunk,
  type ChatMessage,
} from "./api";
import { initializeBadge, updateBadge } from "./badge";
import { initializeOfflineQueue } from "./offline-queue";

// ============================================
// 初始化
// ============================================

async function initialize() {
  try {
    await initializeAuth();
    await initializeApi();
    await initializeBadge();
    await initializeOfflineQueue();
  } catch (error) {
    console.error("[AnyKeep] Extension initialization failed:", error);
  }
}

// Service Worker 安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 首次安装：打开欢迎页面
    chrome.tabs.create({
      url: "https://anykeep.com/extension/welcome",
    });
  }
});

// ============================================
// 扩展图标点击事件
// ============================================

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  // 检查是否是可保存的 URL
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("about:")) {
    return;
  }

  // 一键保存当前页面
  try {
    const result = await quickSaveBookmark(tab.url, tab.title || tab.url);

    if (result.success) {
      updateBadge("saved");
      // 3秒后恢复默认状态
      setTimeout(() => updateBadge("default"), 3000);
    } else {
      updateBadge("error");
      console.error("[AnyKeep] Quick save failed:", result.error);
    }
  } catch (error) {
    updateBadge("error");
    console.error("[AnyKeep] Quick save error:", error);
  }
});

// ============================================
// 消息处理
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 异步处理消息
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("[AnyKeep] Message handling error:", error);
      sendResponse({ success: false, error: error.message });
    });

  // 返回 true 表示异步响应
  return true;
});

// 长连接处理（用于 Agent 流式通信）
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "agent-chat") {
    port.onMessage.addListener(async (message) => {
      if (message.type === "AGENT_CHAT") {
        await handleAgentChat(port, message.payload);
      }
    });
  }
});

// ============================================
// 消息处理函数
// ============================================

interface MessagePayload {
  type: string;
  payload?: unknown;
}

async function handleMessage(
  message: MessagePayload,
  _sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "GET_AUTH_STATUS": {
      const status = await getAuthStatus();
      return status;
    }

    case "START_AUTH": {
      const result = await startOAuthFlow();
      return result;
    }

    case "LOGOUT": {
      await logout();
      return { success: true };
    }

    case "QUICK_SAVE": {
      const tab = await getCurrentTab();
      if (!tab?.url || !tab?.title) {
        return { success: false, error: "No active tab" };
      }

      const payload = message.payload as
        | { tags?: string[]; folder_id?: string }
        | undefined;
      const result = await quickSaveBookmark(tab.url, tab.title, {
        tags: payload?.tags,
        folder_id: payload?.folder_id,
      });
      return result;
    }

    case "GET_RECENT": {
      const payload = message.payload as { limit?: number } | undefined;
      const result = await getRecentBookmarks(payload?.limit || 10);
      return result;
    }

    case "SEARCH": {
      const payload = message.payload as {
        query: string;
        limit?: number;
        offset?: number;
      };
      if (!payload?.query) {
        return { success: false, error: "Query is required" };
      }
      const result = await searchBookmarks(payload.query, {
        limit: payload.limit,
        offset: payload.offset,
      });
      return result;
    }

    case "CHECK_URL": {
      const tab = await getCurrentTab();
      if (!tab?.url) {
        return { success: false, error: "No active tab" };
      }
      const result = await checkUrlSaved(tab.url);
      return result;
    }

    case "GET_CURRENT_CONTEXT": {
      const context = await getCurrentTabContext();
      return { success: true, data: context };
    }

    case "GET_SELECTION": {
      const selection = await getSelection();
      return { success: true, data: selection };
    }

    default:
      return { error: "Unknown message type" };
  }
}

// ============================================
// Agent 聊天处理
// ============================================

interface AgentChatPayload {
  message: string;
  conversationId?: string;
  messageHistory?: ChatMessage[];
  includePageContext?: boolean;
  includeSelection?: boolean;
  quickAction?:
    | "save_page"
    | "save_selection"
    | "summarize"
    | "extract_links"
    | "ask_about_page";
}

async function handleAgentChat(
  port: chrome.runtime.Port,
  payload: AgentChatPayload,
): Promise<void> {
  const {
    message,
    conversationId,
    messageHistory,
    includePageContext,
    includeSelection,
    quickAction,
  } = payload;

  // 构建浏览器上下文
  let browserContext: BrowserContext | undefined;

  if (includePageContext || quickAction) {
    browserContext = (await getCurrentTabContext()) || undefined;
  }

  if (includeSelection && browserContext) {
    const selection = await getSelection();
    if (selection) {
      browserContext.selection = selection;
    }
  }

  // 发送到 Agent
  await chatWithAgent(message, {
    conversationId,
    messageHistory,
    browserContext,
    quickAction,
    streaming: true,
    onChunk: (chunk: AgentStreamChunk) => {
      // 发送流式响应到 Popup
      try {
        port.postMessage({
          type: "AGENT_CHUNK",
          chunk,
        });
      } catch (error) {
        console.error("[AnyKeep] Failed to send chunk to port:", error);
      }
    },
    onError: (error: Error) => {
      try {
        port.postMessage({
          type: "AGENT_ERROR",
          error: error.message,
        });
      } catch (e) {
        console.error("[AnyKeep] Failed to send error to port:", e);
      }
    },
    onComplete: (finalConversationId: string) => {
      try {
        port.postMessage({
          type: "AGENT_COMPLETE",
          conversationId: finalConversationId,
        });
      } catch (e) {
        console.error("[AnyKeep] Failed to send complete to port:", e);
      }
    },
  });
}

// ============================================
// 辅助函数
// ============================================

async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function getSelection(): Promise<{ text: string; html?: string } | null> {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) return null;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          return null;
        }

        const text = selection.toString();
        if (!text) return null;

        // 尝试获取 HTML
        let html: string | undefined;
        try {
          const range = selection.getRangeAt(0);
          const container = document.createElement("div");
          container.appendChild(range.cloneContents());
          html = container.innerHTML;
        } catch {
          // 忽略 HTML 提取错误
        }

        return { text, html };
      },
    });

    return results?.[0]?.result || null;
  } catch (error) {
    console.error("[AnyKeep] Failed to get selection:", error);
    return null;
  }
}

// ============================================
// 启动
// ============================================

initialize();
