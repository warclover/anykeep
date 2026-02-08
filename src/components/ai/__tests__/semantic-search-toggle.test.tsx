/**
 * SemanticSearchToggle Component Tests
 *
 * @version 2.0.0 - 适配两态开关（普通搜索 / AI 搜索）
 * @since 2025-12-22
 */

import { render, screen, fireEvent } from "@testing-library/react";
import {
  SemanticSearchToggle,
  SearchModeToggleGroup,
} from "../semantic-search-toggle";

describe("SemanticSearchToggle", () => {
  const defaultProps = {
    mode: "keyword" as const,
    onModeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Two-state toggle", () => {
    it("renders with keyword mode showing '普通搜索'", () => {
      render(<SemanticSearchToggle {...defaultProps} mode="keyword" />);

      expect(screen.getByText("普通搜索")).toBeInTheDocument();
      expect(
        screen.getByText("精确匹配标题和内容中的关键词"),
      ).toBeInTheDocument();
    });

    it("renders with hybrid mode showing 'AI 搜索'", () => {
      render(<SemanticSearchToggle {...defaultProps} mode="hybrid" />);

      expect(screen.getByText("AI 搜索")).toBeInTheDocument();
      expect(
        screen.getByText("理解搜索意图，智能匹配相关内容"),
      ).toBeInTheDocument();
    });

    it("treats semantic mode as AI enabled", () => {
      render(<SemanticSearchToggle {...defaultProps} mode="semantic" />);

      // semantic 模式在 UI 层也显示为 AI 搜索
      expect(screen.getByText("AI 搜索")).toBeInTheDocument();
    });

    it("switches from keyword to hybrid when AI button clicked", () => {
      const onModeChange = jest.fn();
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="keyword"
          onModeChange={onModeChange}
        />,
      );

      const aiButton = screen.getByRole("button", { name: /AI/ });
      fireEvent.click(aiButton);

      expect(onModeChange).toHaveBeenCalledWith("hybrid");
    });

    it("switches from hybrid to keyword when 普通 button clicked", () => {
      const onModeChange = jest.fn();
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="hybrid"
          onModeChange={onModeChange}
        />,
      );

      const normalButton = screen.getByRole("button", { name: /普通/ });
      fireEvent.click(normalButton);

      expect(onModeChange).toHaveBeenCalledWith("keyword");
    });

    it("disables buttons when disabled prop is true", () => {
      render(<SemanticSearchToggle {...defaultProps} disabled={true} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});

describe("SearchModeToggleGroup", () => {
  const defaultProps = {
    mode: "keyword" as const,
    onModeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both '普通搜索' and 'AI 搜索' buttons", () => {
    render(<SearchModeToggleGroup {...defaultProps} />);

    expect(screen.getByText("普通搜索")).toBeInTheDocument();
    expect(screen.getByText("AI 搜索")).toBeInTheDocument();
  });

  it("highlights keyword button when in keyword mode", () => {
    render(<SearchModeToggleGroup {...defaultProps} mode="keyword" />);

    const keywordButton = screen.getByRole("button", { name: /普通搜索/ });
    expect(keywordButton).toBeInTheDocument();
  });

  it("calls onModeChange with hybrid when AI button clicked", () => {
    const onModeChange = jest.fn();
    render(
      <SearchModeToggleGroup
        {...defaultProps}
        mode="keyword"
        onModeChange={onModeChange}
      />,
    );

    const aiButton = screen.getByRole("button", { name: /AI 搜索/ });
    fireEvent.click(aiButton);

    expect(onModeChange).toHaveBeenCalledWith("hybrid");
  });

  it("calls onModeChange with keyword when 普通搜索 button clicked", () => {
    const onModeChange = jest.fn();
    render(
      <SearchModeToggleGroup
        {...defaultProps}
        mode="hybrid"
        onModeChange={onModeChange}
      />,
    );

    const keywordButton = screen.getByRole("button", { name: /普通搜索/ });
    fireEvent.click(keywordButton);

    expect(onModeChange).toHaveBeenCalledWith("keyword");
  });

  it("disables both buttons when disabled is true", () => {
    render(<SearchModeToggleGroup {...defaultProps} disabled={true} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});
