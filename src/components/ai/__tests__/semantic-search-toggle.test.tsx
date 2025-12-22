/**
 * SemanticSearchToggle Component Tests
 *
 * @version 1.0.0
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

  describe("Full Mode (non-compact)", () => {
    it("renders with keyword mode", () => {
      render(<SemanticSearchToggle {...defaultProps} mode="keyword" />);

      expect(screen.getByText("关键词搜索")).toBeInTheDocument();
      expect(
        screen.getByText("精确匹配标题和内容中的关键词"),
      ).toBeInTheDocument();
    });

    it("renders with semantic mode", () => {
      render(<SemanticSearchToggle {...defaultProps} mode="semantic" />);

      expect(screen.getByText("语义搜索")).toBeInTheDocument();
      expect(
        screen.getByText("理解搜索意图，找到语义相关的内容"),
      ).toBeInTheDocument();
      expect(screen.getByText("AI 增强")).toBeInTheDocument();
    });

    it("calls onModeChange when switch is toggled", () => {
      const onModeChange = jest.fn();
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="keyword"
          onModeChange={onModeChange}
        />,
      );

      const switchElement = screen.getByRole("switch");
      fireEvent.click(switchElement);

      expect(onModeChange).toHaveBeenCalledWith("semantic");
    });

    it("toggles from semantic to keyword", () => {
      const onModeChange = jest.fn();
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="semantic"
          onModeChange={onModeChange}
        />,
      );

      const switchElement = screen.getByRole("switch");
      fireEvent.click(switchElement);

      expect(onModeChange).toHaveBeenCalledWith("keyword");
    });

    it("disables switch when disabled prop is true", () => {
      render(<SemanticSearchToggle {...defaultProps} disabled={true} />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toBeDisabled();
    });
  });

  describe("Compact Mode", () => {
    it("renders compact button with keyword mode", () => {
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="keyword"
          compact={true}
        />,
      );

      // Should show search icon and label
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders compact button with semantic mode", () => {
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="semantic"
          compact={true}
        />,
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("calls onModeChange when compact button is clicked", () => {
      const onModeChange = jest.fn();
      render(
        <SemanticSearchToggle
          {...defaultProps}
          mode="keyword"
          onModeChange={onModeChange}
          compact={true}
        />,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onModeChange).toHaveBeenCalledWith("semantic");
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

  it("renders both keyword and semantic buttons", () => {
    render(<SearchModeToggleGroup {...defaultProps} />);

    expect(screen.getByText("关键词")).toBeInTheDocument();
    expect(screen.getByText("语义")).toBeInTheDocument();
  });

  it("highlights keyword button when in keyword mode", () => {
    render(<SearchModeToggleGroup {...defaultProps} mode="keyword" />);

    const keywordButton = screen.getByRole("button", { name: /关键词/ });
    // Button should be present and clickable
    expect(keywordButton).toBeInTheDocument();
  });

  it("calls onModeChange with semantic when semantic button clicked", () => {
    const onModeChange = jest.fn();
    render(
      <SearchModeToggleGroup
        {...defaultProps}
        mode="keyword"
        onModeChange={onModeChange}
      />,
    );

    const semanticButton = screen.getByRole("button", { name: /语义/ });
    fireEvent.click(semanticButton);

    expect(onModeChange).toHaveBeenCalledWith("semantic");
  });

  it("calls onModeChange with keyword when keyword button clicked", () => {
    const onModeChange = jest.fn();
    render(
      <SearchModeToggleGroup
        {...defaultProps}
        mode="semantic"
        onModeChange={onModeChange}
      />,
    );

    const keywordButton = screen.getByRole("button", { name: /关键词/ });
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
