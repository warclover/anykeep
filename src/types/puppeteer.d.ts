/**
 * Puppeteer 类型声明（可选依赖）
 *
 * puppeteer 是可选依赖，仅在 PDF 导出功能中使用。
 * 此声明文件避免 TypeScript 编译错误。
 *
 * @see https://pptr.dev/
 */
declare module "puppeteer" {
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    setContent(
      html: string,
      options?: { waitUntil?: string; timeout?: number },
    ): Promise<void>;
    pdf(options?: PDFOptions): Promise<Buffer>;
    close(): Promise<void>;
  }

  export interface PDFOptions {
    format?: "A4" | "Letter" | "Legal" | string;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  }

  export interface LaunchOptions {
    headless?: boolean | "new";
    args?: string[];
  }

  const puppeteer: {
    default: {
      launch(options?: LaunchOptions): Promise<Browser>;
    };
  };

  export default puppeteer;
}
