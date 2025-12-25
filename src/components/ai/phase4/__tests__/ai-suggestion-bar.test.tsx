/**
 * AISuggestionBar 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { AISuggestionBar } from "../ai-suggestion-bar";

describe("AISuggestionBar", () => {
  const mockSetInput = jest.fn();

  beforeEach(() => {
    mockSetInput.mockClear();
  });

  describe("visibility", () => {
    it("should not render when visible is false", () => {
      const { container } = render(
        <AISuggestionBar onSetInput={mockSetInput} visible={false} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render when visible is true", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      expect(screen.getByText("继续 →")).toBeInTheDocument();
    });
  });

  describe("suggestions", () => {
    it("should render all suggestion buttons", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      expect(screen.getByText("继续 →")).toBeInTheDocument();
      expect(screen.getByText("知识复习")).toBeInTheDocument();
      expect(screen.getByText("🔍 搜索相关")).toBeInTheDocument();
      expect(screen.getByText("📋 更多详情")).toBeInTheDocument();
    });

    it("should call onSetInput with correct value for continue button", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      fireEvent.click(screen.getByText("继续 →"));

      expect(mockSetInput).toHaveBeenCalledWith("继续");
    });

    it("should call onSetInput with correct value for review button", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      fireEvent.click(screen.getByText("知识复习"));

      expect(mockSetInput).toHaveBeenCalledWith("帮我制定知识复习计划");
    });

    it("should call onSetInput with correct value for search button", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      fireEvent.click(screen.getByText("🔍 搜索相关"));

      expect(mockSetInput).toHaveBeenCalledWith("搜索相关内容");
    });

    it("should call onSetInput with correct value for details button", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      fireEvent.click(screen.getByText("📋 更多详情"));

      expect(mockSetInput).toHaveBeenCalledWith("给我更多详情");
    });
  });

  describe("styling", () => {
    it("should have correct container classes", () => {
      render(<AISuggestionBar onSetInput={mockSetInput} visible={true} />);

      const container = screen
        .getByText("继续 →")
        .closest("div")?.parentElement;
      expect(container).toHaveClass("border-t", "border-pink-100");
    });
  });
});
