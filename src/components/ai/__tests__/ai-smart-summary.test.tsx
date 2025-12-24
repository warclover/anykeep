/**
 * AISmartSummary Component Tests
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AISmartSummary } from "../ai-smart-summary";

// Mock fetch
global.fetch = jest.fn();

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
    render(<AISmartSummary {...defaultProps} />);

    expect(
      screen.getByText("This is an existing summary for testing."),
    ).toBeInTheDocument();
  });

  it("renders card header with title", () => {
    render(<AISmartSummary {...defaultProps} />);

    // Component uses "AI 摘要" as title
    expect(screen.getByText("AI 摘要")).toBeInTheDocument();
    expect(screen.getByText("智能生成的内容概述")).toBeInTheDocument();
  });

  it("shows action buttons when not readonly and summary exists", () => {
    render(<AISmartSummary {...defaultProps} readonly={false} />);

    // Should have buttons (copy, edit, regenerate)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("hides edit and regenerate buttons when readonly", () => {
    render(<AISmartSummary {...defaultProps} readonly={true} />);

    // Only copy button should be visible when readonly with summary
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1); // Only copy button
  });

  it("shows empty state when no summary exists", () => {
    render(
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
    render(<AISmartSummary {...defaultProps} readonly={false} />);

    // Find edit button (second button, after copy)
    const buttons = screen.getAllByRole("button");
    // First button is copy, second is edit
    const editButton = buttons[1];
    fireEvent.click(editButton);

    // Should show textarea
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("保存")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
  });

  it("cancels edit mode when cancel button is clicked", () => {
    render(<AISmartSummary {...defaultProps} readonly={false} />);

    // Enter edit mode
    const buttons = screen.getAllByRole("button");
    const editButton = buttons[1];
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

    render(
      <AISmartSummary
        {...defaultProps}
        readonly={false}
        onSummaryUpdate={onSummaryUpdate}
      />,
    );

    // Enter edit mode
    const buttons = screen.getAllByRole("button");
    const editButton = buttons[1];
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

    render(<AISmartSummary {...defaultProps} readonly={false} />);

    // Find regenerate button (third button, after copy and edit)
    const buttons = screen.getAllByRole("button");
    const regenerateButton = buttons[2];
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

    render(
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
    render(<AISmartSummary {...defaultProps} />);

    // First button is copy
    const buttons = screen.getAllByRole("button");
    const copyButton = buttons[0];
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

    render(<AISmartSummary {...defaultProps} readonly={false} />);

    const buttons = screen.getAllByRole("button");
    const regenerateButton = buttons[2];
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(screen.getByText("生成失败")).toBeInTheDocument();
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <AISmartSummary {...defaultProps} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
