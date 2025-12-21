/**
 * 微信文章 PDF 导出器
 *
 * @module wechat-article/export
 * @description 将微信文章导出为 PDF 格式
 *
 * Phase 6 升级：导出功能
 *
 * 注意：需要安装 puppeteer 依赖
 * npm install puppeteer
 */

import type { WechatArticleContent } from "../wechat-article.types";

// =============================================================================
// 类型定义
// =============================================================================

export interface PdfExportOptions {
  /** 页面格式 */
  format?: "A4" | "Letter";
  /** 页边距 */
  margin?: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  /** 包含页眉 */
  includeHeader?: boolean;
  /** 包含页脚（页码） */
  includeFooter?: boolean;
  /** 缩放比例 */
  scale?: number;
}

export interface PdfExportResult {
  /** PDF 数据 */
  buffer: Buffer;
  /** 推荐文件名 */
  filename: string;
}

export interface ArticleMetadata {
  /** 标题 */
  title: string;
  /** 作者 */
  author?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 原始 URL */
  originalUrl: string;
}

// =============================================================================
// HTML 模板
// =============================================================================

/**
 * 生成 PDF 用的完整 HTML 页面
 */
function generatePdfHtml(
  content: WechatArticleContent,
  metadata: ArticleMetadata,
  options: { includeHeader: boolean },
): string {
  const headerHtml = options.includeHeader
    ? `
    <div class="header">
      <h1>${escapeHtml(metadata.title)}</h1>
      <div class="meta">
        <span>作者: ${escapeHtml(metadata.author || "未知")}</span>
        <span> | </span>
        <span>来源: 微信公众号</span>
        <span> | </span>
        <span>保存时间: ${new Date().toLocaleDateString("zh-CN")}</span>
      </div>
    </div>
  `
    : "";

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
                   'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
    }

    .header {
      border-bottom: 1px solid #eee;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 10px 0;
      line-height: 1.4;
      color: #1a1a1a;
    }

    .header .meta {
      color: #666;
      font-size: 12px;
    }

    .content {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 16px auto;
      border-radius: 4px;
    }

    .content p {
      margin: 1em 0;
    }

    .content h1, .content h2, .content h3,
    .content h4, .content h5, .content h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.4;
    }

    .content h1 { font-size: 1.8em; }
    .content h2 { font-size: 1.5em; }
    .content h3 { font-size: 1.3em; }
    .content h4 { font-size: 1.1em; }

    .content blockquote {
      margin: 1em 0;
      padding: 10px 20px;
      border-left: 4px solid #ddd;
      background: #f9f9f9;
      color: #555;
    }

    .content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }

    .content pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }

    .content pre code {
      background: none;
      padding: 0;
    }

    .content a {
      color: #0066cc;
      text-decoration: none;
    }

    .content ul, .content ol {
      padding-left: 2em;
      margin: 1em 0;
    }

    .content li {
      margin: 0.5em 0;
    }

    /* 媒体占位样式 */
    .wechat-video-placeholder,
    .wechat-audio-placeholder,
    .wechat-iframe-placeholder {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }

    .wechat-video-placeholder .video-cover {
      aspect-ratio: 16 / 9;
      background: #e0e0e0;
      border-radius: 4px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wechat-video-placeholder .video-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      margin: 0;
    }

    .wechat-video-placeholder .play-icon {
      font-size: 48px;
      color: #999;
    }

    .wechat-video-placeholder .video-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .wechat-audio-placeholder {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .wechat-audio-placeholder .audio-icon {
      font-size: 24px;
    }

    /* 打印样式 */
    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      .header {
        page-break-after: avoid;
      }

      img {
        page-break-inside: avoid;
      }

      .wechat-video-placeholder,
      .wechat-audio-placeholder {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="content">
    ${content.html}
  </div>
</body>
</html>
  `.trim();
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================================
// 主导出函数
// =============================================================================

/**
 * 导出微信文章为 PDF
 *
 * 注意：此函数需要在 Node.js 环境中运行（API Route），不能在 Edge Function 中使用
 */
export async function exportToPdf(
  content: WechatArticleContent,
  metadata: ArticleMetadata,
  options: PdfExportOptions = {},
): Promise<PdfExportResult> {
  const {
    format = "A4",
    margin = { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    includeHeader = true,
    includeFooter = true,
    scale = 1,
  } = options;

  // 动态导入 puppeteer（避免在不支持的环境中报错）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  try {
    // @ts-expect-error - puppeteer 是可选依赖，可能未安装
    puppeteer = await import("puppeteer");
  } catch {
    throw new Error("Puppeteer is not installed. Run: npm install puppeteer");
  }

  // 生成完整 HTML
  const fullHtml = generatePdfHtml(content, metadata, { includeHeader });

  // 启动浏览器
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // 设置内容
    await page.setContent(fullHtml, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // 等待图片加载
    await page
      .waitForFunction(
        () => {
          const images = document.querySelectorAll("img");
          return Array.from(images).every((img) => img.complete);
        },
        { timeout: 15000 },
      )
      .catch(() => {
        // 图片加载超时，继续生成 PDF
        console.error("[PdfExporter] Some images failed to load");
      });

    // 生成 PDF
    const pdf = await page.pdf({
      format,
      margin,
      scale,
      printBackground: true,
      displayHeaderFooter: includeFooter,
      headerTemplate: includeHeader
        ? `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666; padding: 5px 0;">
          ${escapeHtml(metadata.title)}
        </div>
      `
        : "<span></span>",
      footerTemplate: includeFooter
        ? `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666; padding: 5px 0;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
        : "<span></span>",
    });

    // 生成安全文件名
    const safeTitle = metadata.title
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
    const filename = `${safeTitle}.pdf`;

    return {
      buffer: Buffer.from(pdf),
      filename,
    };
  } finally {
    await browser.close();
  }
}

/**
 * 检查 Puppeteer 是否可用
 */
export async function isPuppeteerAvailable(): Promise<boolean> {
  try {
    // @ts-expect-error - puppeteer 是可选依赖，可能未安装
    await import("puppeteer");
    return true;
  } catch {
    return false;
  }
}
