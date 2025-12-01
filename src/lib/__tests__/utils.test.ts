/**
 * 通用工具函数测试
 * 测试 cn() 函数的 class 合并逻辑
 */

import { cn } from "../utils";

describe("cn() - Tailwind CSS Class Merger", () => {
  it("should merge multiple class names", () => {
    const result = cn("px-4", "py-2", "bg-blue-500");
    expect(result).toBe("px-4 py-2 bg-blue-500");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const result = cn("base-class", isActive && "active-class");
    expect(result).toBe("base-class active-class");
  });

  it("should filter out falsy values", () => {
    const result = cn("px-4", false, "py-2", null, undefined, "bg-blue-500");
    expect(result).toBe("px-4 py-2 bg-blue-500");
  });

  it("should handle Tailwind class conflicts (last one wins)", () => {
    // twMerge 会智能合并冲突的 Tailwind 类
    const result = cn("px-2", "px-4"); // px-4 应该覆盖 px-2
    expect(result).toBe("px-4");
  });

  it("should handle arrays of classes", () => {
    const result = cn(["px-4", "py-2"], "bg-blue-500");
    expect(result).toBe("px-4 py-2 bg-blue-500");
  });

  it("should handle objects with boolean values", () => {
    const result = cn({
      "px-4": true,
      "py-2": true,
      "bg-red-500": false,
      "bg-blue-500": true,
    });
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("bg-blue-500");
    expect(result).not.toContain("bg-red-500");
  });

  it("should handle empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("should handle complex nested structures", () => {
    const result = cn(
      "base",
      ["nested-1", { "nested-2": true, "nested-3": false }],
      null,
      "final",
    );
    expect(result).toContain("base");
    expect(result).toContain("nested-1");
    expect(result).toContain("nested-2");
    expect(result).not.toContain("nested-3");
    expect(result).toContain("final");
  });

  it("should deduplicate identical classes", () => {
    const result = cn("px-4", "py-2", "px-4", "py-2");
    // twMerge 会去重
    expect(result).toBe("px-4 py-2");
  });

  it("should handle Tailwind modifiers correctly", () => {
    const result = cn("hover:bg-blue-500", "focus:ring-2", "dark:text-white");
    expect(result).toContain("hover:bg-blue-500");
    expect(result).toContain("focus:ring-2");
    expect(result).toContain("dark:text-white");
  });
});
