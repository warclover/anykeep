/**
 * 阅读时长计算工具
 * 基于中文阅读速度约 400-600 字/分钟
 */

/**
 * 计算预估阅读时长
 * @param wordCount 字数
 * @param hasImages 是否包含图片（图片会增加阅读时间）
 * @param imageCount 图片数量
 * @returns 格式化的阅读时长字符串
 */
export function calculateReadingTime(
  wordCount: number | null | undefined,
  hasImages: boolean = false,
  imageCount: number = 0,
): string | null {
  if (!wordCount || wordCount <= 0) return null;

  // 中文阅读速度：约 500 字/分钟
  const wordsPerMinute = 500;

  // 每张图片额外增加 12 秒阅读时间
  const secondsPerImage = 12;

  // 计算文字阅读时间（分钟）
  let minutes = wordCount / wordsPerMinute;

  // 加上图片阅读时间
  if (hasImages && imageCount > 0) {
    minutes += (imageCount * secondsPerImage) / 60;
  }

  // 向上取整，最少 1 分钟
  const roundedMinutes = Math.max(1, Math.ceil(minutes));

  if (roundedMinutes < 60) {
    return `${roundedMinutes}分钟`;
  } else {
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    return remainingMinutes > 0
      ? `${hours}小时${remainingMinutes}分钟`
      : `${hours}小时`;
  }
}

/**
 * 获取内容类型标签
 * @param wordCount 字数
 * @param imageCount 图片数量
 * @param platform 平台类型
 * @returns 内容类型描述
 */
export function getContentTypeLabel(
  wordCount: number | null | undefined,
  imageCount: number | null | undefined,
  platform?: string,
): string {
  // 视频平台
  if (platform === "BILIBILI") {
    return "视频";
  }

  // 小红书以图文为主
  if (platform === "XIAOHONGSHU") {
    if ((imageCount ?? 0) >= 5) return "图文";
    return "笔记";
  }

  // 根据字数判断
  const words = wordCount ?? 0;
  const images = imageCount ?? 0;

  if (words < 500 && images >= 3) return "图文";
  if (words < 1000) return "短文";
  if (words < 3000) return "文章";
  if (words < 8000) return "长文";
  return "深度";
}
