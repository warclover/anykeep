/**
 * StreamResultCollector 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, jest } from "@jest/globals";
import {
  collectStreamResult,
  extractPrimaryDeliverable,
  isCollectionSuccess,
  type CollectedResult,
} from "../stream-result-collector";
import type { UnifiedStreamChunk } from "@/lib/ai-skills/output/types";

describe("StreamResultCollector", () => {
  describe("collectStreamResult", () => {
    it("should collect text chunks", async () => {
      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        yield { type: "text", data: { text: "Hello " } };
        yield { type: "text", data: { text: "World" } };
        yield { type: "done", data: { success: true } };
      }

      const result = await collectStreamResult(mockStream());

      expect(result.text).toBe("Hello World");
      expect(result.status).toBe("completed");
      expect(result.error).toBeUndefined();
    });

    it("should collect deliverables", async () => {
      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        yield {
          type: "deliverable",
          data: {
            id: "1",
            type: "report",
            title: "Test",
            format: "json",
            content: { foo: "bar" },
          },
        };
        yield { type: "done", data: { success: true } };
      }

      const result = await collectStreamResult(mockStream());

      expect(result.deliverables).toHaveLength(1);
      expect(result.deliverables[0].format).toBe("json");
      expect(result.deliverables[0].content).toEqual({ foo: "bar" });
    });

    it("should handle error chunks", async () => {
      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        yield { type: "text", data: { text: "Starting..." } };
        yield { type: "error", data: { message: "Something went wrong" } };
      }

      const result = await collectStreamResult(mockStream());

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Something went wrong");
      expect(result.text).toBe("Starting...");
    });

    it("should call onProgress callback", async () => {
      const onProgress = jest.fn();

      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        yield { type: "text", data: { text: "Hello" } };
        yield { type: "done", data: { success: true } };
      }

      await collectStreamResult(mockStream(), { onProgress });

      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it("should keep raw chunks when requested", async () => {
      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        yield { type: "text", data: { text: "Test" } };
        yield { type: "done", data: { success: true } };
      }

      const result = await collectStreamResult(mockStream(), {
        keepRawChunks: true,
      });

      expect(result.rawChunks).toHaveLength(2);
    });

    it("should handle empty stream", async () => {
      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        // Empty stream
      }

      const result = await collectStreamResult(mockStream());

      expect(result.text).toBe("");
      expect(result.deliverables).toHaveLength(0);
      expect(result.status).toBe("completed");
    });

    it("should handle stream timeout", async () => {
      async function* mockStream(): AsyncGenerator<UnifiedStreamChunk> {
        yield { type: "text", data: { text: "Start" } };
        // Simulate long delay
        await new Promise((resolve) => setTimeout(resolve, 200));
        yield { type: "done", data: { success: true } };
      }

      const result = await collectStreamResult(mockStream(), { timeout: 50 });

      expect(result.status).toBe("failed");
      expect(result.error).toContain("timeout");
    });
  });

  describe("extractPrimaryDeliverable", () => {
    it("should return null for empty deliverables", () => {
      const result: CollectedResult = {
        text: "",
        deliverables: [],
        status: "completed",
        rawChunks: [],
      };

      expect(extractPrimaryDeliverable(result)).toBeNull();
    });

    it("should prioritize JSON format", () => {
      const result: CollectedResult = {
        text: "",
        deliverables: [
          { format: "markdown", content: "# Title" },
          { format: "json", content: { data: true } },
        ],
        status: "completed",
        rawChunks: [],
      };

      expect(extractPrimaryDeliverable(result)).toEqual({ data: true });
    });

    it("should return first deliverable if no JSON", () => {
      const result: CollectedResult = {
        text: "",
        deliverables: [{ format: "markdown", content: "# Title" }],
        status: "completed",
        rawChunks: [],
      };

      expect(extractPrimaryDeliverable(result)).toBe("# Title");
    });
  });

  describe("isCollectionSuccess", () => {
    it("should return true for completed status without error", () => {
      const result: CollectedResult = {
        text: "Done",
        deliverables: [],
        status: "completed",
        rawChunks: [],
      };

      expect(isCollectionSuccess(result)).toBe(true);
    });

    it("should return false for failed status", () => {
      const result: CollectedResult = {
        text: "",
        deliverables: [],
        status: "failed",
        error: "Error",
        rawChunks: [],
      };

      expect(isCollectionSuccess(result)).toBe(false);
    });

    it("should return false for completed status with error", () => {
      const result: CollectedResult = {
        text: "",
        deliverables: [],
        status: "completed",
        error: "Warning",
        rawChunks: [],
      };

      expect(isCollectionSuccess(result)).toBe(false);
    });
  });
});
