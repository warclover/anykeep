/**
 * AISmartSummary Component Tests
 *
 * @version 1.0.1
 * @since 2025-12-22
 * @updated 2026-01-30 - V4.2.8: 添加 TTSPlayerProvider 上下文包装
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AISmartSummary } from "../ai-smart-summary";
import { TTSPlayerProvider } from "@/components/tts";

// Mock fetch
global.fetch = jest.fn();

/**
 * V4.2.8: 测试包装器，提供必需的 Context
 */
function TestWrapper({ children }: { children: ReactNode }) {
  return <TTSPlayerProvider>{children}</TTSPlayerProvider>;
}

/**
 * 使用 TTSPlayerProvider 包装的 render 函数
 */
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe("AISmartSummary", () => {
  const defaultProps = {
    bookmarkId: 1,
    existingSummary: "This is an existing summary for testing.",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders existing summary when provided", () => {
    renderWithProviders(<AISmartSummary {...defaultProps} />);

    expect(
      screen.getByText("This is an existing summary for testing."),
    ).toBeInTheDocument();
  });

  it("renders card header with title", () => {
    renderWithProviders(<AISmartSummary {...defaultProps} />);

    // Component uses "AI 摘要" as title
    expect(screen.getByText("AI 摘要")).toBeInTheDocument();
    expect(screen.getByText("智能生成的内容概述")).toBeInTheDocument();
  });

  it("shows action buttons when not readonly and summary exists", () => {
    renderWithProviders(<AISmartSummary {...defaultProps} readonly={false} />);

    // Should have buttons (copy, edit, regenerate)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("hides edit and regenerate buttons when readonly", () => {
    renderWithProviders(<AISmartSummary {...defaultProps} readonly={true} />);

    // V4.2.8: readonly 模式下显示 TTS 按钮 + Copy 按钮 = 2个
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2); // TTS + Copy buttons
  });

  it("shows empty state when no summary exists", () => {
    renderWithProviders(
      <AISmartSummary
        {...defaultProps}
        existingSummary={null}
        readonly={false}
      />,
    );

    // Component shows "还没有摘要，让 AI 帮你生成"
    expect(screen.getByText("还没有摘要，让 AI 帮你生成")).toBeInTheDocument();
    expect(screen.getByText("生成摘要")).toBeInTheDocument();
  });

  it("enters edit mode when edit button is clicked", () => {
    renderWithProviders(<AISmartSummary {...defaultProps} readonly={false} />);

    // V4.2.8: Find edit button (3rd button: TTS, Copy, Edit, Regenerate)
    const buttons = screen.getAllByRole("button");
    const editButton = buttons[2];
    fireEvent.click(editButton);

    // Should show textarea
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("保存")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
  });

  it("cancels edit mode when cancel button is clicked", () => {
    renderWithProviders(<AISmartSummary {...defaultProps} readonly={false} />);

    // V4.2.8: Enter edit mode (3rd button: TTS, Copy, Edit, Regenerate)
    const buttons = screen.getAllByRole("button");
    const editButton = buttons[2];
    fireEvent.click(editButton);

    // Click cancel
    const cancelButton = screen.getByText("取消");
    fireEvent.click(cancelButton);

    // Should exit edit mode
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByText("This is an existing summary for testing."),
    ).toBeInTheDocument();
  });

  it("saves edited summary and calls onSummaryUpdate", () => {
    const onSummaryUpdate = jest.fn();

    renderWithProviders(
      <AISmartSummary
        {...defaultProps}
        readonly={false}
        onSummaryUpdate={onSummaryUpdate}
      />,
    );

    // V4.2.8: Enter edit mode (3rd button: TTS, Copy, Edit, Regenerate)
    const buttons = screen.getAllByRole("button");
    const editButton = buttons[2];
    fireEvent.click(editButton);

    // Change summary
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated summary text" } });

    // Save
    const saveButton = screen.getByText("保存");
    fireEvent.click(saveButton);

    // onSummaryUpdate should be called (not fetch)
    expect(onSummaryUpdate).toHaveBeenCalledWith("Updated summary text");

    // Should show updated summary
    expect(screen.getByText("Updated summary text")).toBeInTheDocument();
  });

  it("regenerates summary when regenerate button is clicked", async () => {
    // Mock streaming response
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'data: {"type":"text","text":"New summary"}\n',
          ),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    renderWithProviders(<AISmartSummary {...defaultProps} readonly={false} />);

    // V4.2.8: Find regenerate button (4th button: TTS, Copy, Edit, Regenerate)
    const buttons = screen.getAllByRole("button");
    const regenerateButton = buttons[3];
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/agent/unified",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  it("generates summary from empty state", async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'data: {"type":"text","text":"Generated summary"}\n',
          ),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    renderWithProviders(
      <AISmartSummary bookmarkId={1} existingSummary={null} readonly={false} />,
    );

    // Click generate button in empty state
    const generateButton = screen.getByText("生成摘要");
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/agent/unified",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  it("copies summary to clipboard", async () => {
    renderWithProviders(<AISmartSummary {...defaultProps} />);

    // V4.2.8: Second button is copy (1st: TTS, 2nd: Copy)
    const buttons = screen.getAllByRole("button");
    const copyButton = buttons[1];
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "This is an existing summary for testing.",
      );
    });
  });

  it("shows error message when generation fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "生成失败" }),
    });

    renderWithProviders(<AISmartSummary {...defaultProps} readonly={false} />);

    // V4.2.8: 4th button is regenerate (TTS, Copy, Edit, Regenerate)
    const buttons = screen.getAllByRole("button");
    const regenerateButton = buttons[3];
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(screen.getByText("生成失败")).toBeInTheDocument();
    });
  });

  it("applies custom className", () => {
    const { container } = renderWithProviders(
      <AISmartSummary {...defaultProps} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
