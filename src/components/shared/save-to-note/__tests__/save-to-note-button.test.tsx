/**
 * SaveToNoteButton 组件测试
 *
 * @description 测试保存到笔记按钮的渲染、交互和状态变化
 * @version 1.0.0
 * @since 2026-01-08
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveToNoteButton } from "../save-to-note-button";
import type { SaveButtonState, DuplicateInfo } from "../types";

// Mock ResizeObserver (required by Radix UI)
class MockResizeObserver {
  observe(): void {
    // noop for testing
  }
  unobserve(): void {
    // noop for testing
  }
  disconnect(): void {
    // noop for testing
  }
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Configure React 18 act environment
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Mock useSaveToNote hook
const mockSave = jest.fn();
const mockSaveAnyway = jest.fn();
const mockReset = jest.fn();

let mockState: SaveButtonState = "idle";
let mockDuplicateInfo: DuplicateInfo | null = null;
let mockSavedNote: { id: number; title: string } | null = null;
let mockError: Error | null = null;

interface UseSaveToNoteOptions {
  onSuccess?: (noteId: number, noteTitle: string) => void;
  onError?: (error: Error) => void;
}

jest.mock("@/hooks/use-save-to-note", () => ({
  useSaveToNote: jest.fn((options?: UseSaveToNoteOptions) => {
    // Store callbacks for later invocation
    (global as Record<string, unknown>).__savedCallbacks = options;
    return {
      state: mockState,
      duplicateInfo: mockDuplicateInfo,
      savedNote: mockSavedNote,
      error: mockError,
      save: mockSave,
      saveAnyway: mockSaveAnyway,
      reset: mockReset,
    };
  }),
}));

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    custom: jest.fn(),
    dismiss: jest.fn(),
  },
}));

// Mock window.open
const mockWindowOpen = jest.fn();
global.open = mockWindowOpen;

describe("SaveToNoteButton", () => {
  const defaultProps = {
    content: "测试内容",
    sourceType: "ai_response" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockState = "idle";
    mockDuplicateInfo = null;
    mockSavedNote = null;
    mockError = null;
  });

  describe("初始渲染", () => {
    it("默认变体渲染按钮和文字", () => {
      render(<SaveToNoteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(screen.getByText("保存")).toBeInTheDocument();
    });

    it("icon 变体只渲染图标", () => {
      render(<SaveToNoteButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(screen.queryByText("保存")).not.toBeInTheDocument();
    });

    it("应用自定义 className", () => {
      render(<SaveToNoteButton {...defaultProps} className="custom-class" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });

    it("禁用时按钮不可点击", () => {
      render(<SaveToNoteButton {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("点击行为", () => {
    it("点击时调用 save 方法并传入正确参数", async () => {
      render(<SaveToNoteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(mockSave).toHaveBeenCalledWith({
        content: "测试内容",
        sourceType: "ai_response",
        sourceId: undefined,
        sourceConversationId: undefined,
        customTitle: undefined,
      });
    });

    it("传入 sourceId 时正确传递", async () => {
      render(
        <SaveToNoteButton
          {...defaultProps}
          sourceId="msg-123"
          sourceConversationId="conv-456"
        />,
      );

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(mockSave).toHaveBeenCalledWith({
        content: "测试内容",
        sourceType: "ai_response",
        sourceId: "msg-123",
        sourceConversationId: "conv-456",
        customTitle: undefined,
      });
    });

    it("传入 suggestedTitle 时作为 customTitle 传递", async () => {
      render(<SaveToNoteButton {...defaultProps} suggestedTitle="建议标题" />);

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(mockSave).toHaveBeenCalledWith({
        content: "测试内容",
        sourceType: "ai_response",
        sourceId: undefined,
        sourceConversationId: undefined,
        customTitle: "建议标题",
      });
    });

    it("禁用状态下点击不触发 save", async () => {
      render(<SaveToNoteButton {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it("非 idle 状态下点击不触发 save", async () => {
      mockState = "saving";
      render(<SaveToNoteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe("状态显示", () => {
    it("idle 状态显示保存图标和文字", () => {
      mockState = "idle";
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("保存")).toBeInTheDocument();
    });

    it("checking 状态显示检查中", () => {
      mockState = "checking";
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("检查中")).toBeInTheDocument();
    });

    it("generating 状态显示生成标题", () => {
      mockState = "generating";
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("生成标题")).toBeInTheDocument();
    });

    it("saving 状态显示保存中", () => {
      mockState = "saving";
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("保存中")).toBeInTheDocument();
    });

    it("success 状态显示已保存", () => {
      mockState = "success";
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("已保存")).toBeInTheDocument();
    });

    it("error 状态显示失败", () => {
      mockState = "error";
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("失败")).toBeInTheDocument();
    });

    it("loading 状态下按钮禁用", () => {
      mockState = "saving";
      render(<SaveToNoteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("error 状态下按钮可点击以重试", () => {
      mockState = "error";
      render(<SaveToNoteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).not.toBeDisabled();
    });
  });

  describe("重复检测弹窗", () => {
    it("检测到重复时显示警告弹窗", () => {
      mockDuplicateInfo = {
        id: 123,
        title: "已存在的笔记",
        savedAt: "2026-01-08T00:00:00Z",
      };
      render(<SaveToNoteButton {...defaultProps} />);

      expect(screen.getByText("相似内容已存在")).toBeInTheDocument();
      expect(screen.getByText("已存在的笔记")).toBeInTheDocument();
    });

    it("点击查看已有跳转并重置状态", async () => {
      mockDuplicateInfo = {
        id: 123,
        title: "已存在的笔记",
        savedAt: "2026-01-08T00:00:00Z",
      };
      render(<SaveToNoteButton {...defaultProps} />);

      const viewButton = screen.getByRole("button", { name: /查看已有/i });
      await userEvent.click(viewButton);

      expect(mockWindowOpen).toHaveBeenCalledWith(
        "/md-collections/123",
        "_blank",
      );
      expect(mockReset).toHaveBeenCalled();
    });

    it("点击仍然保存调用 saveAnyway", async () => {
      mockDuplicateInfo = {
        id: 123,
        title: "已存在的笔记",
        savedAt: "2026-01-08T00:00:00Z",
      };
      render(<SaveToNoteButton {...defaultProps} />);

      const saveAnywayButton = screen.getByRole("button", {
        name: /仍然保存/i,
      });
      await userEvent.click(saveAnywayButton);

      expect(mockSaveAnyway).toHaveBeenCalledWith({
        content: "测试内容",
        sourceType: "ai_response",
        sourceId: undefined,
        sourceConversationId: undefined,
        customTitle: undefined,
      });
    });
  });

  describe("回调函数", () => {
    it("保存成功时调用 onSaveSuccess", async () => {
      const onSaveSuccess = jest.fn();
      render(
        <SaveToNoteButton {...defaultProps} onSaveSuccess={onSaveSuccess} />,
      );

      // Get the stored callbacks from hook initialization
      const callbacks = (global as Record<string, unknown>)
        .__savedCallbacks as {
        onSuccess?: (noteId: number, noteTitle: string) => void;
      };

      // Simulate success callback
      if (callbacks?.onSuccess) {
        callbacks.onSuccess(123, "生成的标题");
      }

      expect(onSaveSuccess).toHaveBeenCalledWith(123, "生成的标题");
    });

    it("保存失败时调用 onSaveError", async () => {
      const onSaveError = jest.fn();
      render(<SaveToNoteButton {...defaultProps} onSaveError={onSaveError} />);

      // Get the stored callbacks from hook initialization
      const callbacks = (global as Record<string, unknown>)
        .__savedCallbacks as {
        onError?: (error: Error) => void;
      };

      const testError = new Error("保存失败");
      // Simulate error callback
      if (callbacks?.onError) {
        callbacks.onError(testError);
      }

      expect(onSaveError).toHaveBeenCalledWith(testError);
    });
  });

  describe("Tooltip", () => {
    it("悬停时显示 Tooltip", async () => {
      render(<SaveToNoteButton {...defaultProps} />);

      const button = screen.getByRole("button");
      await userEvent.hover(button);

      await waitFor(() => {
        // Radix UI Tooltip renders text multiple times for accessibility
        const tooltipTexts = screen.getAllByText("保存到我的笔记");
        expect(tooltipTexts.length).toBeGreaterThan(0);
      });
    });
  });

  describe("不同来源类型", () => {
    const sourceTypes = [
      "ai_response",
      "deliverable",
      "synthesis",
      "report",
    ] as const;

    sourceTypes.forEach((sourceType) => {
      it(`正确处理 ${sourceType} 来源类型`, async () => {
        render(<SaveToNoteButton content="内容" sourceType={sourceType} />);

        const button = screen.getByRole("button");
        await userEvent.click(button);

        expect(mockSave).toHaveBeenCalledWith(
          expect.objectContaining({ sourceType }),
        );
      });
    });
  });

  describe("icon 变体行为", () => {
    it("icon 变体使用较小尺寸", () => {
      render(<SaveToNoteButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-7", "w-7");
    });

    it("icon 变体正确响应状态变化", () => {
      mockState = "saving";
      render(<SaveToNoteButton {...defaultProps} variant="icon" />);

      // Should not show text in icon variant
      expect(screen.queryByText("保存中")).not.toBeInTheDocument();
    });
  });
});
