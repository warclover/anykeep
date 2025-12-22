/**
 * AIActionFeedback 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  AIActionFeedback,
  AIActionFeedbackInline,
} from "../ai-action-feedback";
import type { ConfirmationInfo } from "@/lib/ai-actions";

// Mock ai-actions types
jest.mock("@/lib/ai-actions", () => ({
  // Export mock types
}));

describe("AIActionFeedback", () => {
  const mockConfirmation: ConfirmationInfo = {
    message: "确定要删除选中的 5 个书签吗？",
    affectedCount: 5,
    reversible: false,
    actions: ["删除书签 1", "删除书签 2", "删除书签 3"],
  };

  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    actionType: "bookmark:delete" as const,
    confirmation: mockConfirmation,
    onConfirm: jest.fn(),
    onReject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Dialog mode", () => {
    it("should render dialog when open", () => {
      render(<AIActionFeedback {...defaultProps} />);

      expect(screen.getByText("确认执行操作")).toBeInTheDocument();
      expect(
        screen.getByText("确定要删除选中的 5 个书签吗？"),
      ).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      render(<AIActionFeedback {...defaultProps} open={false} />);

      expect(screen.queryByText("确认执行操作")).not.toBeInTheDocument();
    });

    it("should show affected count", () => {
      render(<AIActionFeedback {...defaultProps} />);

      expect(screen.getByText("5 个项目")).toBeInTheDocument();
    });

    it("should show reversible status", () => {
      render(<AIActionFeedback {...defaultProps} />);

      expect(screen.getByText("否")).toBeInTheDocument();
    });

    it("should show high risk badge for delete operations", () => {
      render(<AIActionFeedback {...defaultProps} />);

      expect(screen.getByText("高风险")).toBeInTheDocument();
    });

    it("should show medium risk badge for batch operations", () => {
      render(<AIActionFeedback {...defaultProps} actionType="tag:batch_add" />);

      expect(screen.getByText("中风险")).toBeInTheDocument();
    });

    it("should show low risk badge for move operations", () => {
      render(<AIActionFeedback {...defaultProps} actionType="bookmark:move" />);

      expect(screen.getByText("低风险")).toBeInTheDocument();
    });

    it("should call onConfirm and close dialog when confirm button clicked", async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onOpenChange = jest.fn();

      render(
        <AIActionFeedback
          {...defaultProps}
          onConfirm={onConfirm}
          onOpenChange={onOpenChange}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /确认/i }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("should call onReject and close dialog when cancel button clicked", () => {
      const onReject = jest.fn();
      const onOpenChange = jest.fn();

      render(
        <AIActionFeedback
          {...defaultProps}
          onReject={onReject}
          onOpenChange={onOpenChange}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /取消/i }));

      expect(onReject).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should disable buttons when executing", () => {
      render(<AIActionFeedback {...defaultProps} isExecuting={true} />);

      expect(screen.getByRole("button", { name: /取消/i })).toBeDisabled();
      expect(screen.getByText("执行中...")).toBeInTheDocument();
    });

    it("should toggle action details when clicked", () => {
      render(<AIActionFeedback {...defaultProps} />);

      // Initially details should be hidden
      expect(screen.queryByText("删除书签 1")).not.toBeInTheDocument();

      // Click to show details
      fireEvent.click(screen.getByText(/将执行 3 个操作/i));

      // Details should be visible
      expect(screen.getByText("删除书签 1")).toBeInTheDocument();
      expect(screen.getByText("删除书签 2")).toBeInTheDocument();
      expect(screen.getByText("删除书签 3")).toBeInTheDocument();
    });
  });
});

describe("AIActionFeedbackInline", () => {
  const mockConfirmation: ConfirmationInfo = {
    message: "为选中的书签添加标签",
    affectedCount: 3,
    reversible: true,
    actions: ["添加标签: React", "添加标签: TypeScript"],
  };

  const defaultProps = {
    actionType: "tag:batch_add" as const,
    confirmation: mockConfirmation,
    onConfirm: jest.fn(),
    onReject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render inline feedback component", () => {
    render(<AIActionFeedbackInline {...defaultProps} />);

    expect(screen.getByText("批量添加标签")).toBeInTheDocument();
    expect(screen.getByText("为选中的书签添加标签")).toBeInTheDocument();
    expect(screen.getByText("中风险")).toBeInTheDocument();
  });

  it("should show affected count and reversible status", () => {
    render(<AIActionFeedbackInline {...defaultProps} />);

    expect(screen.getByText("影响 3 个项目")).toBeInTheDocument();
    expect(screen.getByText("可撤销")).toBeInTheDocument();
  });

  it("should show non-reversible warning", () => {
    render(
      <AIActionFeedbackInline
        {...defaultProps}
        confirmation={{ ...mockConfirmation, reversible: false }}
      />,
    );

    expect(screen.getByText("不可撤销")).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button clicked", () => {
    render(<AIActionFeedbackInline {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /确认执行/i }));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("should call onReject when cancel button clicked", () => {
    render(<AIActionFeedbackInline {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /取消/i }));

    expect(defaultProps.onReject).toHaveBeenCalled();
  });

  it("should disable buttons when executing", () => {
    render(<AIActionFeedbackInline {...defaultProps} isExecuting={true} />);

    expect(screen.getByRole("button", { name: /取消/i })).toBeDisabled();
    expect(screen.getByText("执行中")).toBeInTheDocument();
  });

  it("should show confirmed state when handled with result confirmed", () => {
    render(
      <AIActionFeedbackInline
        {...defaultProps}
        isHandled={true}
        result="confirmed"
      />,
    );

    expect(screen.getByText(/已确认执行「批量添加标签」/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /确认执行/i }),
    ).not.toBeInTheDocument();
  });

  it("should show rejected state when handled with result rejected", () => {
    render(
      <AIActionFeedbackInline
        {...defaultProps}
        isHandled={true}
        result="rejected"
      />,
    );

    expect(screen.getByText(/已取消「批量添加标签」/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /取消/i }),
    ).not.toBeInTheDocument();
  });

  it("should toggle action details when clicked", () => {
    render(<AIActionFeedbackInline {...defaultProps} />);

    // Initially details should be hidden
    expect(screen.queryByText("添加标签: React")).not.toBeInTheDocument();

    // Click to show details
    fireEvent.click(screen.getByText(/查看详情/i));

    // Details should be visible
    expect(screen.getByText("添加标签: React")).toBeInTheDocument();
    expect(screen.getByText("添加标签: TypeScript")).toBeInTheDocument();
  });
});
