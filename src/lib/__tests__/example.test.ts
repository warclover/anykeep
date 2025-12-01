/**
 * 示例测试文件
 * 用于验证 Jest 和 React Testing Library 配置是否正确
 */

describe("Example Test Suite", () => {
  it("should pass basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should work with async code", async () => {
    const result = await Promise.resolve("success");
    expect(result).toBe("success");
  });

  it("should handle array operations", () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it("should handle object operations", () => {
    const obj = { name: "AnyKeep", type: "app" };
    expect(obj).toHaveProperty("name");
    expect(obj.name).toBe("AnyKeep");
  });
});

describe("String Utilities", () => {
  it("should handle string transformations", () => {
    const str = "hello world";
    expect(str.toUpperCase()).toBe("HELLO WORLD");
    expect(str.split(" ")).toEqual(["hello", "world"]);
  });
});
