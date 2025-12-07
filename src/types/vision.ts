/**
 * 视觉分析功能类型定义
 *
 * 这是一个独立的插件模块，与现有功能完全解耦
 * 用于 Qwen-VL 多模态图片分析功能
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

// ============================================
// 核心类型定义
// ============================================

/**
 * 图片类型分类
 */
export type ImageType = "chart" | "screenshot" | "photo" | "design" | "unknown";

/**
 * 视觉分析状态
 */
export type VisionAnalysisStatus =
  | "idle" // 未开始
  | "pending" // 等待处理
  | "analyzing" // 分析中
  | "completed" // 已完成
  | "failed"; // 失败

/**
 * 单张图片的分析结果
 */
export interface ImageAnalysisResult {
  /** 整体描述 (Caption) */
  description: string;

  /** 提取的文字 (OCR)，可选 */
  ocrText?: string;

  /** 视觉标签，3-5 个描述视觉特征的标签 */
  visualTags: string[];

  /** 图片类型判断 */
  imageType: ImageType;

  /** 置信度 (0-1)，可选 */
  confidence?: number;
}

/**
 * API 使用量统计（用于计费预留）
 */
export interface VisionUsage {
  /** 输入 token 数 */
  promptTokens: number;

  /** 输出 token 数 */
  completionTokens: number;

  /** 总 token 数 */
  totalTokens: number;
}

/**
 * 单张图片的完整分析数据
 */
export interface ImageAnalysisData {
  /** 图片 URL */
  url: string;

  /** 分析结果 */
  result: ImageAnalysisResult;

  /** 分析耗时 (毫秒) */
  durationMs?: number;
}

/**
 * 书签的视觉分析数据（存入 ai_vision_data 字段）
 */
export interface BookmarkVisionData {
  /** 分析时间 (ISO 8601) */
  analyzedAt: string;

  /** 分析状态 */
  status: VisionAnalysisStatus;

  /** 分析的图片列表 */
  images: ImageAnalysisData[];

  /** 使用量统计（用于计费） */
  usage?: VisionUsage;

  /** 错误信息（如果失败） */
  error?: string;

  /** 模型版本 */
  modelVersion?: string;
}

// ============================================
// API 请求/响应类型
// ============================================

/**
 * 视觉分析 API 请求参数
 */
export interface VisionAnalyzeRequest {
  /** 书签 ID */
  bookmarkId: number;

  /** 要分析的图片 URL 列表（可选，不提供则自动提取） */
  imageUrls?: string[];

  /** 最大分析图片数（默认 3） */
  maxImages?: number;

  /** 自定义分析提示词（可选） */
  customPrompt?: string;
}

/**
 * 视觉分析 API 响应
 */
export interface VisionAnalyzeResponse {
  /** 是否成功 */
  success: boolean;

  /** 分析结果数据 */
  data?: BookmarkVisionData;

  /** 错误信息 */
  error?: string;

  /** 错误代码 */
  errorCode?: VisionErrorCode;
}

/**
 * 错误代码枚举
 */
export type VisionErrorCode =
  | "UNAUTHORIZED" // 未登录
  | "BOOKMARK_NOT_FOUND" // 书签不存在
  | "NO_IMAGES" // 没有可分析的图片
  | "QUOTA_EXCEEDED" // 配额超限（商业化预留）
  | "API_ERROR" // API 调用失败
  | "TIMEOUT" // 超时
  | "INVALID_IMAGE" // 无效图片
  | "UNKNOWN_ERROR"; // 未知错误

// ============================================
// 配置类型
// ============================================

/**
 * 视觉分析服务配置
 */
export interface VisionAnalysisConfig {
  /** 模型名称 */
  model: "qwen-vl-max" | "qwen-vl-plus";

  /** API 超时时间（毫秒） */
  timeout: number;

  /** 最大重试次数 */
  maxRetries: number;

  /** 最大分析图片数 */
  maxImages: number;
}

/**
 * 默认配置
 */
export const DEFAULT_VISION_CONFIG: VisionAnalysisConfig = {
  model: "qwen-vl-max",
  timeout: 30000, // 30秒超时（视觉模型较慢）
  maxRetries: 2,
  maxImages: 3,
};

// ============================================
// 前端 Hook 类型
// ============================================

/**
 * useVisionAnalysis Hook 的返回类型
 */
export interface UseVisionAnalysisReturn {
  /** 当前分析状态 */
  status: VisionAnalysisStatus;

  /** 分析结果数据 */
  data: BookmarkVisionData | null;

  /** 错误信息 */
  error: string | null;

  /** 是否正在加载 */
  isLoading: boolean;

  /** 触发分析 */
  analyze: (bookmarkId: number, imageUrls?: string[]) => Promise<void>;

  /** 重置状态 */
  reset: () => void;
}

// ============================================
// 工具类型
// ============================================

/**
 * 检查是否有视觉分析数据
 */
export function hasVisionData(data: unknown): data is BookmarkVisionData {
  if (!data || typeof data !== "object") return false;
  const visionData = data as BookmarkVisionData;
  return (
    typeof visionData.analyzedAt === "string" &&
    Array.isArray(visionData.images) &&
    visionData.images.length > 0
  );
}

/**
 * 检查视觉分析是否完成
 */
export function isVisionAnalysisComplete(
  data: BookmarkVisionData | null,
): boolean {
  return data?.status === "completed" && data.images.length > 0;
}

/**
 * 获取视觉分析的主要描述（取第一张图片）
 */
export function getPrimaryVisionDescription(
  data: BookmarkVisionData | null,
): string | null {
  if (!data || data.images.length === 0) return null;
  return data.images[0].result.description;
}

/**
 * 获取所有视觉标签（去重）
 */
export function getAllVisualTags(data: BookmarkVisionData | null): string[] {
  if (!data || data.images.length === 0) return [];
  const tagsSet = new Set<string>();
  data.images.forEach((img) => {
    img.result.visualTags.forEach((tag) => tagsSet.add(tag));
  });
  return Array.from(tagsSet);
}

/**
 * 获取所有 OCR 文本
 */
export function getAllOcrText(data: BookmarkVisionData | null): string {
  if (!data || data.images.length === 0) return "";
  return data.images
    .map((img) => img.result.ocrText)
    .filter(Boolean)
    .join("\n\n");
}
