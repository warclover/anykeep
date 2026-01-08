/**
 * WorkflowOrchestrator 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from "@jest/globals";
import type { WorkflowExecution } from "../../types";

// 从全局 mock 导入配置函数
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = require("@/lib/supabase/server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stateManagerMock = require("@/lib/workflow/state/state-manager");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const executionEngineMock = require("@/lib/workflow/engine/execution-engine");

// Note: All mocks are defined globally in jest.setup.ts
// - @/lib/supabase/server
// - @/lib/workflow/state/state-manager
// - @/lib/workflow/engine/execution-engine

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import AFTER all mocks are declared
import { WorkflowOrchestrator } from "../workflow-orchestrator";

// Mock execution data
const mockExecution: WorkflowExecution = {
  id: "exec-123",
  workflowId: "wf-123",
  workflowName: "Test Workflow",
  userId: "user-123",
  status: "pending",
  triggerType: "manual",
  triggerContext: {},
  currentStepIndex: 0,
  steps: [],
  totalSteps: 2,
  progress: 0,
  startedAt: new Date().toISOString(),
};

describe("WorkflowOrchestrator", () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    supabaseMock.__resetMockResponses();
    executionEngineMock.__resetMocks();

    // 配置 Supabase mock 响应 - workflow 查询
    supabaseMock.__setMockResponse("workflows.select.single", {
      data: {
        id: "wf-uuid-123",
        definition: {
          id: "test_workflow",
          name: "Test Workflow",
          steps: [],
          triggers: [],
          config: {},
        },
      },
      error: null,
    });

    // 配置 workflow 列表查询
    supabaseMock.__setMockResponse("workflows.select.list", {
      data: [
        {
          definition: {
            id: "test_workflow",
            name: "Test Workflow",
          },
        },
      ],
      error: null,
    });

    // 配置 StateManager mock 返回值
    stateManagerMock.__mockStateManager.createExecution.mockResolvedValue(
      mockExecution,
    );
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      mockExecution,
    );
    stateManagerMock.__mockStateManager.updateStatus.mockResolvedValue(
      undefined,
    );
    stateManagerMock.__mockStateManager.listExecutions.mockResolvedValue([
      mockExecution,
    ]);

    orchestrator = new WorkflowOrchestrator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startWorkflow", () => {
    it("should start a workflow and return execution", async () => {
      const execution = await orchestrator.startWorkflow(
        "test_workflow",
        "user-123",
      );

      expect(execution).toBeDefined();
      expect(execution.id).toBe("exec-123");
      expect(execution.status).toBe("pending");
    });

    it("should accept trigger context", async () => {
      const execution = await orchestrator.startWorkflow(
        "test_workflow",
        "user-123",
        {
          triggerType: "manual",
          triggerContext: { source: "api" },
        },
      );

      expect(execution).toBeDefined();
    });
  });

  describe("getExecution", () => {
    it("should return execution by id", async () => {
      const execution = await orchestrator.getExecution("exec-123");

      expect(execution).toBeDefined();
      expect(execution?.id).toBe("exec-123");
    });
  });

  describe("cancelWorkflow", () => {
    it("should cancel running workflow", async () => {
      const cancelled = await orchestrator.cancelWorkflow("exec-123");

      expect(cancelled).toBe(true);
      expect(
        executionEngineMock.__mockExecutionEngine.cancel,
      ).toHaveBeenCalledWith("exec-123");
    });
  });

  describe("listExecutions", () => {
    it("should list user executions", async () => {
      const executions = await orchestrator.listExecutions("user-123");

      expect(executions).toHaveLength(1);
      expect(executions[0].id).toBe("exec-123");
    });
  });
});
