/**
 * API 通信模块
 *
 * 功能：
 * 1. 与 AnyKeep API 通信
 * 2. 自动添加 Authorization header
 * 3. 错误处理和重试
 */

import { getAccessToken, refreshAccessToken } from "./auth";

// API 基础 URL
const API_BASE_URL_PROD = "https://anykeep.com";
const API_BASE_URL_DEV = "http://localhost:3000";

/**
 * 获取 API 基础 URL
 */
export function getApiBaseUrl(): string {
  // 开发模式检测
  if (__DEV__) {
    return API_BASE_URL_DEV;
  }
  return API_BASE_URL_PROD;
}

/**
 * API 请求选项
 */
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retryOnAuthError?: boolean;
}

/**
 * API 响应类型
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 发送 API 请求
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    body,
    headers = {},
    skipAuth = false,
    retryOnAuthError = true,
  } = options;

  // 构建请求 URL
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  // 构建请求头
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // 添加 Authorization header
  if (!skipAuth) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      requestHeaders["Authorization"] = `Bearer ${accessToken}`;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 处理 401 错误（Token 过期）
    if (response.status === 401 && retryOnAuthError) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // 重试请求
        return apiRequest(endpoint, { ...options, retryOnAuthError: false });
      }
      return { success: false, error: "Authentication required" };
    }

    // 解析响应
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `HTTP ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[API] Request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================
// 收藏相关 API
// ============================================

/**
 * 书签数据类型
 */
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  platform: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 创建书签请求
 */
export interface CreateBookmarkRequest {
  url: string;
  title: string;
  description?: string;
  platform?: string;
  tags?: string[];
  folder_id?: string;
}

/**
 * 快速保存当前页面
 */
export async function quickSaveBookmark(
  url: string,
  title: string,
  options?: {
    description?: string;
    tags?: string[];
    folder_id?: string;
  },
): Promise<ApiResponse<Bookmark>> {
  return apiRequest<Bookmark>("/api/plugin/bookmarks", {
    method: "POST",
    body: {
      url,
      title,
      platform: "browser_extension",
      ...options,
    },
  });
}

/**
 * 获取最近收藏
 */
export async function getRecentBookmarks(
  limit: number = 10,
): Promise<ApiResponse<Bookmark[]>> {
  return apiRequest<Bookmark[]>(`/api/plugin/bookmarks/recent?limit=${limit}`);
}

/**
 * 搜索收藏
 */
export async function searchBookmarks(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
  },
): Promise<ApiResponse<{ bookmarks: Bookmark[]; total: number }>> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options?.limit ?? 20),
    offset: String(options?.offset ?? 0),
  });

  return apiRequest(`/api/plugin/bookmarks/search?${params}`);
}

/**
 * 检查 URL 是否已收藏
 */
export async function checkUrlSaved(
  url: string,
): Promise<ApiResponse<{ saved: boolean; bookmark?: Bookmark }>> {
  return apiRequest(
    `/api/plugin/bookmarks/check?url=${encodeURIComponent(url)}`,
  );
}

/**
 * 初始化 API 模块
 */
export async function initializeApi(): Promise<void> {
  // API 模块已就绪
}

// ============================================
// AI Agent 聊天相关
// ============================================

/**
 * 浏览器上下文类型
 */
export interface BrowserContext {
  tabId?: number;
  page?: {
    title?: string;
    url?: string;
    description?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    author?: string;
    publishedTime?: string;
    siteName?: string;
    favicon?: string;
  };
  selection?: {
    text: string;
    html?: string;
  };
  pageContent?: string;
  links?: Array<{
    url: string;
    text: string;
    title?: string;
  }>;
  browser?: {
    name: "chrome" | "edge" | "firefox" | "other";
    version?: string;
  };
}

/**
 * Agent 聊天消息
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Agent 流式响应块
 */
export interface AgentStreamChunk {
  type: "text" | "action" | "bookmark_created" | "error" | "done";
  data: {
    text?: string;
    action?: string;
    bookmark?: {
      id: number;
      url: string;
      title: string;
    };
    message?: string;
    conversationId?: string;
  };
}

/**
 * Agent 聊天选项
 */
export interface AgentChatOptions {
  conversationId?: string;
  messageHistory?: ChatMessage[];
  browserContext?: BrowserContext;
  quickAction?:
    | "save_page"
    | "save_selection"
    | "summarize"
    | "extract_links"
    | "ask_about_page";
  streaming?: boolean;
  temperature?: number;
  onChunk?: (chunk: AgentStreamChunk) => void;
  onError?: (error: Error) => void;
  onComplete?: (conversationId: string) => void;
}

/**
 * 与 AI Agent 进行对话（支持 SSE 流式响应）
 */
export async function chatWithAgent(
  message: string,
  options: AgentChatOptions = {},
): Promise<void> {
  const {
    conversationId,
    messageHistory,
    browserContext,
    quickAction,
    streaming = true,
    temperature,
    onChunk,
    onError,
    onComplete,
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/plugin/agent/chat`;

  // 获取 Access Token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    onError?.(new Error("Not authenticated"));
    return;
  }

  const requestBody = {
    message,
    conversationId,
    messageHistory,
    browserContext,
    quickAction,
    options: {
      streaming,
      temperature,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // 尝试刷新 Token
        const newToken = await refreshAccessToken();
        if (newToken) {
          return chatWithAgent(message, options);
        }
      }
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    if (streaming && response.body) {
      // 处理 SSE 流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentConversationId = conversationId || "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              onComplete?.(currentConversationId);
              return;
            }

            try {
              const chunk = JSON.parse(data) as AgentStreamChunk;

              // 提取会话 ID
              if (chunk.data.conversationId) {
                currentConversationId = chunk.data.conversationId;
              }

              onChunk?.(chunk);
            } catch (parseError) {
              console.error("[Agent] Failed to parse SSE chunk:", parseError);
            }
          }
        }
      }

      onComplete?.(currentConversationId);
    } else {
      // 非流式响应
      const data = await response.json();

      if (data.success) {
        onChunk?.({
          type: "text",
          data: { text: data.content, conversationId: data.conversationId },
        });
        onComplete?.(data.conversationId);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    }
  } catch (error) {
    console.error("[Agent] Chat error:", error);
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 快速保存当前页面（使用 Agent）
 */
export async function agentQuickSave(
  browserContext: BrowserContext,
): Promise<
  ApiResponse<{
    bookmark?: { id: number; url: string; title: string };
    message?: string;
  }>
> {
  return new Promise((resolve) => {
    chatWithAgent("保存这个页面", {
      browserContext,
      quickAction: "save_page",
      streaming: false,
      onChunk: (chunk) => {
        if (chunk.type === "bookmark_created" && chunk.data.bookmark) {
          resolve({
            success: true,
            data: {
              bookmark: chunk.data.bookmark,
              message: chunk.data.text || "保存成功",
            },
          });
        }
      },
      onError: (error) => {
        resolve({ success: false, error: error.message });
      },
      onComplete: () => {
        // 如果没有收到 bookmark_created，可能是错误
      },
    });
  });
}

/**
 * 获取当前标签页的浏览器上下文
 */
export async function getCurrentTabContext(): Promise<BrowserContext | null> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id || !tab.url) {
      return null;
    }

    // 基础上下文
    const context: BrowserContext = {
      tabId: tab.id,
      page: {
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl,
      },
      browser: {
        name: detectBrowserType(),
      },
    };

    // 注入脚本获取更多页面信息
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageMetadata,
      });

      if (results?.[0]?.result) {
        const metadata = results[0].result;
        context.page = {
          ...context.page,
          ...metadata,
        };
      }
    } catch {
      // 某些页面（如 chrome:// 页面）无法注入脚本，忽略
    }

    return context;
  } catch (error) {
    console.error("[API] Failed to get tab context:", error);
    return null;
  }
}

/**
 * 检测浏览器类型
 */
function detectBrowserType(): "chrome" | "edge" | "firefox" | "other" {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("edg/") || ua.includes("edge/")) {
    return "edge";
  }
  if (ua.includes("firefox/")) {
    return "firefox";
  }
  if (ua.includes("chrome/") || ua.includes("chromium/")) {
    return "chrome";
  }

  return "other";
}

/**
 * 页面元数据提取函数（在页面上下文中执行）
 */
function extractPageMetadata() {
  const getMeta = (name: string): string | undefined => {
    const meta = document.querySelector(
      `meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`,
    );
    return meta?.getAttribute("content") || undefined;
  };

  return {
    title: document.title,
    url: window.location.href,
    description: getMeta("description") || getMeta("og:description"),
    keywords: getMeta("keywords")
      ?.split(",")
      .map((k) => k.trim()),
    ogTitle: getMeta("og:title"),
    ogDescription: getMeta("og:description"),
    ogImage: getMeta("og:image"),
    author: getMeta("author") || getMeta("article:author"),
    publishedTime: getMeta("article:published_time"),
    siteName: getMeta("og:site_name"),
  };
}
