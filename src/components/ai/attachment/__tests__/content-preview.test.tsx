/**
 * ContentPreview 组件单元测试
 *
 * 测试内容预览共享组件的功能
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ContentPreview, truncateContent } from "../content-preview";
import { ATTACHMENT_LIMITS } from "../types";

// =============================================================================
// truncateContent 函数测试
// =============================================================================

describe("truncateContent", () => {
  it("返回空字符串当 content 为 undefined", () => {
    const result = truncateContent(undefined);
    expect(result.text).toBe("");
    expect(result.isTruncated).toBe(false);
  });

  it("返回空字符串当 content 为空字符串", () => {
    const result = truncateContent("");
    expect(result.text).toBe("");
    expect(result.isTruncated).toBe(false);
  });

  it("内容未超过长度限制时不截断", () => {
    const content = "短文本";
    const result = truncateContent(content, 100);
    expect(result.text).toBe(content);
    expect(result.isTruncated).toBe(false);
  });

  it("内容超过长度限制时截断", () => {
    const content = "这是一段很长的文本内容，需要被截断处理";
    const result = truncateContent(content, 10);
    expect(result.text).toBe("这是一段很长的文本内容".slice(0, 10));
    expect(result.text.length).toBe(10);
    expect(result.isTruncated).toBe(true);
  });

  it("内容刚好等于长度限制时不截断", () => {
    const content = "12345";
    const result = truncateContent(content, 5);
    expect(result.text).toBe(content);
    expect(result.isTruncated).toBe(false);
  });

  it("使用默认最大长度", () => {
    const longContent = "a".repeat(ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH + 100);
    const result = truncateContent(longContent);
    expect(result.text.length).toBe(ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH);
    expect(result.isTruncated).toBe(true);
  });
});

// =============================================================================
// ContentPreview 组件测试
// =============================================================================

describe("ContentPreview", () => {
  describe("空状态", () => {
    it("无内容时显示默认空状态文本", () => {
      render(<ContentPreview content="" />);
      expect(screen.getByText("暂无内容")).toBeInTheDocument();
    });

    it("无内容时显示自定义空状态文本", () => {
      render(<ContentPreview content="" emptyText="没有数据" />);
      expect(screen.getByText("没有数据")).toBeInTheDocument();
    });

    it("content 为 undefined 时显示空状态", () => {
      render(<ContentPreview content={undefined} />);
      expect(screen.getByText("暂无内容")).toBeInTheDocument();
    });
  });

  describe("内容显示", () => {
    it("正常显示内容文本", () => {
      render(<ContentPreview content="测试内容" />);
      expect(screen.getByText("测试内容")).toBeInTheDocument();
    });

    it("使用 p 标签渲染非等宽内容", () => {
      const { container } = render(<ContentPreview content="普通文本" />);
      expect(container.querySelector("p")).toBeInTheDocument();
      expect(container.querySelector("pre")).not.toBeInTheDocument();
    });

    it("使用 pre 标签渲染等宽内容", () => {
      const { container } = render(
        <ContentPreview content="代码内容" monospace />,
      );
      expect(container.querySelector("pre")).toBeInTheDocument();
      expect(container.querySelector("pre")).toHaveClass("font-mono");
    });
  });

  describe("截断处理", () => {
    it("内容被截断时显示截断提示", () => {
      render(<ContentPreview content="很长的内容需要截断" maxLength={5} />);
      expect(screen.getByText("（内容已截断）")).toBeInTheDocument();
    });

    it("truncated prop 为 true 时显示截断提示", () => {
      render(<ContentPreview content="短内容" truncated />);
      expect(screen.getByText("（内容已截断）")).toBeInTheDocument();
    });

    it("显示自定义截断提示文本", () => {
      render(
        <ContentPreview content="内容" truncated truncatedText="...更多" />,
      );
      expect(screen.getByText("...更多")).toBeInTheDocument();
    });

    it("内容未截断且 truncated 为 false 时不显示截断提示", () => {
      render(<ContentPreview content="短内容" />);
      expect(screen.queryByText("（内容已截断）")).not.toBeInTheDocument();
    });
  });

  describe("自定义样式", () => {
    it("接受自定义 className", () => {
      const { container } = render(
        <ContentPreview content="内容" className="custom-class" />,
      );
      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("应用默认的 rounded-lg 和 bg-muted/50 样式", () => {
      const { container } = render(<ContentPreview content="内容" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("rounded-lg", "bg-muted/50", "p-4");
    });
  });

  describe("maxLength 参数", () => {
    it("使用自定义 maxLength 截断内容", () => {
      render(<ContentPreview content="123456789" maxLength={5} />);
      expect(screen.getByText(/12345/)).toBeInTheDocument();
      expect(screen.getByText("（内容已截断）")).toBeInTheDocument();
    });

    it("使用默认 maxLength", () => {
      const content = "a".repeat(100);
      render(<ContentPreview content={content} />);
      expect(screen.getByText(content)).toBeInTheDocument();
    });
  });
});
