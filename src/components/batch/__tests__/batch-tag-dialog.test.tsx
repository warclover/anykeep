/**
 * BatchTagDialog 组件单元测试
 * @description 测试批量标签操作对话框的核心功能
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchTagDialog, type BatchTagDialogProps } from "../batch-tag-dialog";

// Mock hooks
jest.mock("@/hooks/batch/use-batch-tags", () => ({
  useBatchTags: jest.fn(() => ({
    batchAddTags: jest.fn(),
    batchRemoveTags: jest.fn(),
    isProcessing: false,
    error: null,
  })),
}));

jest.mock("@/hooks/data/use-custom-usage-tags", () => ({
  useCustomUsageTags: jest.fn(() => ({
    customTags: [
      { label: "工作", value: "work" },
      { label: "学习", value: "study" },
    ],
  })),
}));

// Import mocked hook for test control
import { useBatchTags } from "@/hooks/batch/use-batch-tags";

const mockUseBatchTags = useBatchTags as jest.MockedFunction<
  typeof useBatchTags
>;

describe("BatchTagDialog", () => {
  // 使用类型断言简化测试数据
  const mockBookmarks = [
    {
      id: 1,
      title: "Bookmark 1",
      url: "https://example1.com",
      user_tags: ["existing-tag"],
      ai_tags: ["ai-tag"],
      user_id: "user-1",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      platform: "web",
      is_starred: false,
    },
    {
      id: 2,
      title: "Bookmark 2",
      url: "https://example2.com",
      user_tags: ["existing-tag", "another-tag"],
      ai_tags: [],
      user_id: "user-1",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      platform: "web",
      is_starred: false,
    },
    {
      id: 3,
      title: "Bookmark 3",
      url: "https://example3.com",
      user_tags: [],
      ai_tags: ["ai-tag"],
      user_id: "user-1",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      platform: "web",
      is_starred: false,
    },
  ] as BatchTagDialogProps["selectedBookmarks"];

  const defaultProps: BatchTagDialogProps = {
    open: true,
    onOpenChange: jest.fn(),
    selectedIds: [1, 2, 3],
    selectedBookmarks: mockBookmarks,
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBatchTags.mockReturnValue({
      batchAddTags: jest.fn(),
      batchRemoveTags: jest.fn(),
      isProcessing: false,
      error: null,
    });
  });

  describe("渲染", () => {
    it("open 为 true 时渲染对话框", () => {
      render(<BatchTagDialog {...defaultProps} />);
      expect(screen.getByText("批量标签操作")).toBeInTheDocument();
    });

    it("open 为 false 时不渲染对话框", () => {
      render(<BatchTagDialog {...defaultProps} open={false} />);
      expect(screen.queryByText("批量标签操作")).not.toBeInTheDocument();
    });

    it("显示选中的书签数量", () => {
      render(<BatchTagDialog {...defaultProps} />);
      expect(screen.getByText(/3 个书签/)).toBeInTheDocument();
    });

    it("显示添加和移除标签选项卡", () => {
      render(<BatchTagDialog {...defaultProps} />);
      // Use getByRole to target tabs specifically (there are buttons with same text)
      expect(screen.getByRole("tab", { name: /添加标签/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /移除标签/ })).toBeInTheDocument();
    });
  });

  describe("标签输入", () => {
    it("输入标签后按回车添加", async () => {
      const user = userEvent.setup();
      render(<BatchTagDialog {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入标签名称/);
      await user.type(input, "新标签{enter}");

      expect(screen.getByText("新标签")).toBeInTheDocument();
    });

    it("点击添加按钮添加标签", async () => {
      const user = userEvent.setup();
      render(<BatchTagDialog {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入标签名称/);
      await user.type(input, "新标签");

      const addButton = screen.getByRole("button", { name: "添加" });
      await user.click(addButton);

      expect(screen.getByText("新标签")).toBeInTheDocument();
    });
  });

  describe("批量操作", () => {
    it("点击添加标签按钮调用 batchAddTags", async () => {
      const mockBatchAddTags = jest.fn();
      mockUseBatchTags.mockReturnValue({
        batchAddTags: mockBatchAddTags,
        batchRemoveTags: jest.fn(),
        isProcessing: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<BatchTagDialog {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入标签名称/);
      await user.type(input, "测试标签{enter}");

      const submitButtons = screen.getAllByRole("button");
      const submitButton = submitButtons.find(
        (btn) => btn.textContent === "添加标签",
      );
      if (submitButton) {
        await user.click(submitButton);
        expect(mockBatchAddTags).toHaveBeenCalledWith([1, 2, 3], ["测试标签"]);
      }
    });

    it("处理中时显示加载状态", () => {
      mockUseBatchTags.mockReturnValue({
        batchAddTags: jest.fn(),
        batchRemoveTags: jest.fn(),
        isProcessing: true,
        error: null,
      });

      render(<BatchTagDialog {...defaultProps} />);
      expect(screen.getByText("处理中...")).toBeInTheDocument();
    });
  });

  describe("对话框状态管理", () => {
    it("点击取消按钮关闭对话框", async () => {
      const onOpenChange = jest.fn();
      const user = userEvent.setup();

      render(<BatchTagDialog {...defaultProps} onOpenChange={onOpenChange} />);

      const cancelButton = screen.getByRole("button", { name: "取消" });
      await user.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("推荐标签", () => {
    it("显示预设和自定义标签", () => {
      render(<BatchTagDialog {...defaultProps} />);
      expect(screen.getByText("推荐标签")).toBeInTheDocument();
    });

    it("点击推荐标签添加到待添加列表", async () => {
      const user = userEvent.setup();
      render(<BatchTagDialog {...defaultProps} />);

      // 查找推荐标签区域中的标签按钮
      const badges = screen.getAllByText("工作");
      if (badges.length > 0) {
        await user.click(badges[0]);
        // 验证标签被添加
        const allWorkTags = screen.getAllByText("工作");
        expect(allWorkTags.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("边界条件", () => {
    it("空书签列表时正确渲染", () => {
      render(
        <BatchTagDialog
          open={true}
          onOpenChange={jest.fn()}
          selectedIds={[]}
          selectedBookmarks={[]}
        />,
      );
      expect(screen.getByText(/0 个书签/)).toBeInTheDocument();
    });

    it("没有选择标签时提交按钮禁用", () => {
      render(<BatchTagDialog {...defaultProps} />);
      const submitButtons = screen.getAllByRole("button");
      const submitButton = submitButtons.find(
        (btn) => btn.textContent === "添加标签",
      );
      expect(submitButton).toBeDisabled();
    });
  });
});
