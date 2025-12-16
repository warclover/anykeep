/**
 * AnyKeep 浏览器扩展 - API 通信层
 * 统一封装与 AnyKeep 后端的 API 调用
 */

import type {
  ApiResponse,
  BookmarkCreateData,
  BookmarkResponse,
  PageMetadata,
  Platform,
} from "@/types";
import { auth } from "./auth";

/** API 错误类 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 发起 API 请求
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const apiUrl = await auth.getApiUrl();
  const authHeader = await auth.getAuthHeader();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (authHeader) {
    Object.assign(headers, authHeader);
  }

  const url = `${apiUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 处理非 JSON 响应
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      if (!response.ok) {
        throw new ApiError(
          `HTTP Error: ${response.status}`,
          "HTTP_ERROR",
          response.status,
        );
      }
      return {} as T;
    }

    const data = await response.json();

    // 处理 API 错误响应
    if (!response.ok) {
      throw new ApiError(
        data.error?.message || data.message || "请求失败",
        data.error?.code || "API_ERROR",
        response.status,
      );
    }

    return data;
  } catch (error) {
    // 网络错误
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError("网络连接失败，请检查网络", "NETWORK_ERROR");
    }

    // 重新抛出 ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // 其他错误
    throw new ApiError(
      error instanceof Error ? error.message : "未知错误",
      "UNKNOWN_ERROR",
    );
  }
}

/**
 * 保存书签
 */
async function saveBookmark(
  data: BookmarkCreateData,
): Promise<ApiResponse<BookmarkResponse>> {
  const authInfo = await auth.getAuth();

  if (!authInfo) {
    throw new ApiError("请先登录", "UNAUTHORIZED");
  }

  return request<ApiResponse<BookmarkResponse>>("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      url: data.url,
      title: data.title,
      description: data.description,
      coverUrl: data.coverUrl,
      author: data.author,
      sourceName: data.sourceName,
      platform: data.platform,
      folderId: data.folderId,
      userTags: data.userTags,
      notes: data.notes,
      publishTime: data.publishTime,
      wordCount: data.wordCount,
      imageCount: data.imageCount,
      user_id: authInfo.userId,
    }),
  });
}

/**
 * 获取网页元数据
 */
async function getMetadata(url: string): Promise<PageMetadata> {
  const response = await request<ApiResponse<PageMetadata>>(
    `/api/bookmarks/metadata?url=${encodeURIComponent(url)}`,
  );

  if (!response.data) {
    throw new ApiError("获取元数据失败", "METADATA_ERROR");
  }

  return response.data;
}

/**
 * 检查 URL 是否已收藏
 */
async function checkDuplicate(url: string): Promise<boolean> {
  try {
    const response = await request<ApiResponse<{ exists: boolean }>>(
      `/api/bookmarks/check?url=${encodeURIComponent(url)}`,
    );
    return response.data?.exists ?? false;
  } catch {
    // 如果接口不存在，返回 false
    return false;
  }
}

/**
 * 验证认证状态
 */
async function verifyAuth(): Promise<boolean> {
  try {
    await request<ApiResponse>("/api/auth/verify");
    return true;
  } catch {
    return false;
  }
}

/**
 * 平台检测函数
 */
function detectPlatform(url: string): Platform {
  const platformPatterns: Record<Platform, RegExp[]> = {
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
    BROWSER_CHROME: [],
    BROWSER_EDGE: [],
    BROWSER_FIREFOX: [],
    BROWSER_SAFARI: [],
    OTHER: [],
    UNKNOWN: [],
  };

  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    if (patterns.some((pattern) => pattern.test(url))) {
      return platform as Platform;
    }
  }

  return "OTHER";
}

/**
 * API 对象
 */
export const api = {
  request,
  saveBookmark,
  getMetadata,
  checkDuplicate,
  verifyAuth,
  detectPlatform,
  ApiError,
};

export default api;
