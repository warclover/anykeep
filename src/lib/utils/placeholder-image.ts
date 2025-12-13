/**
 * 占位符图片生成工具
 * 用于 Week 1 在没有真实封面图时生成占位符
 */

import type { Platform } from "@/types/supabase";
import { getPlatformHexColor } from "@/lib/constants/platforms";

/**
 * 生成渐变背景的 SVG 占位符
 * @param title 标题文本（用于提取首字母）
 * @param platform 平台类型（用于颜色）
 * @returns Data URL 格式的 SVG 图片
 */
export function generatePlaceholderImage(
  title: string,
  platform: Platform,
): string {
  // 防御性编码：处理 title 为空或 undefined 的情况
  const firstChar = (title || "?").charAt(0).toUpperCase();
  const color = getPlatformHexColor(platform);

  // 生成浅色版本作为渐变起点
  const lightColor = lightenColor(color, 30);

  const svg = `
    <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${lightColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill="url(#grad)"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="80"
        font-weight="600"
        fill="white"
        opacity="0.9"
      >${firstChar}</text>
    </svg>
  `;

  // 转换为 Data URL
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

/**
 * 辅助函数：使颜色变浅
 */
function lightenColor(hex: string, percent: number): string {
  // 移除 # 号
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) + Math.round(((255 - (num >> 16)) * percent) / 100);
  const g =
    ((num >> 8) & 0x00ff) +
    Math.round(((255 - ((num >> 8) & 0x00ff)) * percent) / 100);
  const b =
    (num & 0x0000ff) + Math.round(((255 - (num & 0x0000ff)) * percent) / 100);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
