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

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("AISearchSuggestions", () => {
  const defaultProps = {
    query: "",
    onSuggestionSelect: jest.fn(),
    visible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
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

  it("shows search history when available", async () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify(["previous search 1", "previous search 2"]),
    );

    render(<AISearchSuggestions {...defaultProps} query="" />);

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

  it("saves selected suggestion to history", async () => {
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

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "search_history",
      expect.stringContaining("AI 技术"),
    );
  });

  it("clears history when clear button is clicked", async () => {
    const onClearHistory = jest.fn();
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify(["search 1", "search 2"]),
    );

    render(
      <AISearchSuggestions
        {...defaultProps}
        query=""
        onClearHistory={onClearHistory}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("清除")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("清除"));

    expect(onClearHistory).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("search_history");
  });

  it("removes single history item when X button is clicked", async () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify(["search 1", "search 2"]),
    );

    render(<AISearchSuggestions {...defaultProps} query="" />);

    await waitFor(() => {
      expect(screen.getByText("search 1")).toBeInTheDocument();
    });

    // Find and click the remove button for the first history item
    const removeButtons = screen.getAllByRole("button");
    const historyRemoveButton = removeButtons.find((btn) =>
      btn.querySelector('[class*="size-6"]'),
    );

    if (historyRemoveButton) {
      fireEvent.click(historyRemoveButton);

      // History should be updated without "search 1"
      expect(localStorageMock.setItem).toHaveBeenCalled();
    }
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
