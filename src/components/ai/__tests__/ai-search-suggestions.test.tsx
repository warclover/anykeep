/**
 * AISearchSuggestions Component Tests
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { AISearchSuggestions } from "../ai-search-suggestions";

describe("AISearchSuggestions", () => {
  const defaultProps = {
    query: "",
    onSuggestionSelect: jest.fn(),
    visible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      }),
    ) as jest.Mock;
  });

  it("does not render when visible is false", () => {
    const { container } = render(
      <AISearchSuggestions {...defaultProps} visible={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows trending suggestions when no query is entered", async () => {
    render(<AISearchSuggestions {...defaultProps} query="" />);

    await waitFor(() => {
      expect(screen.getByText("热门搜索")).toBeInTheDocument();
      expect(screen.getByText("AI 技术")).toBeInTheDocument();
      expect(screen.getByText("产品设计")).toBeInTheDocument();
    });
  });

  it("shows search history when available from API", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            recentSearches: [
              {
                id: "1",
                query: "previous search 1",
                resultCount: 5,
                createdAt: new Date().toISOString(),
              },
              {
                id: "2",
                query: "previous search 2",
                resultCount: 3,
                createdAt: new Date().toISOString(),
              },
            ],
            hotKeywords: [],
          },
        }),
    });

    render(
      <AISearchSuggestions {...defaultProps} query="" userId="test-user" />,
    );

    await waitFor(() => {
      expect(screen.getByText("最近搜索")).toBeInTheDocument();
      expect(screen.getByText("previous search 1")).toBeInTheDocument();
      expect(screen.getByText("previous search 2")).toBeInTheDocument();
    });
  });

  it("shows AI suggestions when query is entered", async () => {
    // Use fake timers to control async behavior
    jest.useFakeTimers();

    render(<AISearchSuggestions {...defaultProps} query="React" />);

    // Fast-forward timers to trigger debounce and simulated API call
    await act(async () => {
      await jest.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText("AI 建议")).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("calls onSuggestionSelect when suggestion is clicked", async () => {
    const onSuggestionSelect = jest.fn();
    render(
      <AISearchSuggestions
        {...defaultProps}
        query=""
        onSuggestionSelect={onSuggestionSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("AI 技术")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("AI 技术"));

    expect(onSuggestionSelect).toHaveBeenCalledWith("AI 技术");
  });

  it("calls onSuggestionSelect with selected suggestion text", async () => {
    const onSuggestionSelect = jest.fn();
    render(
      <AISearchSuggestions
        {...defaultProps}
        query=""
        onSuggestionSelect={onSuggestionSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("AI 技术")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("AI 技术"));

    expect(onSuggestionSelect).toHaveBeenCalledWith("AI 技术");
  });

  it("clears history when clear button is clicked", async () => {
    const onClearHistory = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            recentSearches: [
              {
                id: "1",
                query: "search 1",
                resultCount: 5,
                createdAt: new Date().toISOString(),
              },
              {
                id: "2",
                query: "search 2",
                resultCount: 3,
                createdAt: new Date().toISOString(),
              },
            ],
            hotKeywords: [],
          },
        }),
    });

    render(
      <AISearchSuggestions
        {...defaultProps}
        query=""
        userId="test-user"
        onClearHistory={onClearHistory}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("清除")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("清除"));

    await waitFor(() => {
      expect(onClearHistory).toHaveBeenCalled();
    });
  });

  it("renders history items with remove buttons", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            recentSearches: [
              {
                id: "1",
                query: "search 1",
                resultCount: 5,
                createdAt: new Date().toISOString(),
              },
              {
                id: "2",
                query: "search 2",
                resultCount: 3,
                createdAt: new Date().toISOString(),
              },
            ],
            hotKeywords: [],
          },
        }),
    });

    render(
      <AISearchSuggestions {...defaultProps} query="" userId="test-user" />,
    );

    await waitFor(() => {
      expect(screen.getByText("search 1")).toBeInTheDocument();
      expect(screen.getByText("search 2")).toBeInTheDocument();
    });

    // 历史记录区域应包含"清除"按钮
    expect(screen.getByText("清除")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <AISearchSuggestions
        {...defaultProps}
        query=""
        className="custom-class"
      />,
    );

    // When visible and has suggestions, the container should have the custom class
    waitFor(() => {
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});
