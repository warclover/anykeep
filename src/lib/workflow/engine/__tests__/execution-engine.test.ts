/**
 * ExecutionEngine 单元测试
 *
 * 测试公共接口的基本行为。
 * 由于 ExecutionEngine 在 jest.setup.ts 中被全局 mock，
 * 此测试验证 mock 配置和接口契约。
 *
 * 核心逻辑的单元测试：
 * - resolveInputMapping → input-mapper.test.ts
 * - getNestedValue → object-utils.test.ts
 *
 * 集成测试：
 * - workflow-execution.test.ts 验证完整执行流程
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

// 从全局 mock 导入
// eslint-disable-next-line @typescript-eslint/no-require-imports
const executionEngineMock = require("@/lib/workflow/engine/execution-engine");

describe("ExecutionEngine", () => {
  beforeEach(() => {
    executionEngineMock.__resetMocks();
  });

  describe("mock configuration", () => {
    it("should have ExecutionEngine constructor", () => {
      expect(executionEngineMock.ExecutionEngine).toBeDefined();
      expect(typeof executionEngineMock.ExecutionEngine).toBe("function");
    });

    it("should have getExecutionEngine function", () => {
      expect(executionEngineMock.getExecutionEngine).toBeDefined();
      expect(typeof executionEngineMock.getExecutionEngine).toBe("function");
    });

    it("should expose __mockExecutionEngine for test configuration", () => {
      expect(executionEngineMock.__mockExecutionEngine).toBeDefined();
      expect(executionEngineMock.__mockExecutionEngine.execute).toBeDefined();
      expect(executionEngineMock.__mockExecutionEngine.cancel).toBeDefined();
      expect(executionEngineMock.__mockExecutionEngine.isRunning).toBeDefined();
    });
  });

  describe("interface contract", () => {
    it("execute should return a Promise", async () => {
      const engine = executionEngineMock.getExecutionEngine();
      const result = engine.execute("exec-id", {}, "user-id", {});

      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    it("cancel should return boolean", () => {
      const engine = executionEngineMock.getExecutionEngine();
      const result = engine.cancel("exec-id");

      expect(typeof result).toBe("boolean");
    });

    it("isRunning should return boolean", () => {
      const engine = executionEngineMock.getExecutionEngine();
      const result = engine.isRunning("exec-id");

      expect(typeof result).toBe("boolean");
    });
  });

  describe("mock reset", () => {
    it("__resetMocks should clear mock calls", () => {
      const engine = executionEngineMock.getExecutionEngine();

      // Make some calls
      engine.execute("id1", {}, "user", {});
      engine.cancel("id2");
      engine.isRunning("id3");

      // Reset
      executionEngineMock.__resetMocks();

      // Verify cleared
      expect(engine.execute).not.toHaveBeenCalled();
      expect(engine.cancel).not.toHaveBeenCalled();
      expect(engine.isRunning).not.toHaveBeenCalled();
    });

    it("__resetMocks should restore default return values", () => {
      const engine = executionEngineMock.getExecutionEngine();

      // Modify return values
      engine.cancel.mockReturnValue(false);
      engine.isRunning.mockReturnValue(true);

      // Reset
      executionEngineMock.__resetMocks();

      // Verify restored to defaults
      expect(engine.cancel("any")).toBe(true);
      expect(engine.isRunning("any")).toBe(false);
    });
  });
});
