/**
 * ActionConfirmation 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { render, screen, fireEvent } from "@testing-library/react";
import {
  ActionConfirmation,
  ExecutionProgress,
  UndoToast,
  evaluateRisk,
  generateSummaries,
} from "../action-confirmation";
import type { OrganizeAction } from "../types";

// =============================================================================
// ActionConfirmation 组件测试
// =============================================================================

describe("ActionConfirmation", () => {
  const mockOnConfirm = jest.fn();
  const mockOnAdjust = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultActions: OrganizeAction[] = [
    {
      type: "move",
      targets: [1, 2, 3],
      params: { folderId: 10, folderName: "学习笔记" },
    },
    {
      type: "tag",
      targets: [4, 5],
      params: { tags: ["重要", "待读"] },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render title", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("整理方案")).toBeInTheDocument();
  });

  it("should show total item count", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("5 项内容")).toBeInTheDocument();
  });

  it("should show action summaries", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText(/移动到.*学习笔记/)).toBeInTheDocument();
    expect(screen.getByText(/3 个书签/)).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /确认执行/i });
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it("should call onAdjust when adjust button is clicked", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    const adjustButton = screen.getByRole("button", { name: /调整方案/i });
    fireEvent.click(adjustButton);

    expect(mockOnAdjust).toHaveBeenCalled();
  });

  it("should call onCancel when cancel button is clicked", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /取消/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("should show low risk indicator for safe operations", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("低风险")).toBeInTheDocument();
  });

  it("should show high risk indicator for delete operations", () => {
    const deleteActions: OrganizeAction[] = [
      {
        type: "delete",
        targets: Array.from({ length: 60 }, (_, i) => i + 1),
        params: {},
      },
    ];

    render(
      <ActionConfirmation
        title="删除方案"
        actions={deleteActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("高风险")).toBeInTheDocument();
  });

  it("should require input confirmation for critical operations", () => {
    const criticalActions: OrganizeAction[] = [
      {
        type: "delete",
        targets: [1, 2, 3],
        params: { permanent: true },
      },
    ];

    render(
      <ActionConfirmation
        title="永久删除"
        actions={criticalActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("危险操作")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/输入 DELETE 确认/i),
    ).toBeInTheDocument();
  });

  it("should disable confirm button until correct input for critical operations", () => {
    const criticalActions: OrganizeAction[] = [
      {
        type: "delete",
        targets: [1, 2, 3],
        params: { permanent: true },
      },
    ];

    render(
      <ActionConfirmation
        title="永久删除"
        actions={criticalActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /确认删除/i });
    expect(confirmButton).toBeDisabled();

    // 输入正确的确认文字
    const input = screen.getByPlaceholderText(/输入 DELETE 确认/i);
    fireEvent.change(input, { target: { value: "DELETE" } });

    expect(confirmButton).not.toBeDisabled();
  });

  it("should disable buttons when isExecuting is true", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
        isExecuting
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /执行中/i });
    expect(confirmButton).toBeDisabled();

    const cancelButton = screen.getByRole("button", { name: /取消/i });
    expect(cancelButton).toBeDisabled();
  });

  it("should toggle details visibility", () => {
    render(
      <ActionConfirmation
        title="整理方案"
        actions={defaultActions}
        onConfirm={mockOnConfirm}
        onAdjust={mockOnAdjust}
        onCancel={mockOnCancel}
      />,
    );

    const detailsButton = screen.getByRole("button", { name: /查看详细操作/i });

    // 初始状态应该是收起的
    expect(detailsButton).toHaveAttribute("data-state", "closed");

    // 点击展开
    fireEvent.click(detailsButton);

    // 展开后状态应该变为 open
    expect(detailsButton).toHaveAttribute("data-state", "open");
  });
});

// =============================================================================
// ExecutionProgress 组件测试
// =============================================================================

describe("ExecutionProgress", () => {
  it("should show progress percentage", () => {
    render(
      <ExecutionProgress
        currentStep={2}
        totalSteps={4}
        completedCount={5}
        totalCount={10}
      />,
    );

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("should show step counter", () => {
    render(
      <ExecutionProgress
        currentStep={2}
        totalSteps={4}
        completedCount={5}
        totalCount={10}
      />,
    );

    expect(screen.getByText("步骤 2/4")).toBeInTheDocument();
  });

  it("should show current action when provided", () => {
    render(
      <ExecutionProgress
        currentStep={2}
        totalSteps={4}
        currentAction="正在移动书签..."
        completedCount={5}
        totalCount={10}
      />,
    );

    expect(screen.getByText("正在移动书签...")).toBeInTheDocument();
  });

  it("should show completed count", () => {
    render(
      <ExecutionProgress
        currentStep={2}
        totalSteps={4}
        completedCount={5}
        totalCount={10}
      />,
    );

    expect(screen.getByText("已处理 5 / 10 项")).toBeInTheDocument();
  });
});

// =============================================================================
// UndoToast 组件测试
// =============================================================================

describe("UndoToast", () => {
  const mockOnUndo = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show message", () => {
    render(
      <UndoToast
        message="已移动 5 个书签"
        timeRemaining="23 小时"
        onUndo={mockOnUndo}
        onDismiss={mockOnDismiss}
      />,
    );

    expect(screen.getByText("已移动 5 个书签")).toBeInTheDocument();
  });

  it("should show time remaining", () => {
    render(
      <UndoToast
        message="已移动 5 个书签"
        timeRemaining="23 小时"
        onUndo={mockOnUndo}
        onDismiss={mockOnDismiss}
      />,
    );

    expect(screen.getByText("23 小时 内可撤销")).toBeInTheDocument();
  });

  it("should call onUndo when undo button is clicked", () => {
    render(
      <UndoToast
        message="已移动 5 个书签"
        timeRemaining="23 小时"
        onUndo={mockOnUndo}
        onDismiss={mockOnDismiss}
      />,
    );

    const undoButton = screen.getByRole("button", { name: /撤销/i });
    fireEvent.click(undoButton);

    expect(mockOnUndo).toHaveBeenCalled();
  });

  it("should call onDismiss when close button is clicked", () => {
    render(
      <UndoToast
        message="已移动 5 个书签"
        timeRemaining="23 小时"
        onUndo={mockOnUndo}
        onDismiss={mockOnDismiss}
      />,
    );

    const closeButton = screen.getByRole("button", { name: /关闭/i });
    fireEvent.click(closeButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });
});

// =============================================================================
// 辅助函数测试
// =============================================================================

describe("evaluateRisk", () => {
  it("should return low risk for simple move operations", () => {
    const actions: OrganizeAction[] = [
      { type: "move", targets: [1, 2, 3], params: {} },
    ];

    const risk = evaluateRisk(actions);

    expect(risk.level).toBe("low");
    expect(risk.requiresConfirmation).toBe(false);
  });

  it("should return medium risk for delete operations", () => {
    const actions: OrganizeAction[] = [
      { type: "delete", targets: [1, 2, 3], params: {} },
    ];

    const risk = evaluateRisk(actions);

    expect(risk.level).toBe("medium");
    expect(risk.requiresConfirmation).toBe(true);
  });

  it("should return high risk for large delete operations", () => {
    const actions: OrganizeAction[] = [
      {
        type: "delete",
        targets: Array.from({ length: 60 }, (_, i) => i),
        params: {},
      },
    ];

    const risk = evaluateRisk(actions);

    expect(risk.level).toBe("high");
  });

  it("should return critical risk for permanent delete", () => {
    const actions: OrganizeAction[] = [
      { type: "delete", targets: [1, 2, 3], params: { permanent: true } },
    ];

    const risk = evaluateRisk(actions);

    expect(risk.level).toBe("critical");
    expect(risk.requiresInput).toBe("DELETE");
  });

  it("should return medium risk for bulk operations over 100 items", () => {
    const actions: OrganizeAction[] = [
      {
        type: "tag",
        targets: Array.from({ length: 120 }, (_, i) => i),
        params: {},
      },
    ];

    const risk = evaluateRisk(actions);

    expect(risk.level).toBe("medium");
  });
});

describe("generateSummaries", () => {
  it("should generate summaries for each action type", () => {
    const actions: OrganizeAction[] = [
      {
        type: "move",
        targets: [1, 2, 3],
        params: { folderName: "Test Folder" },
      },
      { type: "tag", targets: [4, 5], params: { tags: ["tag1", "tag2"] } },
    ];

    const summaries = generateSummaries(actions);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].type).toBe("move");
    expect(summaries[0].count).toBe(3);
    expect(summaries[1].type).toBe("tag");
    expect(summaries[1].count).toBe(2);
  });

  it("should aggregate same action types", () => {
    const actions: OrganizeAction[] = [
      { type: "move", targets: [1, 2], params: { folderName: "Folder A" } },
      { type: "move", targets: [3, 4, 5], params: { folderName: "Folder A" } },
    ];

    const summaries = generateSummaries(actions);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].count).toBe(5);
  });
});
