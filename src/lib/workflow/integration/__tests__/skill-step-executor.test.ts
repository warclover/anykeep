/**
 * SkillStepExecutor 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, jest } from "@jest/globals";
import { getSkillStepExecutor } from "../skill-step-executor";
import type { WorkflowContext } from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("SkillStepExecutor", () => {
  describe("private methods via reflection", () => {
    describe("resolveInput", () => {
      it("should resolve simple variable references", () => {
        const executor = getSkillStepExecutor();
        const resolveInput = (
          executor as unknown as {
            resolveInput: (
              mapping: Record<string, string | unknown>,
              context: WorkflowContext,
            ) => Record<string, unknown>;
          }
        ).resolveInput.bind(executor);

        const mockContext: WorkflowContext = {
          executionId: "exec-123",
          workflowId: "workflow-1",
          userId: "user-123",
          variables: {
            userQuery: "AI 相关文章",
          },
          stepResults: {},
          abortSignal: new AbortController().signal,
        };

        const result = resolveInput(
          { query: "$variables.userQuery", limit: 10 },
          mockContext,
        );

        expect(result.query).toBe("AI 相关文章");
        expect(result.limit).toBe(10);
      });

      it("should handle nested variable paths", () => {
        const executor = getSkillStepExecutor();
        const resolveInput = (
          executor as unknown as {
            resolveInput: (
              mapping: Record<string, string | unknown>,
              context: WorkflowContext,
            ) => Record<string, unknown>;
          }
        ).resolveInput.bind(executor);

        const contextWithNested: WorkflowContext = {
          executionId: "exec-123",
          workflowId: "workflow-1",
          userId: "user-123",
          variables: {
            user: {
              preferences: {
                theme: "dark",
              },
            },
          },
          stepResults: {},
          abortSignal: new AbortController().signal,
        };

        const result = resolveInput(
          { theme: "$variables.user.preferences.theme" },
          contextWithNested,
        );

        expect(result.theme).toBe("dark");
      });

      it("should handle missing variables gracefully", () => {
        const executor = getSkillStepExecutor();
        const resolveInput = (
          executor as unknown as {
            resolveInput: (
              mapping: Record<string, string | unknown>,
              context: WorkflowContext,
            ) => Record<string, unknown>;
          }
        ).resolveInput.bind(executor);

        const mockContext: WorkflowContext = {
          executionId: "exec-123",
          workflowId: "workflow-1",
          userId: "user-123",
          variables: {},
          stepResults: {},
          abortSignal: new AbortController().signal,
        };

        const result = resolveInput(
          { query: "$nonExistent", fallback: "default" },
          mockContext,
        );

        expect(result.query).toBeUndefined();
        expect(result.fallback).toBe("default");
      });

      it("should pass through non-variable values", () => {
        const executor = getSkillStepExecutor();
        const resolveInput = (
          executor as unknown as {
            resolveInput: (
              mapping: Record<string, string | unknown>,
              context: WorkflowContext,
            ) => Record<string, unknown>;
          }
        ).resolveInput.bind(executor);

        const mockContext: WorkflowContext = {
          executionId: "exec-123",
          workflowId: "workflow-1",
          userId: "user-123",
          variables: {},
          stepResults: {},
          abortSignal: new AbortController().signal,
        };

        const result = resolveInput(
          { limit: 10, enabled: true, data: { key: "value" } },
          mockContext,
        );

        expect(result.limit).toBe(10);
        expect(result.enabled).toBe(true);
        expect(result.data).toEqual({ key: "value" });
      });
    });

    describe("mapOutput", () => {
      it("should map output correctly", () => {
        const executor = getSkillStepExecutor();
        const mapOutput = (
          executor as unknown as {
            mapOutput: (
              data: unknown,
              mapping: Record<string, string>,
            ) => Record<string, unknown>;
          }
        ).mapOutput.bind(executor);

        const result = mapOutput(
          { searchResults: [1, 2, 3], count: 3 },
          { results: "searchResults", totalCount: "count" },
        );

        expect(result.results).toEqual([1, 2, 3]);
        expect(result.totalCount).toBe(3);
      });

      it("should handle null data in output mapping", () => {
        const executor = getSkillStepExecutor();
        const mapOutput = (
          executor as unknown as {
            mapOutput: (
              data: unknown,
              mapping: Record<string, string>,
            ) => Record<string, unknown>;
          }
        ).mapOutput.bind(executor);

        const result = mapOutput(null, { results: "searchResults" });

        expect(result).toEqual({});
      });

      it("should handle non-object data", () => {
        const executor = getSkillStepExecutor();
        const mapOutput = (
          executor as unknown as {
            mapOutput: (
              data: unknown,
              mapping: Record<string, string>,
            ) => Record<string, unknown>;
          }
        ).mapOutput.bind(executor);

        const result = mapOutput("string value", { results: "data" });

        expect(result).toEqual({});
      });
    });

    describe("formatSkillMessage", () => {
      it("should format skill message correctly", () => {
        const executor = getSkillStepExecutor();
        const formatSkillMessage = (
          executor as unknown as {
            formatSkillMessage: (
              skillId: string,
              input: Record<string, unknown>,
            ) => string;
          }
        ).formatSkillMessage.bind(executor);

        const message = formatSkillMessage("search", {
          query: "test",
          limit: 10,
        });

        expect(message).toContain("query: test");
        expect(message).toContain("limit: 10");
      });

      it("should format object inputs as JSON", () => {
        const executor = getSkillStepExecutor();
        const formatSkillMessage = (
          executor as unknown as {
            formatSkillMessage: (
              skillId: string,
              input: Record<string, unknown>,
            ) => string;
          }
        ).formatSkillMessage.bind(executor);

        const message = formatSkillMessage("search", {
          filters: { platform: "wechat" },
        });

        expect(message).toContain('filters: {"platform":"wechat"}');
      });

      it("should return default message for empty input", () => {
        const executor = getSkillStepExecutor();
        const formatSkillMessage = (
          executor as unknown as {
            formatSkillMessage: (
              skillId: string,
              input: Record<string, unknown>,
            ) => string;
          }
        ).formatSkillMessage.bind(executor);

        const message = formatSkillMessage("search", {});

        expect(message).toBe("执行 search");
      });
    });

    describe("getNestedValue", () => {
      it("should get simple value", () => {
        const executor = getSkillStepExecutor();
        const getNestedValue = (
          executor as unknown as {
            getNestedValue: (
              obj: Record<string, unknown>,
              path: string,
            ) => unknown;
          }
        ).getNestedValue.bind(executor);

        const result = getNestedValue({ name: "test" }, "name");

        expect(result).toBe("test");
      });

      it("should get nested value", () => {
        const executor = getSkillStepExecutor();
        const getNestedValue = (
          executor as unknown as {
            getNestedValue: (
              obj: Record<string, unknown>,
              path: string,
            ) => unknown;
          }
        ).getNestedValue.bind(executor);

        const result = getNestedValue(
          { user: { profile: { name: "test" } } },
          "user.profile.name",
        );

        expect(result).toBe("test");
      });

      it("should return undefined for non-existent path", () => {
        const executor = getSkillStepExecutor();
        const getNestedValue = (
          executor as unknown as {
            getNestedValue: (
              obj: Record<string, unknown>,
              path: string,
            ) => unknown;
          }
        ).getNestedValue.bind(executor);

        const result = getNestedValue({ name: "test" }, "nonExistent.path");

        expect(result).toBeUndefined();
      });

      it("should handle null in path", () => {
        const executor = getSkillStepExecutor();
        const getNestedValue = (
          executor as unknown as {
            getNestedValue: (
              obj: Record<string, unknown>,
              path: string,
            ) => unknown;
          }
        ).getNestedValue.bind(executor);

        const result = getNestedValue(
          { user: null } as Record<string, unknown>,
          "user.name",
        );

        expect(result).toBeUndefined();
      });
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getSkillStepExecutor();
      const instance2 = getSkillStepExecutor();
      expect(instance1).toBe(instance2);
    });
  });
});
