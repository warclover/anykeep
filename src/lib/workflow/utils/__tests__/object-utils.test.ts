/**
 * object-utils 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect } from "@jest/globals";
import { getNestedValue } from "../object-utils";

describe("getNestedValue", () => {
  it("should get top-level value", () => {
    const obj = { foo: "bar" };
    expect(getNestedValue(obj, "foo")).toBe("bar");
  });

  it("should get nested value with dot notation", () => {
    const obj = {
      level1: {
        level2: {
          value: "found",
        },
      },
    };
    expect(getNestedValue(obj, "level1.level2.value")).toBe("found");
  });

  it("should return undefined for non-existent path", () => {
    const obj = { foo: "bar" };
    expect(getNestedValue(obj, "nonexistent")).toBeUndefined();
  });

  it("should return undefined for partial path", () => {
    const obj = { level1: { level2: "value" } };
    expect(getNestedValue(obj, "level1.level2.level3")).toBeUndefined();
  });

  it("should handle numeric values", () => {
    const obj = { count: 42, nested: { value: 123 } };
    expect(getNestedValue(obj, "count")).toBe(42);
    expect(getNestedValue(obj, "nested.value")).toBe(123);
  });

  it("should handle boolean values", () => {
    const obj = { enabled: true, nested: { active: false } };
    expect(getNestedValue(obj, "enabled")).toBe(true);
    expect(getNestedValue(obj, "nested.active")).toBe(false);
  });

  it("should handle null values", () => {
    const obj = { value: null };
    expect(getNestedValue(obj, "value")).toBeNull();
  });

  it("should handle array values", () => {
    const obj = { items: [1, 2, 3] };
    expect(getNestedValue(obj, "items")).toEqual([1, 2, 3]);
  });

  it("should return undefined when object is null", () => {
    expect(getNestedValue(null, "foo")).toBeUndefined();
  });

  it("should return undefined when object is undefined", () => {
    expect(getNestedValue(undefined, "foo")).toBeUndefined();
  });

  it("should handle object with special characters in keys", () => {
    // Note: Current implementation uses dot split, so keys with dots won't work
    const obj = { "normal-key": "value" };
    expect(getNestedValue(obj, "normal-key")).toBe("value");
  });
});
