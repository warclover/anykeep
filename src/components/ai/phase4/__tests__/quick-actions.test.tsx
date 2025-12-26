/**
 * QuickActions (MessageActionsBar) 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MessageActionsBar, InlineActions } from "../quick-actions";

// =============================================================================
// Mock navigator.clipboard
// =============================================================================

const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

// =============================================================================
// Mock fetch for save to note
// =============================================================================

const mockFetch = jest.fn();
global.fetch = mockFetch;

// =============================================================================
// MessageActionsBar 测试
// =============================================================================

describe("MessageActionsBar", () => {
  const defaultProps = {
    messageId: "msg-123",
    content: "This is test content for the message",
    onRegenerate: jest.fn(),
    onSave: jest.fn(),
    onExport: jest.fn(),
    onFeedback: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  it("should render action buttons", () => {
    render(<MessageActionsBar {...defaultProps} />);

    // 按钮是图标按钮，通过获取所有按钮验证渲染
    const buttons = screen.getAllByRole("button");
    // 应该有至少 6 个按钮：复制、重新生成、保存、导出、有帮助、无帮助
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });

  it("should copy content to clipboard when first button is clicked", async () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // 第一个按钮是复制按钮
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        defaultProps.content,
      );
    });
  });

  it("should call onRegenerate when second button is clicked", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // 第二个按钮是重新生成按钮
    fireEvent.click(buttons[1]);

    expect(defaultProps.onRegenerate).toHaveBeenCalled();
  });

  it("should call onExport when export button is clicked", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // 第四个按钮是导出按钮
    fireEvent.click(buttons[3]);

    expect(defaultProps.onExport).toHaveBeenCalled();
  });

  it("should show save dialog when save button is clicked", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // 第三个按钮是保存按钮
    fireEvent.click(buttons[2]);

    expect(screen.getByText("保存到笔记")).toBeInTheDocument();
  });

  it("should call onFeedback with like when thumbs up is clicked", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // 倒数第二个按钮是有帮助（点赞）
    const likeButton = buttons[buttons.length - 2];
    fireEvent.click(likeButton);

    expect(defaultProps.onFeedback).toHaveBeenCalledWith("like");
  });

  it("should show feedback dialog when thumbs down is clicked", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // 最后一个按钮是无帮助（踩）
    const dislikeButton = buttons[buttons.length - 1];
    fireEvent.click(dislikeButton);

    // 检查对话框是否出现
    expect(screen.getByText("告诉我们哪里可以改进")).toBeInTheDocument();
  });

  it("should highlight like button when feedbackGiven is like", () => {
    render(<MessageActionsBar {...defaultProps} feedbackGiven="like" />);

    const buttons = screen.getAllByRole("button");
    const likeButton = buttons[buttons.length - 2];
    expect(likeButton).toHaveClass("text-green-500");
  });

  it("should highlight dislike button when feedbackGiven is dislike", () => {
    render(<MessageActionsBar {...defaultProps} feedbackGiven="dislike" />);

    const buttons = screen.getAllByRole("button");
    const dislikeButton = buttons[buttons.length - 1];
    expect(dislikeButton).toHaveClass("text-red-500");
  });
});

// =============================================================================
// Feedback Dialog 测试
// =============================================================================

describe("FeedbackDialog", () => {
  const defaultProps = {
    messageId: "msg-123",
    content: "Test content",
    onFeedback: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show feedback reasons", () => {
    render(<MessageActionsBar {...defaultProps} />);

    // 打开反馈对话框
    const buttons = screen.getAllByRole("button");
    const dislikeButton = buttons[buttons.length - 1];
    fireEvent.click(dislikeButton);

    expect(screen.getByText("理解错了我的意图")).toBeInTheDocument();
    expect(screen.getByText("结果不准确")).toBeInTheDocument();
    expect(screen.getByText("格式或排版不好")).toBeInTheDocument();
    expect(screen.getByText("回答不完整")).toBeInTheDocument();
    expect(screen.getByText("其他原因")).toBeInTheDocument();
  });

  it("should disable submit when no reason is selected", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    const dislikeButton = buttons[buttons.length - 1];
    fireEvent.click(dislikeButton);

    const submitButton = screen.getByRole("button", { name: /提交反馈/i });
    expect(submitButton).toBeDisabled();
  });

  it("should enable submit when reason is selected", () => {
    render(<MessageActionsBar {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    const dislikeButton = buttons[buttons.length - 1];
    fireEvent.click(dislikeButton);

    // 选择一个原因
    const reasonCheckbox = screen.getByLabelText("结果不准确");
    fireEvent.click(reasonCheckbox);

    const submitButton = screen.getByRole("button", { name: /提交反馈/i });
    expect(submitButton).not.toBeDisabled();
  });

  it("should call onFeedback with details when submitted", () => {
    render(<MessageActionsBar {...defaultProps} />);

    // 打开对话框
    const buttons = screen.getAllByRole("button");
    const dislikeButton = buttons[buttons.length - 1];
    fireEvent.click(dislikeButton);

    // 选择原因
    const reasonCheckbox = screen.getByLabelText("结果不准确");
    fireEvent.click(reasonCheckbox);

    // 添加评论
    const commentInput = screen.getByPlaceholderText("请描述具体问题...");
    fireEvent.change(commentInput, { target: { value: "Test comment" } });

    // 提交
    const submitButton = screen.getByRole("button", { name: /提交反馈/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onFeedback).toHaveBeenCalledWith("dislike", {
      reasons: ["inaccurate_result"],
      comment: "Test comment",
    });
  });
});

// =============================================================================
// InlineActions 测试
// =============================================================================

describe("InlineActions", () => {
  const mockOnCopy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  it("should render copy button", () => {
    render(<InlineActions content="Test content" />);

    expect(screen.getByText("复制")).toBeInTheDocument();
  });

  it("should copy content when clicked", async () => {
    render(<InlineActions content="Test content" onCopy={mockOnCopy} />);

    const copyButton = screen.getByRole("button");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith("Test content");
      expect(mockOnCopy).toHaveBeenCalled();
    });
  });

  it("should show '已复制' after copy", async () => {
    render(<InlineActions content="Test content" />);

    const copyButton = screen.getByRole("button");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText("已复制")).toBeInTheDocument();
    });
  });
});
