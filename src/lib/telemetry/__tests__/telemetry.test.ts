/**
 * 遥测模块测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock crypto for consistent test results
vi.mock("crypto", () => ({
  randomBytes: (size: number) => ({
    toString: () => "0".repeat(size * 2),
  }),
}));

import {
  getTracer,
  getActiveSpan,
  initTelemetry,
  withSpan,
  withSpanSync,
  withAIToolSpan,
  withDBSpan,
  SpanStatusCode,
  SPAN_NAMES,
  ATTR_KEYS,
} from "../index";
import type { Span } from "../types";

describe("telemetry", () => {
  beforeEach(() => {
    // 重置遥测状态
    initTelemetry({ enabled: true, consoleExport: false });
  });

  describe("getTracer", () => {
    it("should return a tracer instance", () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
      expect(tracer.startSpan).toBeDefined();
      expect(tracer.startActiveSpan).toBeDefined();
    });

    it("should return the same tracer instance", () => {
      const tracer1 = getTracer();
      const tracer2 = getTracer();
      expect(tracer1).toBe(tracer2);
    });
  });

  describe("Span creation", () => {
    it("should create a span with name", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test.span");

      expect(span.name).toBe("test.span");
      expect(span.context.traceId).toBeDefined();
      expect(span.context.spanId).toBeDefined();
    });

    it("should create a span with attributes", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test.span", {
        attributes: { key: "value" },
      });

      expect(span.attributes.key).toBe("value");
    });

    it("should allow setting attributes after creation", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test.span");

      span.setAttribute("new.key", "new.value");
      expect(span.attributes["new.key"]).toBe("new.value");
    });

    it("should record status", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test.span");

      span.setStatus({ code: SpanStatusCode.OK });
      expect(span.status.code).toBe(SpanStatusCode.OK);
    });

    it("should record events", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test.span");

      span.addEvent("my.event", { detail: "value" });
      expect(span.events).toHaveLength(1);
      expect(span.events[0].name).toBe("my.event");
    });

    it("should record exceptions", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test.span");

      span.recordException(new Error("Test error"));
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.events).toHaveLength(1);
      expect(span.events[0].name).toBe("exception");
    });
  });

  describe("startActiveSpan", () => {
    it("should set span as active during execution", async () => {
      const tracer = getTracer();

      await tracer.startActiveSpan("test.active", async (span) => {
        const active = getActiveSpan();
        expect(active).toBe(span);
      });
    });

    it("should restore previous span after execution", async () => {
      const tracer = getTracer();

      await tracer.startActiveSpan("outer", async () => {
        const outerSpan = getActiveSpan();

        await tracer.startActiveSpan("inner", async () => {
          const innerSpan = getActiveSpan();
          expect(innerSpan).not.toBe(outerSpan);
        });

        // 内部 span 结束后，应该恢复外部 span
        const restoredSpan = getActiveSpan();
        expect(restoredSpan).toBe(outerSpan);
      });
    });

    it("should auto-set OK status on success", async () => {
      const tracer = getTracer();
      let capturedSpan: Span | null = null;

      await tracer.startActiveSpan("test.success", async (span) => {
        capturedSpan = span;
        return "success";
      });

      expect(capturedSpan?.status.code).toBe(SpanStatusCode.OK);
    });

    it("should auto-set ERROR status on exception", async () => {
      const tracer = getTracer();
      let capturedSpan: Span | null = null;

      try {
        await tracer.startActiveSpan("test.error", async (span) => {
          capturedSpan = span;
          throw new Error("Test error");
        });
      } catch {
        // 预期的错误
      }

      expect(capturedSpan?.status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe("withSpan", () => {
    it("should wrap async function with span", async () => {
      const result = await withSpan("test.operation", async () => {
        return "result";
      });

      expect(result).toBe("result");
    });

    it("should include attributes in span", async () => {
      let capturedSpan: Span | null = null;

      await withSpan(
        "test.with.attrs",
        async (span) => {
          capturedSpan = span;
          return true;
        },
        { custom: "value" },
      );

      expect(capturedSpan?.attributes.custom).toBe("value");
    });

    it("should propagate errors", async () => {
      await expect(
        withSpan("test.error", async () => {
          throw new Error("Test error");
        }),
      ).rejects.toThrow("Test error");
    });
  });

  describe("withSpanSync", () => {
    it("should wrap sync function with span", () => {
      const result = withSpanSync("test.sync", () => {
        return 42;
      });

      expect(result).toBe(42);
    });
  });

  describe("withAIToolSpan", () => {
    it("should create span with AI tool attributes", async () => {
      let capturedSpan: Span | null = null;

      await withAIToolSpan("search_bookmarks", async (span) => {
        capturedSpan = span;
        return [];
      });

      expect(capturedSpan?.name).toBe(`${SPAN_NAMES.AI_TOOL}.search_bookmarks`);
      expect(capturedSpan?.attributes[ATTR_KEYS.AI_TOOL_NAME]).toBe(
        "search_bookmarks",
      );
      expect(capturedSpan?.attributes[ATTR_KEYS.AI_TOOL_SUCCESS]).toBe(true);
    });

    it("should mark success as false on error", async () => {
      let capturedSpan: Span | null = null;

      try {
        await withAIToolSpan("failing_tool", async (span) => {
          capturedSpan = span;
          throw new Error("Tool failed");
        });
      } catch {
        // 预期的错误
      }

      expect(capturedSpan?.attributes[ATTR_KEYS.AI_TOOL_SUCCESS]).toBe(false);
    });
  });

  describe("withDBSpan", () => {
    it("should create span with DB attributes", async () => {
      let capturedSpan: Span | null = null;

      await withDBSpan("select", "bookmarks", async (span) => {
        capturedSpan = span;
        return [];
      });

      expect(capturedSpan?.name).toBe(`${SPAN_NAMES.DB}.select`);
      expect(capturedSpan?.attributes[ATTR_KEYS.DB_SYSTEM]).toBe("postgresql");
      expect(capturedSpan?.attributes[ATTR_KEYS.DB_OPERATION]).toBe("select");
      expect(capturedSpan?.attributes[ATTR_KEYS.DB_TABLE]).toBe("bookmarks");
    });
  });

  describe("initTelemetry", () => {
    it("should initialize with default config", () => {
      // 不应抛出错误
      expect(() => initTelemetry()).not.toThrow();
    });

    it("should accept custom config", () => {
      expect(() =>
        initTelemetry({
          enabled: true,
          serviceName: "test-service",
        }),
      ).not.toThrow();
    });

    it("should disable telemetry when enabled is false", () => {
      initTelemetry({ enabled: false });
      // 应该仍然可以创建 span，但不会导出
      const tracer = getTracer();
      expect(tracer.startSpan("test")).toBeDefined();
    });
  });
});
