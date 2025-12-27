/**
 * KeyboardNavHelp 组件单元测试
 * Spec: md-reader-upgrade / REQ-9
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardNavHelp } from "../keyboard-nav-help";

describe("KeyboardNavHelp", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("渲染", () => {
    it("isOpen=true 时渲染对话框", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("键盘快捷键")).toBeInTheDocument();
    });

    it("isOpen=false 时不渲染内容", () => {
      render(<KeyboardNavHelp {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("键盘快捷键")).not.toBeInTheDocument();
    });
  });

  describe("快捷键分类", () => {
    it("显示导航分类", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("导航")).toBeInTheDocument();
    });

    it("显示模式分类", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("模式")).toBeInTheDocument();
    });

    it("显示其他分类", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("其他")).toBeInTheDocument();
    });
  });

  describe("快捷键内容", () => {
    it("显示导航快捷键 J/K", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("J")).toBeInTheDocument();
      expect(screen.getByText("K")).toBeInTheDocument();
    });

    it("显示方向键", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("↓")).toBeInTheDocument();
      expect(screen.getByText("↑")).toBeInTheDocument();
    });

    it("显示专注模式快捷键 F", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("F")).toBeInTheDocument();
    });

    it("显示退出快捷键 Esc", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      // 多个 "Esc" 元素存在（快捷键列表和底部提示）
      const escElements = screen.getAllByText("Esc");
      expect(escElements.length).toBeGreaterThanOrEqual(1);
    });

    it("显示帮助快捷键 ?", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("显示目录切换快捷键 T", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("T")).toBeInTheDocument();
    });
  });

  describe("快捷键描述", () => {
    it("显示章节导航描述", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("下一章节")).toBeInTheDocument();
      expect(screen.getByText("上一章节")).toBeInTheDocument();
    });

    it("显示专注模式描述", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("切换专注模式")).toBeInTheDocument();
    });

    it("显示退出描述", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("退出当前模式")).toBeInTheDocument();
    });

    it("显示目录描述", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("切换目录")).toBeInTheDocument();
    });
  });

  describe("关闭行为", () => {
    it("点击关闭按钮触发 onClose", () => {
      const onClose = jest.fn();
      render(<KeyboardNavHelp isOpen={true} onClose={onClose} />);

      // 查找关闭按钮（DialogClose 或 X 按钮）
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("样式", () => {
    it("应用自定义 className 到 DialogContent", () => {
      render(
        <KeyboardNavHelp {...defaultProps} className="custom-test-class" />,
      );

      // 使用 getByRole 找到 dialog，className 应用在 DialogContent 上
      const dialog = screen.getByRole("dialog");
      // 检查 dialog 内部是否有包含 custom-test-class 的元素
      const dialogContent = dialog.querySelector(
        '[class*="custom-test-class"]',
      );
      // 如果 DialogContent 使用 cn()，class 可能在 dialog 本身
      const hasCustomClass =
        dialog.classList.contains("custom-test-class") ||
        dialogContent !== null ||
        dialog.className.includes("custom-test-class");
      expect(hasCustomClass).toBe(true);
    });

    it("快捷键使用 kbd 元素", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      // 检查是否有 kbd 元素（快捷键标签）
      const kbdElements = document.querySelectorAll("kbd");
      expect(kbdElements.length).toBeGreaterThan(0);
    });
  });

  describe("字体大小快捷键", () => {
    it("显示数字键 1-4", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("显示字体大小描述", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByText("字体大小预设")).toBeInTheDocument();
    });
  });

  describe("可访问性", () => {
    it("对话框有正确的 role", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("有标题作为 label", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby");
    });

    it("有描述作为 describedby", () => {
      render(<KeyboardNavHelp {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-describedby");
    });
  });
});
