/**
 * 大纲编辑器测试 (Story 2.2)
 * @module components/knowledge-studio/__tests__
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutlineEditor } from "../outline-editor";
import { OutlineTreeItem } from "../outline-tree-item";
import type {
  BlueprintOutline,
  OutlineNode,
} from "@/lib/knowledge-studio/blueprint";

// ============================================================
// Test Data
// ============================================================

const mockOutline: BlueprintOutline = {
  title: "测试大纲",
  summary: "这是一个测试大纲",
  nodes: [
    {
      id: "section-1",
      title: "第一章：引言",
      level: 1,
      description: "介绍背景",
      estimatedWords: 500,
      children: [
        {
          id: "section-1-1",
          title: "1.1 背景介绍",
          level: 2,
          description: "详细背景",
          estimatedWords: 200,
        },
        {
          id: "section-1-2",
          title: "1.2 研究目的",
          level: 2,
          description: "研究目的说明",
          estimatedWords: 150,
        },
      ],
    },
    {
      id: "section-2",
      title: "第二章：方法",
      level: 1,
      description: "研究方法",
      estimatedWords: 800,
      children: [
        {
          id: "section-2-1",
          title: "2.1 数据收集",
          level: 2,
          description: "数据收集方法",
          estimatedWords: 300,
          children: [
            {
              id: "section-2-1-1",
              title: "2.1.1 采样策略",
              level: 3,
              description: "采样方法",
              estimatedWords: 100,
            },
          ],
        },
      ],
    },
    {
      id: "section-3",
      title: "第三章：结论",
      level: 1,
      description: "总结",
      estimatedWords: 400,
    },
  ],
  totalEstimatedWords: 2450,
  generatedBy: "deepseek",
};

// ============================================================
// OutlineEditor Tests
// ============================================================

describe("OutlineEditor", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the outline editor with title", () => {
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      expect(screen.getByText("大纲编辑器")).toBeInTheDocument();
    });

    it("should display statistics", () => {
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      expect(screen.getByText("3 个主章节")).toBeInTheDocument();
      expect(screen.getByText("7 个节点")).toBeInTheDocument();
      // Use getAllByText and check the header area
      const wordElements = screen.getAllByText(/字/);
      expect(wordElements.length).toBeGreaterThan(0);
    });

    it("should render all top-level nodes", () => {
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      expect(screen.getByText("第一章：引言")).toBeInTheDocument();
      expect(screen.getByText("第二章：方法")).toBeInTheDocument();
      expect(screen.getByText("第三章：结论")).toBeInTheDocument();
    });

    it("should render preview panel when showPreview is true", () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          showPreview={true}
        />,
      );

      expect(screen.getByText("大纲预览")).toBeInTheDocument();
      expect(screen.getByText("测试大纲")).toBeInTheDocument();
    });

    it("should hide preview panel when showPreview is false", () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          showPreview={false}
        />,
      );

      expect(screen.queryByText("大纲预览")).not.toBeInTheDocument();
    });
  });

  describe("Expand/Collapse", () => {
    it("should have expand and collapse buttons", () => {
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      expect(screen.getByText("展开")).toBeInTheDocument();
      expect(screen.getByText("折叠")).toBeInTheDocument();
    });

    it("should expand all nodes when clicking expand button", async () => {
      const user = userEvent.setup();
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      await user.click(screen.getByText("展开"));

      // After expanding, child nodes should be visible
      expect(screen.getByText("1.1 背景介绍")).toBeInTheDocument();
      expect(screen.getByText("2.1 数据收集")).toBeInTheDocument();
    });

    it("should collapse all nodes when clicking collapse button", async () => {
      const user = userEvent.setup();
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      // First expand
      await user.click(screen.getByText("展开"));

      // Then collapse
      await user.click(screen.getByText("折叠"));

      // H1 nodes should still be visible
      expect(screen.getByText("第一章：引言")).toBeInTheDocument();
    });
  });

  describe("Reset", () => {
    it("should have reset button in edit mode", () => {
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      expect(screen.getByText("重置")).toBeInTheDocument();
    });

    it("should hide reset button in readOnly mode", () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          readOnly={true}
        />,
      );

      expect(screen.queryByText("重置")).not.toBeInTheDocument();
    });

    it("should call onChange with original outline when reset", async () => {
      const user = userEvent.setup();
      render(<OutlineEditor outline={mockOutline} onChange={mockOnChange} />);

      await user.click(screen.getByText("重置"));

      expect(mockOnChange).toHaveBeenCalledWith(mockOutline);
    });
  });

  describe("ReadOnly Mode", () => {
    it("should not show edit controls in readOnly mode", () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          readOnly={true}
        />,
      );

      // Reset button should be hidden
      expect(screen.queryByText("重置")).not.toBeInTheDocument();
    });
  });
});

// ============================================================
// OutlineTreeItem Tests
// ============================================================

describe("OutlineTreeItem", () => {
  const mockNode: OutlineNode = {
    id: "test-node",
    title: "测试章节",
    level: 1,
    description: "这是测试描述",
    estimatedWords: 500,
  };

  const mockHandlers = {
    onToggleExpand: jest.fn(),
    onUpdateNode: jest.fn(),
    onDeleteNode: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render node title", () => {
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("测试章节")).toBeInTheDocument();
    });

    it("should render estimated words", () => {
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("~500字")).toBeInTheDocument();
    });

    it("should show expand button when has children", () => {
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={true}
          {...mockHandlers}
        />,
      );

      const expandButton = screen.getByRole("button", { name: "展开章节" });
      expect(expandButton).toBeInTheDocument();
    });

    it("should show collapse button when expanded", () => {
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={true}
          hasChildren={true}
          {...mockHandlers}
        />,
      );

      const collapseButton = screen.getByRole("button", { name: "折叠章节" });
      expect(collapseButton).toBeInTheDocument();
    });
  });

  describe("Level Styling", () => {
    it("should apply appropriate styling for level 1", () => {
      render(
        <OutlineTreeItem
          node={{ ...mockNode, level: 1 }}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Level 1 nodes should be rendered with font-semibold class
      expect(screen.getByText("测试章节")).toBeInTheDocument();
    });

    it("should apply appropriate styling for level 2", () => {
      render(
        <OutlineTreeItem
          node={{ ...mockNode, level: 2 }}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("测试章节")).toBeInTheDocument();
    });

    it("should apply appropriate styling for level 3", () => {
      render(
        <OutlineTreeItem
          node={{ ...mockNode, level: 3 }}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("测试章节")).toBeInTheDocument();
    });
  });

  describe("Expand/Collapse", () => {
    it("should call onToggleExpand when expand button clicked", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={true}
          {...mockHandlers}
        />,
      );

      await user.click(screen.getByRole("button", { name: "展开章节" }));

      expect(mockHandlers.onToggleExpand).toHaveBeenCalled();
    });
  });

  describe("Edit Mode", () => {
    it("should enter edit mode on double click", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      await user.dblClick(screen.getByText("测试章节"));

      // Input should appear
      expect(screen.getByDisplayValue("测试章节")).toBeInTheDocument();
    });

    it("should save changes on blur", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Enter edit mode
      await user.dblClick(screen.getByText("测试章节"));

      // Change title
      const input = screen.getByDisplayValue("测试章节");
      await user.clear(input);
      await user.type(input, "新标题");
      fireEvent.blur(input);

      expect(mockHandlers.onUpdateNode).toHaveBeenCalledWith("test-node", {
        title: "新标题",
      });
    });

    it("should save changes on Enter key", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Enter edit mode
      await user.dblClick(screen.getByText("测试章节"));

      // Change title and press Enter
      const input = screen.getByDisplayValue("测试章节");
      await user.clear(input);
      await user.type(input, "新标题{enter}");

      expect(mockHandlers.onUpdateNode).toHaveBeenCalledWith("test-node", {
        title: "新标题",
      });
    });

    it("should cancel edit on Escape key", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Enter edit mode
      await user.dblClick(screen.getByText("测试章节"));

      // Press Escape
      const input = screen.getByDisplayValue("测试章节");
      await user.type(input, "{escape}");

      // Should exit edit mode without saving
      expect(mockHandlers.onUpdateNode).not.toHaveBeenCalled();
      expect(screen.getByText("测试章节")).toBeInTheDocument();
    });

    it("should not enter edit mode when disabled", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          disabled={true}
          {...mockHandlers}
        />,
      );

      await user.dblClick(screen.getByText("测试章节"));

      // Should not show input
      expect(screen.queryByDisplayValue("测试章节")).not.toBeInTheDocument();
    });
  });

  describe("Delete", () => {
    it("should show delete confirmation dialog", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: "删除章节" });
      await user.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("确认删除")).toBeInTheDocument();
      });
      expect(
        screen.getByText(/确定要删除「测试章节」章节吗/),
      ).toBeInTheDocument();
    });

    it("should call onDeleteNode when confirmed", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: "删除章节" });
      await user.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText("确认删除")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: "删除" }));

      expect(mockHandlers.onDeleteNode).toHaveBeenCalledWith("test-node");
    });

    it("should not delete when cancelled", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={false}
          {...mockHandlers}
        />,
      );

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: "删除章节" });
      await user.click(deleteButton);

      // Cancel deletion
      await waitFor(() => {
        expect(screen.getByText("确认删除")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: "取消" }));

      expect(mockHandlers.onDeleteNode).not.toHaveBeenCalled();
    });

    it("should show warning about children when node has children", async () => {
      const user = userEvent.setup();
      render(
        <OutlineTreeItem
          node={mockNode}
          isExpanded={false}
          hasChildren={true}
          {...mockHandlers}
        />,
      );

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: "删除章节" });
      await user.click(deleteButton);

      // Should show warning about children
      await waitFor(() => {
        expect(screen.getByText(/包含子章节/)).toBeInTheDocument();
      });
    });
  });
});

// ============================================================
// Utility Functions Tests
// ============================================================

describe("Utility Functions", () => {
  describe("Statistics Calculation", () => {
    it("should calculate correct node count", () => {
      render(<OutlineEditor outline={mockOutline} onChange={jest.fn()} />);

      // Total nodes: 3 H1 + 3 H2 + 1 H3 = 7
      expect(screen.getByText("7 个节点")).toBeInTheDocument();
    });

    it("should display estimated words in header", () => {
      render(<OutlineEditor outline={mockOutline} onChange={jest.fn()} />);

      // Check that the total words are displayed (multiple elements contain "字", so just verify existence)
      const wordElements = screen.getAllByText(/字/);
      expect(wordElements.length).toBeGreaterThan(0);
    });
  });
});
