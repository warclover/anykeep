/**
 * input-mapper 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect } from "@jest/globals";
import type { VariableContext } from "../input-mapper";
import { resolveInputMapping } from "../input-mapper";

describe("resolveInputMapping", () => {
  const createContext = (
    variables: Record<string, unknown>,
  ): VariableContext => ({
    variables,
  });

  it("should resolve simple variable reference", () => {
    const context = createContext({ foo: "bar" });
    const mapping = { key: "${foo}" };

    const result = resolveInputMapping(mapping, context);

    expect(result.key).toBe("bar");
  });

  it("should resolve nested variable reference", () => {
    const context = createContext({
      nested: { value: 123 },
    });
    const mapping = { key: "${nested.value}" };

    const result = resolveInputMapping(mapping, context);

    expect(result.key).toBe(123);
  });

  it("should pass through literal string values", () => {
    const context = createContext({});
    const mapping = { key: "literal value" };

    const result = resolveInputMapping(mapping, context);

    expect(result.key).toBe("literal value");
  });

  it("should pass through non-string values", () => {
    const context = createContext({});
    const mapping = {
      number: 42,
      boolean: true,
      array: [1, 2, 3],
      object: { nested: true },
    };

    const result = resolveInputMapping(mapping, context);

    expect(result.number).toBe(42);
    expect(result.boolean).toBe(true);
    expect(result.array).toEqual([1, 2, 3]);
    expect(result.object).toEqual({ nested: true });
  });

  it("should handle mixed mapping", () => {
    const context = createContext({
      foo: "bar",
      nested: { value: 123 },
    });
    const mapping = {
      simple: "${foo}",
      deep: "${nested.value}",
      literal: "unchanged",
      number: 42,
    };

    const result = resolveInputMapping(mapping, context);

    expect(result.simple).toBe("bar");
    expect(result.deep).toBe(123);
    expect(result.literal).toBe("unchanged");
    expect(result.number).toBe(42);
  });

  it("should return undefined for non-existent variable", () => {
    const context = createContext({});
    const mapping = { key: "${nonexistent}" };

    const result = resolveInputMapping(mapping, context);

    expect(result.key).toBeUndefined();
  });

  it("should handle empty mapping", () => {
    const context = createContext({ foo: "bar" });
    const mapping = {};

    const result = resolveInputMapping(mapping, context);

    expect(result).toEqual({});
  });

  it("should not treat partial variable syntax as reference", () => {
    const context = createContext({});
    const mapping = {
      notRef1: "${incomplete",
      notRef2: "incomplete}",
      notRef3: "just text ${with braces} in middle",
    };

    const result = resolveInputMapping(mapping, context);

    expect(result.notRef1).toBe("${incomplete");
    expect(result.notRef2).toBe("incomplete}");
    expect(result.notRef3).toBe("just text ${with braces} in middle");
  });

  it("should handle deeply nested variable references", () => {
    const context = createContext({
      a: { b: { c: { d: "deepValue" } } },
    });
    const mapping = { key: "${a.b.c.d}" };

    const result = resolveInputMapping(mapping, context);

    expect(result.key).toBe("deepValue");
  });

  it("should handle trigger context pattern", () => {
    const context = createContext({
      trigger: { bookmarkId: "bk-123", eventName: "bookmark_added" },
    });
    const mapping = {
      bookmarkId: "${trigger.bookmarkId}",
      event: "${trigger.eventName}",
    };

    const result = resolveInputMapping(mapping, context);

    expect(result.bookmarkId).toBe("bk-123");
    expect(result.event).toBe("bookmark_added");
  });
});
