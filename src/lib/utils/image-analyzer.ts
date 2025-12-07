/**
 * 图片视觉分析服务
 *
 * 使用阿里云 Qwen-VL 多模态大模型（OpenAI 兼容接口）
 * 提供图片内容理解、OCR、图表分析等功能
 *
 * 这是一个独立的插件模块，与现有 AI 功能完全解耦
 * - 不修改现有 ai-generator.ts
 * - 不修改现有 embedding-generator.ts
 * - 独立的错误处理和日志
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

import { logger } from "@/lib/logger";
import type {
  ImageAnalysisResult,
  ImageAnalysisData,
  BookmarkVisionData,
  VisionAnalysisConfig,
  VisionUsage,
  ImageType,
} from "@/types/vision";
import { DEFAULT_VISION_CONFIG } from "@/types/vision";

// ============================================
// API 配置
// ============================================

// 阿里云百炼 API (OpenAI 兼容模式) - 复用现有 DASHSCOPE_API_KEY
const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

// Qwen-VL 模型配置
const QWEN_VL_MODELS = {
  "qwen-vl-max": "qwen-vl-max", // 最强性能
  "qwen-vl-plus": "qwen-vl-plus", // 平衡性价比
} as const;

// ============================================
// Prompt 工程
// ============================================

/**
 * 系统提示词 - 结构化输出
 */
const SYSTEM_PROMPT = `你是一个专业的视觉内容分析专家。请仔细分析用户提供的图片，并以 JSON 格式输出分析结果。

分析任务：
1. **判断类型**：
   - chart: 图表、数据可视化、流程图、架构图
   - screenshot: 屏幕截图、软件界面、网页截图
   - design: 设计稿、UI 设计、海报、平面设计
   - photo: 普通照片、风景、人物、实物
   - unknown: 无法确定类型

2. **深度描述**（根据类型调整重点）：
   - 图表：解释核心数据、趋势和结论
   - 截图：提取关键文字和界面信息
   - 设计：描述风格、配色、布局和设计语言
   - 照片：描述主体、场景和氛围

3. **OCR 文字提取**：
   - 提取图片中的所有重要文字
   - 保持原有的层级结构和逻辑顺序
   - 如果没有文字，此字段可以省略

4. **视觉标签**：
   - 生成 3-5 个描述视觉特征的标签
   - 标签应具体、有意义，便于检索
   - 例如：极简风格、数据架构图、深色主题、移动端界面

请严格按以下 JSON 格式输出，不要添加任何额外文字：

{
  "imageType": "chart|screenshot|design|photo|unknown",
  "description": "详细的内容描述，100-300字",
  "ocrText": "提取的文字内容（可选）",
  "visualTags": ["标签1", "标签2", "标签3"]
}`;

/**
 * 用户提示词模板
 */
const USER_PROMPT_TEMPLATE = "请分析这张图片的内容。";

// ============================================
// API 响应类型
// ============================================

interface QwenVLResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// 核心分析函数
// ============================================

/**
 * 分析单张图片
 *
 * @param imageUrl - 图片 URL
 * @param customPrompt - 自定义提示词（可选）
 * @param config - 配置项（可选）
 * @returns 分析结果
 *
 * @example
 * ```ts
 * const result = await analyzeImage('https://example.com/image.png');
 * console.log(result.description);
 * console.log(result.visualTags);
 * ```
 */
export async function analyzeImage(
  imageUrl: string,
  customPrompt?: string,
  config: Partial<VisionAnalysisConfig> = {},
): Promise<{ result: ImageAnalysisResult; usage: VisionUsage }> {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    logger.error(
      { action: "vision_no_api_key" },
      "Vision: DASHSCOPE_API_KEY not configured",
    );
    throw new Error("DASHSCOPE_API_KEY 环境变量未配置");
  }

  // 验证图片 URL
  if (!imageUrl || !isValidImageUrl(imageUrl)) {
    throw new Error("无效的图片 URL");
  }

  const mergedConfig = { ...DEFAULT_VISION_CONFIG, ...config };
  const model = QWEN_VL_MODELS[mergedConfig.model];
  const userPrompt = customPrompt || USER_PROMPT_TEMPLATE;

  const startTime = Date.now();

  try {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
        temperature: 0.3, // 低温度确保一致性输出
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(mergedConfig.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          imageUrl: imageUrl.substring(0, 100),
          action: "vision_api_error",
        },
        "Vision: API error",
      );
      throw new Error(`Qwen-VL API 错误: ${response.status} - ${errorText}`);
    }

    const data: QwenVLResponse = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("API 未返回有效的分析结果");
    }

    // 解析 JSON 响应
    const content = data.choices[0].message.content;
    const parsedResult = parseVisionResponse(content);

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        model: data.model,
        imageType: parsedResult.imageType,
        tagsCount: parsedResult.visualTags.length,
        hasOcr: !!parsedResult.ocrText,
        tokens: data.usage?.total_tokens,
        durationMs,
        action: "vision_analyzed",
      },
      "Vision: Analysis complete",
    );

    return {
      result: parsedResult,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        logger.error(
          {
            imageUrl: imageUrl.substring(0, 100),
            durationMs,
            action: "vision_timeout",
          },
          "Vision: Timeout",
        );
        throw new Error("视觉分析超时，请稍后重试");
      }

      logger.error(
        {
          error: error.message,
          imageUrl: imageUrl.substring(0, 100),
          durationMs,
          action: "vision_failed",
        },
        "Vision: Failed",
      );
      throw error;
    }

    throw new Error("视觉分析失败");
  }
}

/**
 * 批量分析多张图片
 *
 * @param imageUrls - 图片 URL 数组
 * @param config - 配置项
 * @returns 批量分析结果
 */
export async function analyzeImages(
  imageUrls: string[],
  config: Partial<VisionAnalysisConfig> = {},
): Promise<BookmarkVisionData> {
  const mergedConfig = { ...DEFAULT_VISION_CONFIG, ...config };
  const startTime = Date.now();

  // 限制最大图片数
  const urls = imageUrls.slice(0, mergedConfig.maxImages);

  if (urls.length === 0) {
    return {
      analyzedAt: new Date().toISOString(),
      status: "failed",
      images: [],
      error: "没有提供有效的图片 URL",
    };
  }

  const results: ImageAnalysisData[] = [];
  const totalUsage: VisionUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let hasError = false;
  let lastError = "";

  // 顺序处理每张图片（避免并发超限）
  for (const url of urls) {
    const imageStartTime = Date.now();

    try {
      const { result, usage } = await analyzeImage(url, undefined, config);

      results.push({
        url,
        result,
        durationMs: Date.now() - imageStartTime,
      });

      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
    } catch (error) {
      hasError = true;
      lastError = error instanceof Error ? error.message : "未知错误";

      logger.warn(
        {
          imageUrl: url.substring(0, 100),
          error: lastError,
          action: "vision_batch_item_failed",
        },
        "Vision Batch: Single image failed, continuing...",
      );

      // 继续处理其他图片，不中断
    }
  }

  const totalDurationMs = Date.now() - startTime;

  // 至少有一张图片成功则算成功
  const status = results.length > 0 ? "completed" : "failed";

  logger.info(
    {
      totalImages: urls.length,
      successCount: results.length,
      hasError,
      totalTokens: totalUsage.totalTokens,
      durationMs: totalDurationMs,
      action: "vision_batch_complete",
    },
    "Vision Batch: Complete",
  );

  return {
    analyzedAt: new Date().toISOString(),
    status,
    images: results,
    usage: totalUsage,
    error: hasError && results.length === 0 ? lastError : undefined,
    modelVersion: mergedConfig.model,
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 解析视觉模型的 JSON 响应
 */
function parseVisionResponse(content: string): ImageAnalysisResult {
  try {
    // 尝试提取 JSON（处理可能的 markdown 代码块包装）
    let jsonStr = content.trim();

    // 移除 markdown 代码块标记
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    // 验证必填字段
    if (!parsed.description || typeof parsed.description !== "string") {
      throw new Error("Missing or invalid description");
    }

    // 规范化 imageType
    const validTypes: ImageType[] = [
      "chart",
      "screenshot",
      "photo",
      "design",
      "unknown",
    ];
    const imageType: ImageType = validTypes.includes(parsed.imageType)
      ? parsed.imageType
      : "unknown";

    // 规范化 visualTags
    const visualTags: string[] = Array.isArray(parsed.visualTags)
      ? parsed.visualTags
          .filter((t: unknown) => typeof t === "string")
          .slice(0, 5)
      : [];

    return {
      description: parsed.description,
      ocrText: typeof parsed.ocrText === "string" ? parsed.ocrText : undefined,
      visualTags,
      imageType,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : undefined,
    };
  } catch (error) {
    logger.warn(
      {
        content: content.substring(0, 200),
        error: error instanceof Error ? error.message : "Parse error",
        action: "vision_parse_fallback",
      },
      "Vision: JSON parse failed, using fallback",
    );

    // 降级处理：直接使用原始内容作为描述
    return {
      description: content.substring(0, 500),
      visualTags: [],
      imageType: "unknown",
    };
  }
}

/**
 * 验证图片 URL 是否有效
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 支持 http/https 和 data URL
    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "data:"
    );
  } catch {
    return false;
  }
}

/**
 * 从 HTML 或网页内容中提取图片 URL
 * 这是一个辅助函数，用于自动提取网页中的关键图片
 *
 * @param coverUrl - 封面图 URL
 * @param description - 页面描述（可能包含图片 URL）
 * @returns 图片 URL 数组
 */
export function extractImageUrls(
  coverUrl?: string | null,
  description?: string | null,
): string[] {
  const urls: string[] = [];

  // 优先使用封面图
  if (coverUrl && isValidImageUrl(coverUrl)) {
    urls.push(coverUrl);
  }

  // 从描述中提取图片 URL（简单的正则匹配）
  if (description) {
    const imgRegex = /https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp)/gi;
    const matches = description.match(imgRegex);
    if (matches) {
      matches.forEach((url) => {
        if (!urls.includes(url)) {
          urls.push(url);
        }
      });
    }
  }

  return urls.slice(0, 5); // 最多返回 5 张
}

/**
 * 检查视觉分析服务是否可用
 */
export function isVisionServiceAvailable(): boolean {
  return !!process.env.DASHSCOPE_API_KEY;
}

/**
 * 获取当前配置的模型信息
 */
export function getVisionModelInfo(): {
  available: boolean;
  model: string;
  timeout: number;
} {
  return {
    available: isVisionServiceAvailable(),
    model: DEFAULT_VISION_CONFIG.model,
    timeout: DEFAULT_VISION_CONFIG.timeout,
  };
}
