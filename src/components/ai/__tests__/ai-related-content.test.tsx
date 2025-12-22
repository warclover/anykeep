/**
 * AIRelatedContent 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AIRelatedContent } from "../ai-related-content";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AIRelatedContent", () => {
  const defaultProps = {
    bookmarkId: 123,
    bookmarkTitle: "测试书签",
  };

  const mockRelatedItems = [
    {
      id: 1,
      title: "相关书签 1",
      url: "https://example.com/1",
      description: "这是第一个相关书签",
      similarity: 0.85,
      platform: "wechat",
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: "相关书签 2",
      url: "https://example.com/2",
      description: "这是第二个相关书签",
      similarity: 0.72,
      platform: "zhihu",
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1天前
    },
    {
      id: 3,
      title: "相关书签 3",
      url: "https://example.com/3",
      description: null,
      similarity: 0.65,
      platform: "bilibili",
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), // 7天前
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            related: mockRelatedItems,
          },
        }),
    });
  });

  it("should render loading state initially", () => {
    render(<AIRelatedContent {...defaultProps} />);

    // Should show skeleton loaders
    expect(screen.getByText("相关内容")).toBeInTheDocument();
    expect(screen.getByText("AI 推荐的相似收藏")).toBeInTheDocument();
  });

  it("should fetch and display related items", async () => {
    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("相关书签 1")).toBeInTheDocument();
    });

    expect(screen.getByText("相关书签 2")).toBeInTheDocument();
    expect(screen.getByText("相关书签 3")).toBeInTheDocument();
  });

  it("should call API with correct parameters", async () => {
    render(<AIRelatedContent {...defaultProps} maxItems={10} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall).toContain("/api/bookmarks/123/related");
    expect(fetchCall).toContain("limit=10");
    expect(fetchCall).toContain("minSimilarity=0.3");
  });

  it("should display similarity percentage", async () => {
    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("should format dates correctly", async () => {
    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("今天")).toBeInTheDocument();
    });

    expect(screen.getByText("昨天")).toBeInTheDocument();
    expect(screen.getByText("1周前")).toBeInTheDocument();
  });

  it("should show empty state when no related items", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            related: [],
          },
        }),
    });

    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("暂未找到相关内容")).toBeInTheDocument();
    });

    expect(
      screen.getByText("收藏更多内容后，AI 将为你推荐相似文章"),
    ).toBeInTheDocument();
  });

  it("should show error state on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          success: false,
          error: { message: "获取相关内容失败" },
        }),
    });

    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("获取相关内容失败")).toBeInTheDocument();
    });
  });

  it("should handle network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("should refresh content when refresh button clicked", async () => {
    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("相关书签 1")).toBeInTheDocument();
    });

    // Clear previous calls
    mockFetch.mockClear();

    // Click refresh button
    const refreshButton = screen.getByRole("button");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("should call onBookmarkClick when item clicked", async () => {
    const onBookmarkClick = jest.fn();

    render(
      <AIRelatedContent {...defaultProps} onBookmarkClick={onBookmarkClick} />,
    );

    await waitFor(() => {
      expect(screen.getByText("相关书签 1")).toBeInTheDocument();
    });

    // Click on a related item
    fireEvent.click(screen.getByText("相关书签 1"));

    expect(onBookmarkClick).toHaveBeenCalledWith(1);
  });

  it("should limit displayed items based on maxItems prop", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            related: mockRelatedItems,
          },
        }),
    });

    render(<AIRelatedContent {...defaultProps} maxItems={2} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall).toContain("limit=2");
  });

  it("should show view more button when items reach maxItems", async () => {
    // Return exactly maxItems items
    const fiveItems = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `相关书签 ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      description: null,
      similarity: 0.8 - i * 0.05,
      platform: "wechat",
      createdAt: new Date().toISOString(),
    }));

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { related: fiveItems },
        }),
    });

    render(<AIRelatedContent {...defaultProps} maxItems={5} />);

    await waitFor(() => {
      expect(screen.getByText("查看更多相关内容")).toBeInTheDocument();
    });
  });

  it("should apply custom className", () => {
    const { container } = render(
      <AIRelatedContent {...defaultProps} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should display item descriptions when available", async () => {
    render(<AIRelatedContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("这是第一个相关书签")).toBeInTheDocument();
    });

    expect(screen.getByText("这是第二个相关书签")).toBeInTheDocument();
  });
});
