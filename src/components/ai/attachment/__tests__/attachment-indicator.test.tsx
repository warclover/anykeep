/**
 * AttachmentIndicator 组件单元测试
 *
 * 测试附件指示器组件的渲染和交互
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AttachmentIndicator,
  type AttachmentIndicatorProps,
} from "../attachment-indicator";
import type { AttachmentItem } from "../types";

// =============================================================================
// 测试数据
// =============================================================================

const createMockAttachments = (): AttachmentItem[] => [
  {
    id: "bookmark-1",
    type: "bookmark",
    title: "测试书签",
    url: "https://example.com",
    content: "书签内容",
  },
  {
    id: "file-1",
    type: "file",
    title: "测试文件.txt",
    mimeType: "text/plain",
    size: 1024,
    content: "文件内容",
  },
];

// =============================================================================
// 测试套件
// =============================================================================

describe("AttachmentIndicator", () => {
  const defaultProps: AttachmentIndicatorProps = {
    items: [],
    onClear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 基础渲染测试
  // =============================================================================

  describe("基础渲染", () => {
    it("没有附件时不渲染", () => {
      const { container } = render(<AttachmentIndicator {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it("有附件时正确渲染容器", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );
      expect(screen.getByRole("region")).toBeInTheDocument();
    });

    it("显示正确的 aria-label", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );
      expect(
        screen.getByRole("region", { name: "已选附件：2 个" }),
      ).toBeInTheDocument();
    });

    it("显示附件前缀文本", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );
      expect(screen.getByText("附件:")).toBeInTheDocument();
    });

    it("显示所有附件标题", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );
      expect(screen.getByText("测试书签")).toBeInTheDocument();
      expect(screen.getByText("测试文件.txt")).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 附件标签样式测试
  // =============================================================================

  describe("附件标签样式", () => {
    it("书签类型使用粉色样式", () => {
      const bookmarkOnly: AttachmentItem[] = [
        {
          id: "bookmark-1",
          type: "bookmark",
          title: "测试书签",
          url: "https://example.com",
        },
      ];

      render(<AttachmentIndicator {...defaultProps} items={bookmarkOnly} />);

      const tag = screen.getByText("测试书签").closest("div");
      expect(tag).toHaveClass("bg-pink-100", "text-pink-700");
    });

    it("文件类型使用蓝色样式", () => {
      const fileOnly: AttachmentItem[] = [
        {
          id: "file-1",
          type: "file",
          title: "测试文件.txt",
          mimeType: "text/plain",
          size: 1024,
        },
      ];

      render(<AttachmentIndicator {...defaultProps} items={fileOnly} />);

      const tag = screen.getByText("测试文件.txt").closest("div");
      expect(tag).toHaveClass("bg-blue-100", "text-blue-700");
    });
  });

  // =============================================================================
  // 交互测试
  // =============================================================================

  describe("交互", () => {
    it("点击清除按钮调用 onClear", () => {
      const onClear = jest.fn();
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onClear={onClear}
        />,
      );

      const clearButton = screen.getByRole("button", { name: "清除" });
      fireEvent.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("点击展开按钮调用 onExpand", () => {
      const onExpand = jest.fn();
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onExpand={onExpand}
        />,
      );

      const expandButton = screen.getByRole("button", { name: "展开附件面板" });
      fireEvent.click(expandButton);

      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("点击附件标题调用 onPreview", () => {
      const onPreview = jest.fn();
      const items = createMockAttachments();

      render(
        <AttachmentIndicator
          {...defaultProps}
          items={items}
          onPreview={onPreview}
        />,
      );

      // 标题按钮和预览图标按钮都有相同的 aria-label，使用 getAllByRole 获取第一个
      const previewButtons = screen.getAllByRole("button", {
        name: "预览书签：测试书签",
      });
      fireEvent.click(previewButtons[0]);

      expect(onPreview).toHaveBeenCalledWith(items[0]);
    });

    it("点击预览图标调用 onPreview", () => {
      const onPreview = jest.fn();
      const items = createMockAttachments();

      render(
        <AttachmentIndicator
          {...defaultProps}
          items={items}
          onPreview={onPreview}
        />,
      );

      // 获取第一个书签的预览图标按钮（第二个带有预览 aria-label 的按钮）
      const previewButtons = screen.getAllByTitle("预览");
      fireEvent.click(previewButtons[0]);

      expect(onPreview).toHaveBeenCalledWith(items[0]);
    });

    it("点击移除按钮调用 onRemove", () => {
      const onRemove = jest.fn();
      const items = createMockAttachments();

      render(
        <AttachmentIndicator
          {...defaultProps}
          items={items}
          onRemove={onRemove}
        />,
      );

      const removeButtons = screen.getAllByTitle("移除");
      fireEvent.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalledWith("bookmark-1");
    });
  });

  // =============================================================================
  // 可选回调测试
  // =============================================================================

  describe("可选回调处理", () => {
    it("没有 onExpand 时展开按钮使用默认光标", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );

      const expandButton = screen.getByRole("button", { name: "展开附件面板" });
      expect(expandButton).toHaveClass("cursor-default");
    });

    it("有 onExpand 时展开按钮使用指针光标", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onExpand={jest.fn()}
        />,
      );

      const expandButton = screen.getByRole("button", { name: "展开附件面板" });
      expect(expandButton).toHaveClass("cursor-pointer");
    });

    it("没有 onPreview 时标题不显示下划线效果", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );

      // 使用 title 属性来获取标题按钮，因为 aria-label 可能重复
      const titleButton = screen.getByTitle("点击预览: 测试书签");
      expect(titleButton).toHaveClass("cursor-default");
      expect(titleButton).not.toHaveClass("hover:underline");
    });

    it("有 onPreview 时标题显示下划线效果", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onPreview={jest.fn()}
        />,
      );

      const titleButton = screen.getByTitle("点击预览: 测试书签");
      expect(titleButton).toHaveClass("cursor-pointer", "hover:underline");
    });

    it("没有 onPreview 时不显示预览图标", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );

      expect(screen.queryByTitle("预览")).not.toBeInTheDocument();
    });

    it("没有 onRemove 时不显示移除按钮", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );

      expect(screen.queryByTitle("移除")).not.toBeInTheDocument();
    });
  });

  // =============================================================================
  // 可访问性测试
  // =============================================================================

  describe("可访问性", () => {
    it("附件列表有正确的 role", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );

      expect(
        screen.getByRole("list", { name: "附件列表" }),
      ).toBeInTheDocument();
    });

    it("每个附件标签有正确的 role", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
        />,
      );

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(2);
    });

    it("预览按钮有正确的 aria-label", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onPreview={jest.fn()}
        />,
      );

      // 使用 getAllByRole 因为有多个按钮共享相同的 aria-label
      const bookmarkPreviewButtons = screen.getAllByRole("button", {
        name: "预览书签：测试书签",
      });
      expect(bookmarkPreviewButtons.length).toBeGreaterThanOrEqual(1);

      const filePreviewButtons = screen.getAllByRole("button", {
        name: "预览文件：测试文件.txt",
      });
      expect(filePreviewButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("移除按钮有正确的 aria-label", () => {
      render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onRemove={jest.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "移除书签：测试书签" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "移除文件：测试文件.txt" }),
      ).toBeInTheDocument();
    });

    it("图标有 aria-hidden 属性", () => {
      const { container } = render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          onPreview={jest.fn()}
          onRemove={jest.fn()}
        />,
      );

      const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // 自定义类名测试
  // =============================================================================

  describe("自定义样式", () => {
    it("接受自定义 className", () => {
      const { container } = render(
        <AttachmentIndicator
          {...defaultProps}
          items={createMockAttachments()}
          className="custom-class"
        />,
      );

      const region = container.querySelector(".custom-class");
      expect(region).toBeInTheDocument();
    });
  });

  // =============================================================================
  // 边界条件测试
  // =============================================================================

  describe("边界条件", () => {
    it("单个附件正确渲染", () => {
      const singleItem: AttachmentItem[] = [
        {
          id: "single-1",
          type: "bookmark",
          title: "单个书签",
          url: "https://example.com",
        },
      ];

      render(<AttachmentIndicator {...defaultProps} items={singleItem} />);

      expect(
        screen.getByRole("region", { name: "已选附件：1 个" }),
      ).toBeInTheDocument();
      expect(screen.getByText("单个书签")).toBeInTheDocument();
    });

    it("长标题正确截断", () => {
      const longTitleItem: AttachmentItem[] = [
        {
          id: "long-1",
          type: "bookmark",
          title: "这是一个非常非常非常非常非常非常长的标题需要被截断显示",
          url: "https://example.com",
        },
      ];

      render(<AttachmentIndicator {...defaultProps} items={longTitleItem} />);

      const titleButton = screen.getByRole("button", {
        name: /预览书签/,
      });
      expect(titleButton).toHaveClass("truncate", "max-w-[120px]");
    });
  });
});
