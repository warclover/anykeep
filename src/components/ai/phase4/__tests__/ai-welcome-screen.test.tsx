/**
 * AIWelcomeScreen 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { AIWelcomeScreen } from "../ai-welcome-screen";

describe("AIWelcomeScreen", () => {
  const mockSetInput = jest.fn();

  beforeEach(() => {
    mockSetInput.mockClear();
  });

  it("should render welcome message", () => {
    render(<AIWelcomeScreen onSetInput={mockSetInput} />);

    expect(screen.getByText("你好！我是你的 AI 助手 ✨")).toBeInTheDocument();
    expect(screen.getByText("有什么可以帮你的吗？")).toBeInTheDocument();
  });

  it("should render all quick action buttons", () => {
    render(<AIWelcomeScreen onSetInput={mockSetInput} />);

    expect(screen.getByText("搜索收藏")).toBeInTheDocument();
    expect(screen.getByText("知识复习")).toBeInTheDocument();
    expect(screen.getByText("查看文件夹")).toBeInTheDocument();
    expect(screen.getByText("统计分析")).toBeInTheDocument();
  });

  it("should call onSetInput when search button is clicked", () => {
    render(<AIWelcomeScreen onSetInput={mockSetInput} />);

    fireEvent.click(screen.getByText("搜索收藏"));

    expect(mockSetInput).toHaveBeenCalledWith("搜索关于 AI 的文章");
  });

  it("should call onSetInput when review button is clicked", () => {
    render(<AIWelcomeScreen onSetInput={mockSetInput} />);

    fireEvent.click(screen.getByText("知识复习"));

    expect(mockSetInput).toHaveBeenCalledWith("帮我制定知识复习计划");
  });

  it("should call onSetInput when folder button is clicked", () => {
    render(<AIWelcomeScreen onSetInput={mockSetInput} />);

    fireEvent.click(screen.getByText("查看文件夹"));

    expect(mockSetInput).toHaveBeenCalledWith("我有哪些文件夹");
  });

  it("should call onSetInput when stats button is clicked", () => {
    render(<AIWelcomeScreen onSetInput={mockSetInput} />);

    fireEvent.click(screen.getByText("统计分析"));

    expect(mockSetInput).toHaveBeenCalledWith("统计我的收藏情况");
  });
});
