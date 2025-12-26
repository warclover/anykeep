/**
 * ToolSelector 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { render, screen, fireEvent } from "@testing-library/react";
import {
  ToolSelector,
  ToolSelectorCompact,
  TOOLS,
  useToolShortcuts,
} from "../tool-selector";
import { renderHook, act } from "@testing-library/react";

// =============================================================================
// ToolSelector 基础测试
// =============================================================================

describe("ToolSelector", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("should render all tools", () => {
    render(<ToolSelector value="auto" onChange={mockOnChange} />);

    // 检查所有工具图标是否存在
    expect(screen.getByText("✨")).toBeInTheDocument(); // 智能
    expect(screen.getByText("🔍")).toBeInTheDocument(); // 搜索
    expect(screen.getByText("📂")).toBeInTheDocument(); // 整理
    expect(screen.getByText("✍️")).toBeInTheDocument(); // 创作
    expect(screen.getByText("📤")).toBeInTheDocument(); // 导出
  });

  it("should highlight selected tool with gradient class", () => {
    render(<ToolSelector value="search" onChange={mockOnChange} />);

    // 搜索工具应该被选中，使用粉色渐变背景
    const searchButton = screen.getByText("🔍").closest("button");
    expect(searchButton).toHaveClass("from-pink-100");
    expect(searchButton).toHaveClass("to-rose-100");
  });

  it("should call onChange when tool is clicked", () => {
    render(<ToolSelector value="auto" onChange={mockOnChange} />);

    fireEvent.click(screen.getByText("🔍"));

    expect(mockOnChange).toHaveBeenCalledWith("search");
  });

  it("should be disabled when disabled prop is true", () => {
    render(<ToolSelector value="auto" onChange={mockOnChange} disabled />);

    const searchButton = screen.getByText("🔍").closest("button");
    expect(searchButton).toBeDisabled();
  });

  it("should show labels when showLabel is true", () => {
    render(<ToolSelector value="auto" onChange={mockOnChange} showLabel />);

    expect(screen.getByText("智能")).toBeInTheDocument();
    expect(screen.getByText("搜索")).toBeInTheDocument();
    expect(screen.getByText("整理")).toBeInTheDocument();
  });

  it("should set aria-pressed on selected tool", () => {
    render(<ToolSelector value="organize" onChange={mockOnChange} />);

    const organizeButton = screen.getByText("📂").closest("button");
    expect(organizeButton).toHaveAttribute("aria-pressed", "true");
  });
});

// =============================================================================
// ToolSelectorCompact 测试
// =============================================================================

describe("ToolSelectorCompact", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("should render compact version", () => {
    render(<ToolSelectorCompact value="auto" onChange={mockOnChange} />);

    // 紧凑版应该有工具按钮
    expect(screen.getByText("✨")).toBeInTheDocument();
  });

  it("should call onChange when clicked", () => {
    render(<ToolSelectorCompact value="auto" onChange={mockOnChange} />);

    fireEvent.click(screen.getByText("📂"));

    expect(mockOnChange).toHaveBeenCalledWith("organize");
  });
});

// =============================================================================
// useToolShortcuts Hook 测试
// =============================================================================

describe("useToolShortcuts", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("should register keyboard shortcut for search (key 1)", () => {
    renderHook(() => useToolShortcuts(mockOnChange));

    // 模拟按键事件 - 不需要 altKey，直接按 "1"
    act(() => {
      fireEvent.keyDown(window, { key: "1" });
    });

    expect(mockOnChange).toHaveBeenCalledWith("search");
  });

  it("should handle key 0 for auto mode", () => {
    renderHook(() => useToolShortcuts(mockOnChange));

    act(() => {
      fireEvent.keyDown(window, { key: "0" });
    });

    expect(mockOnChange).toHaveBeenCalledWith("auto");
  });

  it("should not trigger when Alt key is pressed (modifier key)", () => {
    renderHook(() => useToolShortcuts(mockOnChange));

    act(() => {
      fireEvent.keyDown(window, { key: "1", altKey: true });
    });

    // Hook 忽略 altKey
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("should not trigger when Ctrl key is pressed", () => {
    renderHook(() => useToolShortcuts(mockOnChange));

    act(() => {
      fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("should not trigger when disabled", () => {
    renderHook(() => useToolShortcuts(mockOnChange, false));

    act(() => {
      fireEvent.keyDown(window, { key: "1" });
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("should handle key 2 for organize mode", () => {
    renderHook(() => useToolShortcuts(mockOnChange));

    act(() => {
      fireEvent.keyDown(window, { key: "2" });
    });

    expect(mockOnChange).toHaveBeenCalledWith("organize");
  });
});

// =============================================================================
// TOOLS 常量测试
// =============================================================================

describe("TOOLS constant", () => {
  it("should have correct number of tools", () => {
    expect(TOOLS).toHaveLength(5);
  });

  it("should have auto as first tool", () => {
    expect(TOOLS[0].id).toBe("auto");
    expect(TOOLS[0].name).toBe("智能");
  });

  it("should have all required properties", () => {
    TOOLS.forEach((tool) => {
      expect(tool).toHaveProperty("id");
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("icon");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("shortcut");
    });
  });

  it("should have unique shortcuts", () => {
    const shortcuts = TOOLS.map((t) => t.shortcut);
    const uniqueShortcuts = new Set(shortcuts);
    expect(uniqueShortcuts.size).toBe(shortcuts.length);
  });

  it("should have shortcuts from 0 to 4", () => {
    const shortcuts = TOOLS.map((t) => t.shortcut).sort();
    expect(shortcuts).toEqual(["0", "1", "2", "3", "4"]);
  });
});
