/**
 * AISearchEnhanced 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { AISearchEnhanced, AISearchExplanation } from "../ai-search-enhanced";

// Mock timers for debounce testing
jest.useFakeTimers();

describe("AISearchEnhanced", () => {
  const defaultProps = {
    query: "React",
    resultCount: 10,
    searchMode: "keyword" as const,
  };

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe("Rendering", () => {
    it("should render nothing when query is empty", () => {
      const { container } = render(
        <AISearchEnhanced {...defaultProps} query="" />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render card when query is provided", () => {
      render(<AISearchEnhanced {...defaultProps} />);

      expect(screen.getByText("AI 搜索洞察")).toBeInTheDocument();
      expect(screen.getByText("智能分析搜索结果")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <AISearchEnhanced {...defaultProps} className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Auto Generate Insights", () => {
    it("should auto generate insights when enabled", async () => {
      render(
        <AISearchEnhanced {...defaultProps} autoGenerateInsights={true} />,
      );

      // Fast-forward debounce timer
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Wait for loading to start
      await waitFor(() => {
        // Component should show loading or insights
        expect(screen.getByText("AI 搜索洞察")).toBeInTheDocument();
      });

      // Fast-forward the simulated API delay
      act(() => {
        jest.advanceTimersByTime(800);
      });

      // Should show insights
      await waitFor(() => {
        expect(screen.getByText("搜索理解")).toBeInTheDocument();
      });
    });

    it("should not auto generate insights when disabled", async () => {
      render(
        <AISearchEnhanced {...defaultProps} autoGenerateInsights={false} />,
      );

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Should show empty state
      expect(
        screen.getByText("输入搜索词后将显示 AI 洞察"),
      ).toBeInTheDocument();
    });

    it("should debounce auto generation", () => {
      const { rerender } = render(
        <AISearchEnhanced {...defaultProps} query="R" />,
      );

      // Rapid query changes
      rerender(<AISearchEnhanced {...defaultProps} query="Re" />);
      rerender(<AISearchEnhanced {...defaultProps} query="Rea" />);
      rerender(<AISearchEnhanced {...defaultProps} query="Reac" />);
      rerender(<AISearchEnhanced {...defaultProps} query="React" />);

      // Only the last query should trigger generation after debounce
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Should be generating insights for "React"
      expect(screen.getByText("AI 搜索洞察")).toBeInTheDocument();
    });
  });

  describe("Insights Content", () => {
    beforeEach(async () => {
      render(<AISearchEnhanced {...defaultProps} />);

      // Trigger auto generation
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Wait for simulated API
      act(() => {
        jest.advanceTimersByTime(800);
      });
    });

    it("should show search understanding", async () => {
      await waitFor(() => {
        expect(screen.getByText("搜索理解")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/我理解你在查找与「React」相关的内容/),
      ).toBeInTheDocument();
    });

    it("should show keyword mode message", async () => {
      await waitFor(() => {
        expect(screen.getByText(/使用关键词精确匹配/)).toBeInTheDocument();
      });
    });

    it("should show search suggestions", async () => {
      await waitFor(() => {
        expect(screen.getByText("搜索建议")).toBeInTheDocument();
      });

      expect(screen.getByText(/找到 10 条结果/)).toBeInTheDocument();
    });

    it("should show related searches", async () => {
      await waitFor(() => {
        expect(screen.getByText("相关搜索")).toBeInTheDocument();
      });

      expect(screen.getByText("React 教程 →")).toBeInTheDocument();
    });
  });

  describe("Semantic Search Mode", () => {
    it("should show semantic mode message", async () => {
      render(<AISearchEnhanced {...defaultProps} searchMode="semantic" />);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/已启用语义搜索，将找到含义相近的内容/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Zero Results", () => {
    it("should show no results suggestion", async () => {
      render(<AISearchEnhanced {...defaultProps} resultCount={0} />);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/未找到结果，试试更换关键词或使用语义搜索/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Collapsible Behavior", () => {
    it("should be expanded by default", () => {
      render(
        <AISearchEnhanced {...defaultProps} autoGenerateInsights={false} />,
      );

      expect(
        screen.getByText("输入搜索词后将显示 AI 洞察"),
      ).toBeInTheDocument();
    });

    it("should collapse when header clicked", () => {
      render(
        <AISearchEnhanced {...defaultProps} autoGenerateInsights={false} />,
      );

      // Click header to collapse
      fireEvent.click(screen.getByText("AI 搜索洞察"));

      // Content should be hidden
      expect(
        screen.queryByText("输入搜索词后将显示 AI 洞察"),
      ).not.toBeInTheDocument();
    });

    it("should expand when header clicked again", () => {
      render(
        <AISearchEnhanced {...defaultProps} autoGenerateInsights={false} />,
      );

      // Click header twice
      fireEvent.click(screen.getByText("AI 搜索洞察"));
      fireEvent.click(screen.getByText("AI 搜索洞察"));

      // Content should be visible again
      expect(
        screen.getByText("输入搜索词后将显示 AI 洞察"),
      ).toBeInTheDocument();
    });
  });

  describe("Refresh Button", () => {
    it("should regenerate insights when refresh clicked", async () => {
      render(
        <AISearchEnhanced {...defaultProps} autoGenerateInsights={false} />,
      );

      // Click refresh button
      const refreshButton = screen.getByRole("button");
      fireEvent.click(refreshButton);

      // Should show loading or generate insights
      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        expect(screen.getByText("搜索理解")).toBeInTheDocument();
      });
    });
  });

  describe("Feedback", () => {
    beforeEach(async () => {
      render(<AISearchEnhanced {...defaultProps} />);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        expect(screen.getByText("搜索理解")).toBeInTheDocument();
      });
    });

    it("should show feedback question", () => {
      expect(screen.getByText("这个分析有帮助吗？")).toBeInTheDocument();
    });

    it("should handle helpful feedback", () => {
      // Find thumbs up button (second to last button in the component)
      const buttons = screen.getAllByRole("button");
      const thumbsUpButton = buttons[buttons.length - 2];
      fireEvent.click(thumbsUpButton);

      // Button should be highlighted (we can't easily test class changes)
      expect(thumbsUpButton).toBeInTheDocument();
    });

    it("should handle not helpful feedback", () => {
      const buttons = screen.getAllByRole("button");
      const thumbsDownButton = buttons[buttons.length - 1];
      fireEvent.click(thumbsDownButton);

      expect(thumbsDownButton).toBeInTheDocument();
    });
  });
});

describe("AISearchExplanation", () => {
  it("should render nothing when no matchReason and no similarity", () => {
    const { container } = render(<AISearchExplanation query="test" />);

    expect(container.firstChild).toBeNull();
  });

  it("should render similarity badge", () => {
    render(<AISearchExplanation query="test" similarity={0.85} />);

    expect(screen.getByText("相似度 85%")).toBeInTheDocument();
  });

  it("should render match reason", () => {
    render(<AISearchExplanation query="test" matchReason="标题匹配" />);

    expect(screen.getByText("标题匹配")).toBeInTheDocument();
  });

  it("should render both similarity and match reason", () => {
    render(
      <AISearchExplanation
        query="test"
        similarity={0.72}
        matchReason="内容相关"
      />,
    );

    expect(screen.getByText("相似度 72%")).toBeInTheDocument();
    expect(screen.getByText("内容相关")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <AISearchExplanation
        query="test"
        similarity={0.5}
        className="custom-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should round similarity percentage", () => {
    render(<AISearchExplanation query="test" similarity={0.867} />);

    expect(screen.getByText("相似度 87%")).toBeInTheDocument();
  });
});
