/**
 * ContextPanel 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import {
  ContextIndicator,
  ContextPanel,
  useContextItems,
} from "../context-panel";
import type { ContextItem } from "../types";

// =============================================================================
// Mock localStorage
// =============================================================================

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// =============================================================================
// useContextItems Hook 测试
// =============================================================================

describe("useContextItems", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  it("should initialize with empty items", () => {
    const { result } = renderHook(() => useContextItems());

    expect(result.current.items).toEqual([]);
    expect(result.current.expanded).toBe(false);
  });

  it("should add item correctly", () => {
    const { result } = renderHook(() => useContextItems());

    act(() => {
      result.current.addItem({
        id: "test-1",
        type: "bookmark",
        title: "Test Bookmark",
        description: "Test description",
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe("Test Bookmark");
    expect(result.current.items[0].type).toBe("bookmark");
  });

  it("should remove item correctly", () => {
    const { result } = renderHook(() => useContextItems());

    act(() => {
      result.current.addItem({
        id: "test-item-1",
        type: "bookmark",
        title: "Test Bookmark",
      });
    });

    const itemId = result.current.items[0].id;

    act(() => {
      result.current.removeItem(itemId);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("should clear all items", () => {
    const { result } = renderHook(() => useContextItems());

    act(() => {
      result.current.addItem({
        id: "b1",
        type: "bookmark",
        title: "Bookmark 1",
      });
      result.current.addItem({ id: "f1", type: "folder", title: "Folder 1" });
    });

    expect(result.current.items).toHaveLength(2);

    act(() => {
      result.current.clearItems();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("should toggle expanded state", () => {
    const { result } = renderHook(() => useContextItems());

    expect(result.current.expanded).toBe(false);

    act(() => {
      result.current.setExpanded(true);
    });

    expect(result.current.expanded).toBe(true);
  });

  it("should convert to context references", () => {
    const { result } = renderHook(() => useContextItems());

    act(() => {
      result.current.addItem({
        id: "ctx-1",
        type: "bookmark",
        title: "Test",
        metadata: { id: 123 },
      });
      result.current.addItem({
        id: "ctx-2",
        type: "folder",
        title: "Test Folder",
        metadata: { id: 456 },
      });
      result.current.addItem({
        id: "ctx-3",
        type: "tag",
        title: "test-tag",
        metadata: { name: "test-tag" },
      });
    });

    const refs = result.current.getContextReferences();

    expect(refs.bookmarkIds).toContain(123);
    expect(refs.folderIds).toContain(456);
    expect(refs.tagNames).toContain("test-tag");
  });

  it("should persist to localStorage when enabled", async () => {
    const { result } = renderHook(() =>
      useContextItems({ storageKey: "test", persist: true }),
    );

    act(() => {
      result.current.addItem({
        id: "persist-1",
        type: "bookmark",
        title: "Persisted",
      });
    });

    // 等待持久化
    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  it("should use initial items when no persisted data", () => {
    const initialItems: ContextItem[] = [
      {
        id: "init-1",
        type: "bookmark",
        title: "Initial Item",
      },
    ];

    const { result } = renderHook(() =>
      useContextItems({ initialItems, persist: false }),
    );

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe("Initial Item");
  });

  it("should prevent duplicate items", () => {
    const { result } = renderHook(() => useContextItems());

    act(() => {
      result.current.addItem({
        id: "dup-1",
        type: "bookmark",
        title: "Item 1",
      });
      result.current.addItem({
        id: "dup-1",
        type: "bookmark",
        title: "Item 1 Duplicate",
      });
    });

    expect(result.current.items).toHaveLength(1);
  });

  it("should batch add items", () => {
    const { result } = renderHook(() => useContextItems());

    act(() => {
      result.current.addItems([
        { id: "batch-1", type: "bookmark", title: "Batch 1" },
        { id: "batch-2", type: "folder", title: "Batch 2" },
      ]);
    });

    expect(result.current.items).toHaveLength(2);
  });
});

// =============================================================================
// ContextIndicator 组件测试
// =============================================================================

describe("ContextIndicator", () => {
  const mockItems: ContextItem[] = [
    { id: "1", type: "bookmark", title: "Bookmark 1" },
    { id: "2", type: "folder", title: "Folder 1" },
    { id: "3", type: "tag", title: "Tag 1" },
  ];

  const mockOnExpand = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not render when no items", () => {
    const { container } = render(
      <ContextIndicator
        items={[]}
        onExpand={mockOnExpand}
        onClear={mockOnClear}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should show item count", () => {
    render(
      <ContextIndicator
        items={mockItems}
        onExpand={mockOnExpand}
        onClear={mockOnClear}
      />,
    );

    expect(screen.getByText(/3 项上下文/)).toBeInTheDocument();
  });

  it("should call onExpand when clicked", () => {
    render(
      <ContextIndicator
        items={mockItems}
        onExpand={mockOnExpand}
        onClear={mockOnClear}
      />,
    );

    const expandButton = screen.getByText(/3 项上下文/);
    fireEvent.click(expandButton);

    expect(mockOnExpand).toHaveBeenCalled();
  });

  it("should call onClear when clear button is clicked", () => {
    render(
      <ContextIndicator
        items={mockItems}
        onExpand={mockOnExpand}
        onClear={mockOnClear}
      />,
    );

    const clearButton = screen.getByTitle("清除上下文");
    fireEvent.click(clearButton);

    expect(mockOnClear).toHaveBeenCalled();
  });
});

// =============================================================================
// ContextPanel 组件测试
// =============================================================================

describe("ContextPanel", () => {
  const mockItems: ContextItem[] = [
    { id: "1", type: "bookmark", title: "Bookmark 1", description: "URL here" },
    { id: "2", type: "folder", title: "Folder 1", description: "5 bookmarks" },
  ];

  const mockOnRemove = jest.fn();
  const mockOnClear = jest.fn();
  const mockOnAddMore = jest.fn();
  const mockOnExpandedChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not render when no items", () => {
    const { container } = render(
      <ContextPanel
        items={[]}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={false}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render panel title with item count", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={false}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    expect(screen.getByText(/上下文引用/)).toBeInTheDocument();
    // 数量嵌入在 "上下文引用 (2)" 文本中
    expect(screen.getByText(/上下文引用 \(2\)/)).toBeInTheDocument();
  });

  it("should render all items when expanded", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={true}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    expect(screen.getByText("Bookmark 1")).toBeInTheDocument();
    expect(screen.getByText("Folder 1")).toBeInTheDocument();
  });

  it("should not show items when collapsed", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={false}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    expect(screen.queryByText("Bookmark 1")).not.toBeInTheDocument();
  });

  it("should call onExpandedChange when header is clicked", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={false}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    const header = screen.getByText(/上下文引用/).closest("div");
    if (header) {
      fireEvent.click(header);
      expect(mockOnExpandedChange).toHaveBeenCalledWith(true);
    }
  });

  it("should call onClear when clear button is clicked", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={true}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    const clearButton = screen.getByTitle("清除全部");
    fireEvent.click(clearButton);

    expect(mockOnClear).toHaveBeenCalled();
  });

  it("should call onAddMore when add button is clicked", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        onAddMore={mockOnAddMore}
        expanded={true}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    const addButton = screen.getByTitle("添加更多");
    fireEvent.click(addButton);

    expect(mockOnAddMore).toHaveBeenCalled();
  });

  it("should call onRemove when item remove button is clicked", () => {
    render(
      <ContextPanel
        items={mockItems}
        onRemove={mockOnRemove}
        onClear={mockOnClear}
        expanded={true}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

    // 找到第一个项目的删除按钮
    const itemRow = screen.getByText("Bookmark 1").closest("div");
    const removeButton = itemRow?.querySelector("button");

    if (removeButton) {
      fireEvent.click(removeButton);
      expect(mockOnRemove).toHaveBeenCalledWith("1");
    }
  });
});
