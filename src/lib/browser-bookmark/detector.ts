/**
 * 浏览器来源检测器
 * 自动检测书签文件来自哪个浏览器
 */

import type { BrowserSource } from "./types";
import {
  CHROME_SIGNATURES,
  EDGE_SIGNATURES,
  FIREFOX_SIGNATURES,
  SAFARI_SIGNATURES,
} from "./constants";

/**
 * 检测浏览器来源
 * 策略优先级: 1. 文件名 → 2. HTML 内容特征 → 3. unknown
 *
 * @param fileName 文件名
 * @param htmlContent HTML 内容
 * @returns 浏览器来源
 */
export function detectBrowserSource(
  fileName: string,
  htmlContent: string,
): BrowserSource {
  // 策略 1: 根据文件名检测
  const sourceFromFileName = detectFromFileName(fileName);
  if (sourceFromFileName !== "unknown") {
    return sourceFromFileName;
  }

  // 策略 2: 根据 HTML 内容特征检测
  return detectFromContent(htmlContent);
}

/**
 * 根据文件名检测浏览器来源
 */
function detectFromFileName(fileName: string): BrowserSource {
  const lowerName = fileName.toLowerCase();

  // Chrome 检测
  if (
    CHROME_SIGNATURES.fileNamePatterns.some((pattern) =>
      lowerName.includes(pattern),
    )
  ) {
    return "chrome";
  }

  // Edge 检测
  if (
    EDGE_SIGNATURES.fileNamePatterns.some((pattern) =>
      lowerName.includes(pattern),
    )
  ) {
    return "edge";
  }

  // Firefox 检测
  if (
    FIREFOX_SIGNATURES.fileNamePatterns.some((pattern) =>
      lowerName.includes(pattern),
    )
  ) {
    return "firefox";
  }

  // Safari 检测
  if (
    SAFARI_SIGNATURES.fileNamePatterns.some((pattern) =>
      lowerName.includes(pattern),
    )
  ) {
    return "safari";
  }

  return "unknown";
}

/**
 * 根据 HTML 内容检测浏览器来源
 */
function detectFromContent(htmlContent: string): BrowserSource {
  // Chrome 特征
  if (
    CHROME_SIGNATURES.contentPatterns.some((pattern) =>
      htmlContent.includes(pattern),
    )
  ) {
    return "chrome";
  }

  // Edge 特征
  if (
    EDGE_SIGNATURES.contentPatterns.some((pattern) =>
      htmlContent.includes(pattern),
    )
  ) {
    return "edge";
  }

  // Firefox 特征
  if (
    FIREFOX_SIGNATURES.contentPatterns.some((pattern) =>
      htmlContent.includes(pattern),
    )
  ) {
    return "firefox";
  }

  // Safari 特征
  if (
    SAFARI_SIGNATURES.contentPatterns.some((pattern) =>
      htmlContent.includes(pattern),
    )
  ) {
    return "safari";
  }

  return "unknown";
}

/**
 * 获取浏览器来源的显示名称
 */
export function getBrowserSourceName(source: BrowserSource): string {
  const names: Record<BrowserSource, string> = {
    chrome: "Google Chrome",
    edge: "Microsoft Edge",
    firefox: "Mozilla Firefox",
    safari: "Apple Safari",
    unknown: "未知浏览器",
  };
  return names[source];
}

/**
 * 获取所有支持的浏览器来源
 */
export function getSupportedBrowserSources(): BrowserSource[] {
  return ["chrome", "edge", "firefox", "safari"];
}
