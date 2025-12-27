/**
 * ReadingProgress 组件单元测试
 * Spec: md-reader-upgrade / REQ-4
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ReadingProgress, ReadingProgressCompact } from "../reading-progress";

describe("ReadingProgress", () => {
  describe("渲染", () => {
    it("正确渲染进度和剩余时间", () => {
      render(<ReadingProgress progress={50} remainingMinutes={5} />);

      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/5 分钟/)).toBeInTheDocument();
    });

    it("显示 Clock 图标", () => {
      const { container } = render(
        <ReadingProgress progress={50} remainingMinutes={5} />,
      );

      // 检查是否有 svg 元素（Lucide 图标）
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("进度显示", () => {
    it("进度 0% 时显示完整剩余时间", () => {
      render(<ReadingProgress progress={0} remainingMinutes={10} />);

      expect(screen.getByText(/0%/)).toBeInTheDocument();
      expect(screen.getByText(/10 分钟/)).toBeInTheDocument();
    });

    it("进度接近完成时显示即将读完", () => {
      render(<ReadingProgress progress={98} remainingMinutes={0.5} />);

      // 进度 >= 95 时显示完成
      expect(screen.getByText(/阅读完成/)).toBeInTheDocument();
    });

    it("进度 100% 时显示完成", () => {
      render(<ReadingProgress progress={100} remainingMinutes={0} />);

      expect(screen.getByText(/阅读完成/)).toBeInTheDocument();
    });
  });

  describe("剩余时间格式化", () => {
    it("剩余 0 分钟显示阅读完成", () => {
      render(<ReadingProgress progress={100} remainingMinutes={0} />);

      expect(screen.getByText(/阅读完成/)).toBeInTheDocument();
    });

    it("剩余 1 分钟以内显示即将读完", () => {
      render(<ReadingProgress progress={90} remainingMinutes={0.5} />);

      expect(screen.getByText(/即将读完/)).toBeInTheDocument();
    });

    it("正常显示分钟数", () => {
      render(<ReadingProgress progress={50} remainingMinutes={3} />);

      expect(screen.getByText(/3 分钟/)).toBeInTheDocument();
    });
  });

  describe("进度条", () => {
    it("默认不显示进度条", () => {
      const { container } = render(
        <ReadingProgress progress={50} remainingMinutes={5} />,
      );

      // 检查是否没有进度条元素
      const progressBar = container.querySelector(".min-w-\\[60px\\]");
      expect(progressBar).not.toBeInTheDocument();
    });

    it("showProgressBar=true 时显示进度条", () => {
      const { container } = render(
        <ReadingProgress progress={50} remainingMinutes={5} showProgressBar />,
      );

      // 检查是否有进度条元素
      const progressBar = container.querySelector(".min-w-\\[60px\\]");
      expect(progressBar).toBeInTheDocument();
    });

    it("进度条宽度正确", () => {
      const { container } = render(
        <ReadingProgress progress={50} remainingMinutes={5} showProgressBar />,
      );

      const progressFill = container.querySelector(".min-w-\\[60px\\] > div");
      expect(progressFill).toHaveStyle({ width: "50%" });
    });

    it("自定义进度条颜色", () => {
      const { container } = render(
        <ReadingProgress
          progress={50}
          remainingMinutes={5}
          showProgressBar
          progressColor="#ff0000"
        />,
      );

      const progressFill = container.querySelector(".min-w-\\[60px\\] > div");
      expect(progressFill).toHaveStyle({ backgroundColor: "#ff0000" });
    });
  });

  describe("完成回调", () => {
    it("进度达到阈值时触发 onComplete", () => {
      const onComplete = jest.fn();

      render(
        <ReadingProgress
          progress={95}
          remainingMinutes={0}
          onComplete={onComplete}
        />,
      );

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("进度未达到阈值时不触发 onComplete", () => {
      const onComplete = jest.fn();

      render(
        <ReadingProgress
          progress={50}
          remainingMinutes={5}
          onComplete={onComplete}
        />,
      );

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("样式", () => {
    it("应用自定义 className", () => {
      const { container } = render(
        <ReadingProgress
          progress={50}
          remainingMinutes={5}
          className="custom-class"
        />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("完成时显示绿色样式", () => {
      render(<ReadingProgress progress={100} remainingMinutes={0} />);

      const text = screen.getByText(/阅读完成/);
      expect(text).toHaveClass("text-green-600");
    });
  });
});

describe("ReadingProgressCompact", () => {
  describe("渲染", () => {
    it("正确渲染进度百分比", () => {
      render(<ReadingProgressCompact progress={50} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("进度四舍五入", () => {
      render(<ReadingProgressCompact progress={33.33} />);

      expect(screen.getByText("33%")).toBeInTheDocument();
    });
  });

  describe("完成状态", () => {
    it("进度 >= 95% 显示勾号", () => {
      render(<ReadingProgressCompact progress={95} />);

      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("进度 100% 显示勾号", () => {
      render(<ReadingProgressCompact progress={100} />);

      expect(screen.getByText("✓")).toBeInTheDocument();
    });
  });

  describe("样式", () => {
    it("应用自定义 className", () => {
      const { container } = render(
        <ReadingProgressCompact progress={50} className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("未完成时显示灰色", () => {
      render(<ReadingProgressCompact progress={50} />);

      const text = screen.getByText("50%");
      expect(text).toHaveClass("text-gray-500");
    });

    it("完成时显示绿色", () => {
      render(<ReadingProgressCompact progress={100} />);

      const text = screen.getByText("✓");
      expect(text).toHaveClass("text-green-600");
    });
  });
});
