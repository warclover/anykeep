/**
 * AttachmentErrorBoundary 组件单元测试
 *
 * 测试错误边界的错误捕获和恢复功能
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AttachmentErrorBoundary,
  withAttachmentErrorBoundary,
} from "../attachment-error-boundary";

// =============================================================================
// 模拟抛错组件
// =============================================================================

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>正常渲染</div>;
};

// 抑制 React 错误边界在控制台的错误输出
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// =============================================================================
// AttachmentErrorBoundary 测试
// =============================================================================

describe("AttachmentErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("正常渲染", () => {
    it("正常情况下渲染子组件", () => {
      render(
        <AttachmentErrorBoundary>
          <div>子组件内容</div>
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByText("子组件内容")).toBeInTheDocument();
    });

    it("不显示错误 UI", () => {
      render(
        <AttachmentErrorBoundary>
          <ThrowError shouldThrow={false} />
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByText("正常渲染")).toBeInTheDocument();
      expect(screen.queryByText("预览加载失败")).not.toBeInTheDocument();
    });
  });

  describe("错误捕获", () => {
    it("捕获子组件错误并显示回退 UI", () => {
      render(
        <AttachmentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByText("预览加载失败")).toBeInTheDocument();
      expect(
        screen.getByText("无法加载附件预览内容，请重试。"),
      ).toBeInTheDocument();
    });

    it("显示重试按钮", () => {
      render(
        <AttachmentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByRole("button", { name: /重试/ })).toBeInTheDocument();
    });

    it("错误 UI 有正确的 role=alert", () => {
      render(
        <AttachmentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("错误 UI 有 aria-live=assertive", () => {
      render(
        <AttachmentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByRole("alert")).toHaveAttribute(
        "aria-live",
        "assertive",
      );
    });
  });

  describe("错误回调", () => {
    it("触发 onError 回调", () => {
      const onError = jest.fn();

      render(
        <AttachmentErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0][0].message).toBe("Test error");
    });
  });

  describe("重试功能", () => {
    it("点击重试按钮重置错误状态", () => {
      // 使用一个可控制是否抛错的组件
      let shouldThrow = true;

      const ControlledComponent = () => {
        if (shouldThrow) {
          throw new Error("Test error");
        }
        return <div>正常渲染</div>;
      };

      const { rerender } = render(
        <AttachmentErrorBoundary>
          <ControlledComponent />
        </AttachmentErrorBoundary>,
      );

      // 初始显示错误 UI
      expect(screen.getByText("预览加载失败")).toBeInTheDocument();

      // 修改状态，下次渲染不抛错
      shouldThrow = false;

      // 点击重试触发重置
      fireEvent.click(screen.getByRole("button", { name: /重试/ }));

      // 重新渲染
      rerender(
        <AttachmentErrorBoundary>
          <ControlledComponent />
        </AttachmentErrorBoundary>,
      );

      // 应该显示正常内容
      expect(screen.getByText("正常渲染")).toBeInTheDocument();
    });

    it("触发 onReset 回调", () => {
      const onReset = jest.fn();

      render(
        <AttachmentErrorBoundary onReset={onReset}>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      fireEvent.click(screen.getByRole("button", { name: /重试/ }));

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe("自定义回退 UI", () => {
    it("使用自定义 fallback", () => {
      render(
        <AttachmentErrorBoundary fallback={<div>自定义错误页面</div>}>
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(screen.getByText("自定义错误页面")).toBeInTheDocument();
      expect(screen.queryByText("预览加载失败")).not.toBeInTheDocument();
    });
  });

  describe("自定义样式", () => {
    it("接受自定义 className", () => {
      const { container } = render(
        <AttachmentErrorBoundary className="custom-error-class">
          <ThrowError shouldThrow={true} />
        </AttachmentErrorBoundary>,
      );

      expect(
        container.querySelector(".custom-error-class"),
      ).toBeInTheDocument();
    });
  });
});

// =============================================================================
// withAttachmentErrorBoundary HOC 测试
// =============================================================================

describe("withAttachmentErrorBoundary", () => {
  it("创建包裹组件", () => {
    const TestComponent = () => <div>测试组件</div>;
    const WrappedComponent = withAttachmentErrorBoundary(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByText("测试组件")).toBeInTheDocument();
  });

  it("保留 displayName", () => {
    const TestComponent = () => <div>测试</div>;
    TestComponent.displayName = "MyTestComponent";

    const WrappedComponent = withAttachmentErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe(
      "WithAttachmentErrorBoundary(MyTestComponent)",
    );
  });

  it("传递 props 给被包裹组件", () => {
    interface TestProps {
      message: string;
    }

    const TestComponent = ({ message }: TestProps) => <div>{message}</div>;
    const WrappedComponent = withAttachmentErrorBoundary(TestComponent);

    render(<WrappedComponent message="Hello World" />);

    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("捕获被包裹组件的错误", () => {
    const onError = jest.fn();
    const WrappedComponent = withAttachmentErrorBoundary(
      ({ shouldThrow }: { shouldThrow: boolean }) => {
        if (shouldThrow) throw new Error("Wrapped error");
        return <div>OK</div>;
      },
      { onError },
    );

    render(<WrappedComponent shouldThrow={true} />);

    expect(screen.getByText("预览加载失败")).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it("使用自定义 fallback", () => {
    const WrappedComponent = withAttachmentErrorBoundary(
      () => {
        throw new Error("Test");
      },
      { fallback: <div>HOC 自定义回退</div> },
    );

    render(<WrappedComponent />);

    expect(screen.getByText("HOC 自定义回退")).toBeInTheDocument();
  });
});
