/**
 * LazyErrorBoundary 单元测试
 *
 * 验证懒加载错误边界组件的功能
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { LazyErrorBoundary, SilentErrorBoundary } from "../lazy-error-boundary";

// 模拟抛出错误的组件
function ThrowingComponent(): never {
  throw new Error("Test error");
}

// 正常渲染的组件
function NormalComponent() {
  return <div data-testid="normal">Normal content</div>;
}

// 抑制 console.error 以避免测试输出噪音
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe("LazyErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <LazyErrorBoundary>
        <NormalComponent />
      </LazyErrorBoundary>,
    );

    expect(screen.getByTestId("normal")).toBeInTheDocument();
    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("renders default error UI when child throws", () => {
    render(
      <LazyErrorBoundary>
        <ThrowingComponent />
      </LazyErrorBoundary>,
    );

    expect(screen.getByText("组件加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重试/i })).toBeInTheDocument();
  });

  it("renders custom error message", () => {
    render(
      <LazyErrorBoundary errorMessage="自定义错误消息">
        <ThrowingComponent />
      </LazyErrorBoundary>,
    );

    expect(screen.getByText("自定义错误消息")).toBeInTheDocument();
  });

  it("renders custom fallback UI", () => {
    render(
      <LazyErrorBoundary
        fallback={<div data-testid="fallback">Custom fallback</div>}
      >
        <ThrowingComponent />
      </LazyErrorBoundary>,
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });

  it("hides retry button when showRetry is false", () => {
    render(
      <LazyErrorBoundary showRetry={false}>
        <ThrowingComponent />
      </LazyErrorBoundary>,
    );

    expect(screen.getByText("组件加载失败")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /重试/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onRetry callback when retry button is clicked", () => {
    const onRetry = jest.fn();

    // 使用状态来控制是否抛出错误
    const shouldThrow = true;
    function ConditionalThrowComponent() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div data-testid="recovered">Recovered</div>;
    }

    render(
      <LazyErrorBoundary onRetry={onRetry}>
        <ConditionalThrowComponent />
      </LazyErrorBoundary>,
    );

    // 点击重试按钮
    fireEvent.click(screen.getByRole("button", { name: /重试/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("SilentErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <SilentErrorBoundary>
        <NormalComponent />
      </SilentErrorBoundary>,
    );

    expect(screen.getByTestId("normal")).toBeInTheDocument();
    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("renders null when child throws", () => {
    const { container } = render(
      <SilentErrorBoundary>
        <ThrowingComponent />
      </SilentErrorBoundary>,
    );

    // SilentErrorBoundary 应该返回 null，容器应该为空
    expect(container.firstChild).toBeNull();
  });

  it("does not display any error message", () => {
    render(
      <SilentErrorBoundary>
        <ThrowingComponent />
      </SilentErrorBoundary>,
    );

    expect(screen.queryByText(/错误/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/失败/i)).not.toBeInTheDocument();
  });
});
