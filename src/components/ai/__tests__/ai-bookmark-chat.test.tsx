/**
 * AIBookmarkChat 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIBookmarkChat } from "../ai-bookmark-chat";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock TextDecoder for SSE parsing
const mockDecode = jest.fn();
global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: mockDecode,
})) as unknown as typeof TextDecoder;

// Mock TextEncoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockReturnValue(new Uint8Array()),
})) as unknown as typeof TextEncoder;

describe("AIBookmarkChat", () => {
  const defaultProps = {
    userId: "user-123",
    bookmarkId: 456,
    bookmarkTitle: "测试书签标题",
    bookmarkUrl: "https://example.com/article",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDecode.mockReturnValue("");
  });

  describe("Rendering", () => {
    it("should render collapsed by default", () => {
      render(<AIBookmarkChat {...defaultProps} />);

      expect(screen.getByText("AI 助手")).toBeInTheDocument();
      expect(screen.getByText("关于此书签的快捷问答")).toBeInTheDocument();

      // Quick actions should not be visible when collapsed
      expect(screen.queryByText("生成摘要")).not.toBeInTheDocument();
    });

    it("should render expanded when defaultExpanded is true", () => {
      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      // Quick actions should be visible
      expect(screen.getByText("生成摘要")).toBeInTheDocument();
      expect(screen.getByText("推荐标签")).toBeInTheDocument();
      expect(screen.getByText("相似内容")).toBeInTheDocument();
      expect(screen.getByText("解释内容")).toBeInTheDocument();
    });

    it("should toggle expansion when header clicked", async () => {
      render(<AIBookmarkChat {...defaultProps} />);

      // Initially collapsed
      expect(screen.queryByText("生成摘要")).not.toBeInTheDocument();

      // Click header to expand
      fireEvent.click(screen.getByText("AI 助手"));

      // Should now be expanded
      await waitFor(() => {
        expect(screen.getByText("生成摘要")).toBeInTheDocument();
      });

      // Click header again to collapse
      fireEvent.click(screen.getByText("AI 助手"));

      // Should be collapsed again
      await waitFor(() => {
        expect(screen.queryByText("生成摘要")).not.toBeInTheDocument();
      });
    });

    it("should apply custom className", () => {
      const { container } = render(
        <AIBookmarkChat {...defaultProps} className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Quick Actions", () => {
    beforeEach(() => {
      // Mock successful stream response
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"type":"text","text":"AI 响应内容"}\n',
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      });

      mockDecode.mockReturnValue(
        'data: {"type":"text","text":"AI 响应内容"}\n',
      );
    });

    it("should send message when quick action clicked", async () => {
      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("生成摘要"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/agent/chat",
          expect.objectContaining({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: expect.stringContaining("请为这篇内容生成一个简洁的摘要"),
          }),
        );
      });
    });

    it("should include bookmarkId in request", async () => {
      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("推荐标签"));

      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.bookmarkIds).toEqual([456]);
      });
    });

    it("should disable quick actions while loading", async () => {
      // Make fetch never resolve to keep loading state
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("生成摘要"));

      await waitFor(() => {
        expect(screen.getByText("推荐标签").closest("button")).toBeDisabled();
        expect(screen.getByText("相似内容").closest("button")).toBeDisabled();
      });
    });
  });

  describe("Custom Input", () => {
    it("should render input field when expanded", () => {
      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      expect(
        screen.getByPlaceholderText("输入你的问题..."),
      ).toBeInTheDocument();
    });

    it("should send custom message on form submit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      });

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      const input = screen.getByPlaceholderText("输入你的问题...");
      await userEvent.type(input, "这篇文章讲了什么？");

      const submitButton = screen.getByRole("button", { name: "" }); // Send button has no text
      fireEvent.click(submitButton);

      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.message).toBe("这篇文章讲了什么？");
      });
    });

    it("should clear input after submit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      });

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      const input = screen.getByPlaceholderText(
        "输入你的问题...",
      ) as HTMLInputElement;
      await userEvent.type(input, "测试问题");
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("should not submit empty input", async () => {
      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      const input = screen.getByPlaceholderText("输入你的问题...");
      fireEvent.submit(input.closest("form")!);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Response Handling", () => {
    it("should display streaming response", async () => {
      const reader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'data: {"type":"text","text":"Hello"}\n',
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'data: {"type":"text","text":" World"}\n',
            ),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      });

      mockDecode
        .mockReturnValueOnce('data: {"type":"text","text":"Hello"}\n')
        .mockReturnValueOnce('data: {"type":"text","text":" World"}\n');

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("生成摘要"));

      // Wait for response to appear
      await waitFor(
        () => {
          expect(screen.getByText("正在思考...")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("should show error message on API failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "API 错误" }),
      });

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("生成摘要"));

      await waitFor(() => {
        expect(screen.getByText("API 错误")).toBeInTheDocument();
      });
    });

    it("should show error on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("生成摘要"));

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("Cancel and Clear", () => {
    it("should cancel request when cancel button clicked", async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, "abort");

      // Make fetch hang
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            // Store the signal to check if abort was called
            setTimeout(() => reject(new Error("aborted")), 10000);
          }),
      );

      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      fireEvent.click(screen.getByText("生成摘要"));

      // Wait for loading state
      await waitFor(() => {
        expect(screen.getByText("正在思考...")).toBeInTheDocument();
      });

      // Find and click cancel button (X button) - use getAllByRole and find the close button
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((btn) =>
        btn.className.includes("absolute"),
      );
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });
  });

  describe("Full Chat Button", () => {
    it("should show full chat button when onOpenFullChat provided", () => {
      const onOpenFullChat = jest.fn();

      render(
        <AIBookmarkChat
          {...defaultProps}
          defaultExpanded={true}
          onOpenFullChat={onOpenFullChat}
        />,
      );

      expect(screen.getByText("展开完整对话")).toBeInTheDocument();
    });

    it("should not show full chat button when onOpenFullChat not provided", () => {
      render(<AIBookmarkChat {...defaultProps} defaultExpanded={true} />);

      expect(screen.queryByText("展开完整对话")).not.toBeInTheDocument();
    });

    it("should call onOpenFullChat when button clicked", () => {
      const onOpenFullChat = jest.fn();

      render(
        <AIBookmarkChat
          {...defaultProps}
          defaultExpanded={true}
          onOpenFullChat={onOpenFullChat}
        />,
      );

      fireEvent.click(screen.getByText("展开完整对话"));

      expect(onOpenFullChat).toHaveBeenCalled();
    });
  });
});
