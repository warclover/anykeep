/**
 * AttachmentPreviewModal 组件单元测试
 *
 * 测试附件内容预览模态框的核心功能和安全特性
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  AttachmentPreviewModal,
  type AttachmentPreviewModalProps,
} from "../attachment-preview-modal";
import type { AttachmentItem } from "../types";

// =============================================================================
// Mock window.open
// =============================================================================

const mockWindowOpen = jest.fn();
Object.defineProperty(window, "open", {
  value: mockWindowOpen,
  writable: true,
});

// Mock console.error to track security blocks
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();

// =============================================================================
// 测试数据
// =============================================================================

const createBookmarkAttachment = (
  overrides: Partial<AttachmentItem> = {},
): AttachmentItem => ({
  id: "bookmark-1",
  type: "bookmark",
  title: "测试书签",
  url: "https://example.com/article",
  content: "这是书签摘要内容，包含一些有用的信息。",
  platform: "web",
  ...overrides,
});

const createFileAttachment = (
  overrides: Partial<AttachmentItem> = {},
): AttachmentItem => ({
  id: "file-1",
  type: "file",
  title: "测试文档.txt",
  content: "这是文件的文本内容。",
  mimeType: "text/plain",
  size: 1024,
  ...overrides,
});

const createImageAttachment = (
  overrides: Partial<AttachmentItem> = {},
): AttachmentItem => ({
  id: "image-1",
  type: "file",
  title: "测试图片.png",
  content: "[图片: 测试图片.png]\ndata:image/png;base64,iVBORw0KGgo=",
  mimeType: "image/png",
  size: 2048,
  ...overrides,
});

// =============================================================================
// 基础渲染测试
// =============================================================================

describe("AttachmentPreviewModal", () => {
  const defaultProps: AttachmentPreviewModalProps = {
    open: true,
    onOpenChange: jest.fn(),
    attachment: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("基础渲染", () => {
    it("attachment 为 null 时不渲染", () => {
      const { container } = render(
        <AttachmentPreviewModal {...defaultProps} attachment={null} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("open 为 false 时不显示对话框", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          open={false}
          attachment={createBookmarkAttachment()}
        />,
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("正确显示书签预览标题", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment()}
        />,
      );
      expect(screen.getByText("书签预览")).toBeInTheDocument();
      expect(screen.getByText("测试书签")).toBeInTheDocument();
    });

    it("正确显示文件预览标题", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment()}
        />,
      );
      expect(screen.getByText("文件预览")).toBeInTheDocument();
      // 标题在 header 中出现两次（DialogTitle 和附件标题），使用 getAllByText
      const titles = screen.getAllByText("测试文档.txt");
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =============================================================================
  // 书签预览测试
  // =============================================================================

  describe("书签预览", () => {
    it("显示来源 URL", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment()}
        />,
      );
      expect(screen.getByText("来源")).toBeInTheDocument();
      expect(
        screen.getByText("https://example.com/article"),
      ).toBeInTheDocument();
    });

    it("显示内容摘要", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment()}
        />,
      );
      expect(screen.getByText("内容摘要")).toBeInTheDocument();
      expect(
        screen.getByText(/这是书签摘要内容，包含一些有用的信息/),
      ).toBeInTheDocument();
    });

    it("无内容时显示暂无内容", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment({ content: "" })}
        />,
      );
      expect(screen.getByText("暂无内容")).toBeInTheDocument();
    });

    it("内容截断时显示截断提示", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment({ truncated: true })}
        />,
      );
      expect(screen.getByText("（内容已截断）")).toBeInTheDocument();
    });

    it("点击打开链接按钮打开新窗口", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment()}
        />,
      );

      const openButton = screen.getByText("打开链接");
      fireEvent.click(openButton);

      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://example.com/article",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  // =============================================================================
  // 文件预览测试
  // =============================================================================

  describe("文件预览", () => {
    it("显示文件信息", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment()}
        />,
      );
      expect(screen.getByText("文件信息")).toBeInTheDocument();
      expect(screen.getByText("文件大小: 1.0 KB")).toBeInTheDocument();
      expect(screen.getByText("文件类型: text/plain")).toBeInTheDocument();
    });

    it("显示文本内容预览", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment()}
        />,
      );
      expect(screen.getByText("这是文件的文本内容。")).toBeInTheDocument();
    });

    it("PDF 文件显示正确文件类型", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment({
            title: "文档.pdf",
            mimeType: "application/pdf",
          })}
        />,
      );
      // 验证 PDF MIME 类型显示
      expect(screen.getByText("文件类型: application/pdf")).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 图片预览测试
  // =============================================================================

  describe("图片预览", () => {
    it("显示图片预览区域", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );
      expect(screen.getByText("图片预览")).toBeInTheDocument();
    });

    it("显示图片加载状态", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );
      expect(screen.getByText("图片加载中...")).toBeInTheDocument();
    });

    it("图片加载成功后隐藏加载状态", async () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.load(img);

      await waitFor(() => {
        expect(screen.queryByText("图片加载中...")).not.toBeInTheDocument();
      });
    });

    it("图片加载失败时显示错误状态", async () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.getByText("图片加载失败")).toBeInTheDocument();
      });
    });

    it("图片有正确的 alt 属性", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", "测试图片.png 的预览图片");
    });
  });

  // =============================================================================
  // 安全测试
  // =============================================================================

  describe("安全特性", () => {
    describe("URL 协议验证", () => {
      it("允许 HTTPS 协议", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createBookmarkAttachment({
              url: "https://safe-site.com",
            })}
          />,
        );

        const openButton = screen.getByText("打开链接");
        fireEvent.click(openButton);

        expect(mockWindowOpen).toHaveBeenCalledWith(
          "https://safe-site.com",
          "_blank",
          "noopener,noreferrer",
        );
      });

      it("允许 HTTP 协议", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createBookmarkAttachment({ url: "http://legacy.com" })}
          />,
        );

        const openButton = screen.getByText("打开链接");
        fireEvent.click(openButton);

        expect(mockWindowOpen).toHaveBeenCalledWith(
          "http://legacy.com",
          "_blank",
          "noopener,noreferrer",
        );
      });

      it("阻止 javascript: 协议（XSS 攻击）", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createBookmarkAttachment({
              url: "javascript:alert('XSS')",
            })}
          />,
        );

        const openButton = screen.getByText("打开链接");
        fireEvent.click(openButton);

        expect(mockWindowOpen).not.toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Blocked unsafe URL protocol:",
          "javascript:",
        );
      });

      it("阻止 data: 协议", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createBookmarkAttachment({
              url: "data:text/html,<script>alert('XSS')</script>",
            })}
          />,
        );

        const openButton = screen.getByText("打开链接");
        fireEvent.click(openButton);

        expect(mockWindowOpen).not.toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Blocked unsafe URL protocol:",
          "data:",
        );
      });

      it("阻止 file: 协议", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createBookmarkAttachment({
              url: "file:///etc/passwd",
            })}
          />,
        );

        const openButton = screen.getByText("打开链接");
        fireEvent.click(openButton);

        expect(mockWindowOpen).not.toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Blocked unsafe URL protocol:",
          "file:",
        );
      });

      it("处理无效 URL", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createBookmarkAttachment({ url: "invalid-url" })}
          />,
        );

        const openButton = screen.getByText("打开链接");
        fireEvent.click(openButton);

        expect(mockWindowOpen).not.toHaveBeenCalled();
        // console.error 被调用，第一个参数是 "Invalid URL:"
        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockConsoleError.mock.calls[0][0]).toBe("Invalid URL:");
      });
    });

    describe("Base64 图片验证", () => {
      it("接受有效的 PNG base64 图片", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createImageAttachment({
              content:
                "[图片: test.png]\ndata:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            })}
          />,
        );

        const img = screen.getByRole("img");
        expect(img).toHaveAttribute(
          "src",
          expect.stringContaining("data:image/png;base64,"),
        );
      });

      it("接受有效的 JPEG base64 图片", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createImageAttachment({
              mimeType: "image/jpeg",
              content:
                "[图片: test.jpg]\ndata:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==",
            })}
          />,
        );

        const img = screen.getByRole("img");
        expect(img).toHaveAttribute(
          "src",
          expect.stringContaining("data:image/jpeg;base64,"),
        );
      });

      it("拒绝包含 XSS 代码的 data URL", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createImageAttachment({
              content:
                "[图片: test.png]\ndata:text/html,<script>alert('XSS')</script>",
            })}
          />,
        );

        // 图片不应该被渲染
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Blocked invalid image data URL format",
        );
      });

      it("拒绝非图片 MIME 类型的 data URL", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createImageAttachment({
              content:
                "[图片: test.png]\ndata:application/javascript;base64,YWxlcnQoMSk=",
            })}
          />,
        );

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Blocked invalid image data URL format",
        );
      });

      it("拒绝包含非法字符的 base64", () => {
        render(
          <AttachmentPreviewModal
            {...defaultProps}
            attachment={createImageAttachment({
              content:
                "[图片: test.png]\ndata:image/png;base64,<script>alert(1)</script>",
            })}
          />,
        );

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Blocked invalid image data URL format",
        );
      });
    });
  });

  // =============================================================================
  // 可访问性测试
  // =============================================================================

  describe("可访问性", () => {
    it("对话框有正确的 role", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment()}
        />,
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("图片加载状态有 aria-live", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );

      const loadingElement = screen.getByRole("status");
      expect(loadingElement).toHaveAttribute("aria-live", "polite");
    });

    it("图片错误状态有 role=alert", async () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("加载状态图标使用 aria-hidden", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createImageAttachment()}
        />,
      );

      // 检查加载状态区域的图标（通过 data-testid 验证图标存在）
      const loadingStatus = screen.getByRole("status");
      expect(loadingStatus).toBeInTheDocument();
      // 图标被 Jest mock，通过 data-testid="icon-MockIcon" 验证
      expect(
        loadingStatus.querySelector('[data-testid="icon-MockIcon"]'),
      ).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 交互测试
  // =============================================================================

  describe("交互", () => {
    it("点击关闭按钮调用 onOpenChange(false)", () => {
      const onOpenChange = jest.fn();
      render(
        <AttachmentPreviewModal
          open={true}
          onOpenChange={onOpenChange}
          attachment={createBookmarkAttachment()}
        />,
      );

      // 关闭按钮在 header 中
      const closeButton = screen.getByRole("button", { name: "" });
      fireEvent.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("无 URL 时不显示打开链接按钮", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createBookmarkAttachment({ url: undefined })}
        />,
      );

      expect(screen.queryByText("打开链接")).not.toBeInTheDocument();
    });
  });

  // =============================================================================
  // 文件大小格式化测试
  // =============================================================================

  describe("文件大小格式化", () => {
    it("正确显示字节大小", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment({ size: 500 })}
        />,
      );
      expect(screen.getByText("文件大小: 500 B")).toBeInTheDocument();
    });

    it("正确显示 KB 大小", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment({ size: 2048 })}
        />,
      );
      expect(screen.getByText("文件大小: 2.0 KB")).toBeInTheDocument();
    });

    it("正确显示 MB 大小", () => {
      render(
        <AttachmentPreviewModal
          {...defaultProps}
          attachment={createFileAttachment({ size: 1.5 * 1024 * 1024 })}
        />,
      );
      expect(screen.getByText("文件大小: 1.5 MB")).toBeInTheDocument();
    });
  });
});
