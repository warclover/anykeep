/**
 * Workflow Execution Integration Test
 *
 * 测试工作流编排器、执行引擎、状态管理器之间的集成
 * 使用全局 Mock 策略避免深层依赖链问题
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
import type { WorkflowDefinition, WorkflowExecution } from "../../types";

// 从全局 mock 导入配置函数
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = require("@/lib/supabase/server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stateManagerMock = require("@/lib/workflow/state/state-manager");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const executionEngineMock = require("@/lib/workflow/engine/execution-engine");

// Mock workflow definition
const mockWorkflowDefinition: WorkflowDefinition = {
  id: "bookmark_health_simple",
  name: "书签健康检查（简化版）",
  description: "检查书签链接有效性",
  version: "1.0.0",
  category: "builtin",
  triggers: [{ type: "manual" }],
  steps: [
    {
      id: "check_links",
      name: "检查链接",
      type: "skill",
      config: {
        skillId: "link_health_check",
        inputMapping: { limit: 100 },
      },
    },
    {
      id: "generate_report",
      name: "生成报告",
      type: "skill",
      config: {
        skillId: "insight_report",
        inputMapping: {},
      },
    },
  ],
  config: {
    timeout: 120000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};

// Mock data
const testUserId = "test-user-integration-id";
const mockWorkflowDbId = "workflow-db-uuid-123";
const mockExecutionId = "exec-integration-uuid-123";

// Mock execution record factory
const createMockExecution = (
  overrides: Partial<WorkflowExecution> = {},
): WorkflowExecution => ({
  id: mockExecutionId,
  workflowId: mockWorkflowDbId,
  workflowName: mockWorkflowDefinition.name,
  userId: testUserId,
  status: "pending",
  triggerType: "manual",
  triggerContext: {},
  currentStepIndex: 0,
  steps: [],
  totalSteps: mockWorkflowDefinition.steps.length,
  progress: 0,
  startedAt: new Date().toISOString(),
  ...overrides,
});

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

// Import after ALL mocks are set up
import {
  WorkflowOrchestrator,
  getWorkflowOrchestrator,
} from "../../orchestrator/workflow-orchestrator";

describe("Workflow Execution Integration", () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.__resetMockResponses();
    executionEngineMock.__resetMocks();

    // 配置 Supabase mock 响应 - workflow 查询
    supabaseMock.__setMockResponse("workflows.select.single", {
      data: {
        id: mockWorkflowDbId,
        definition: mockWorkflowDefinition,
      },
      error: null,
    });

    // 配置 workflow 列表查询
    supabaseMock.__setMockResponse("workflows.select.list", {
      data: [
        {
          definition: mockWorkflowDefinition,
        },
      ],
      error: null,
    });

    // Reset mock implementations with default behaviors
    stateManagerMock.__mockStateManager.createExecution.mockResolvedValue(
      createMockExecution(),
    );
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      createMockExecution(),
    );
    stateManagerMock.__mockStateManager.updateStatus.mockResolvedValue(
      undefined,
    );
    stateManagerMock.__mockStateManager.listExecutions.mockResolvedValue([
      createMockExecution(),
    ]);

    orchestrator = new WorkflowOrchestrator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startWorkflow", () => {
    it("should create execution with pending status", async () => {
      const execution = await orchestrator.startWorkflow(
        mockWorkflowDefinition.id,
        testUserId,
      );

      expect(execution).toBeDefined();
      expect(execution.id).toBe(mockExecutionId);
      expect(execution.status).toBe("pending");
      expect(
        stateManagerMock.__mockStateManager.createExecution,
      ).toHaveBeenCalled();
    });

    it("should accept custom trigger type and context", async () => {
      stateManagerMock.__mockStateManager.createExecution.mockResolvedValueOnce(
        createMockExecution({
          triggerType: "event",
          triggerContext: { eventName: "bookmark_added" },
        }),
      );

      const execution = await orchestrator.startWorkflow(
        mockWorkflowDefinition.id,
        testUserId,
        {
          triggerType: "event",
          triggerContext: { eventName: "bookmark_added", bookmarkId: "bk-123" },
        },
      );

      expect(execution).toBeDefined();
      expect(
        stateManagerMock.__mockStateManager.createExecution,
      ).toHaveBeenCalled();
    });

    it("should trigger async execution after creating record", async () => {
      await orchestrator.startWorkflow(mockWorkflowDefinition.id, testUserId);

      // Wait for async execution to be scheduled
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(
        executionEngineMock.__mockExecutionEngine.execute,
      ).toHaveBeenCalled();
    });
  });

  describe("getExecution", () => {
    it("should return execution from state manager", async () => {
      const execution = await orchestrator.getExecution(mockExecutionId);

      expect(execution).toBeDefined();
      expect(execution?.id).toBe(mockExecutionId);
      expect(
        stateManagerMock.__mockStateManager.getExecution,
      ).toHaveBeenCalledWith(mockExecutionId);
    });

    it("should return null for non-existent execution", async () => {
      stateManagerMock.__mockStateManager.getExecution.mockResolvedValueOnce(
        null,
      );

      const execution = await orchestrator.getExecution("non-existent-id");

      expect(execution).toBeNull();
    });
  });

  describe("cancelWorkflow", () => {
    it("should cancel a workflow and update status", async () => {
      const cancelled = await orchestrator.cancelWorkflow(mockExecutionId);

      expect(cancelled).toBe(true);
      expect(
        executionEngineMock.__mockExecutionEngine.cancel,
      ).toHaveBeenCalledWith(mockExecutionId);
      expect(
        stateManagerMock.__mockStateManager.updateStatus,
      ).toHaveBeenCalledWith(mockExecutionId, "cancelled");
    });

    it("should return false if execution engine cannot cancel", async () => {
      executionEngineMock.__mockExecutionEngine.cancel.mockReturnValueOnce(
        false,
      );

      const cancelled = await orchestrator.cancelWorkflow("non-existent-id");

      expect(cancelled).toBe(false);
      expect(
        stateManagerMock.__mockStateManager.updateStatus,
      ).not.toHaveBeenCalled();
    });
  });

  describe("listExecutions", () => {
    it("should delegate to state manager", async () => {
      const executions = await orchestrator.listExecutions(testUserId);

      expect(executions).toBeDefined();
      expect(Array.isArray(executions)).toBe(true);
      expect(
        stateManagerMock.__mockStateManager.listExecutions,
      ).toHaveBeenCalledWith(testUserId, undefined);
    });

    it("should pass options to state manager", async () => {
      const options = { limit: 10, status: "completed" as const };
      await orchestrator.listExecutions(testUserId, options);

      expect(
        stateManagerMock.__mockStateManager.listExecutions,
      ).toHaveBeenCalledWith(testUserId, options);
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance from getWorkflowOrchestrator", () => {
      const instance1 = getWorkflowOrchestrator();
      const instance2 = getWorkflowOrchestrator();

      expect(instance1).toBe(instance2);
    });
  });
});

describe("Workflow Definition Validation", () => {
  it("should have valid workflow definition structure", () => {
    const workflow = mockWorkflowDefinition;

    expect(workflow.id).toBe("bookmark_health_simple");
    expect(workflow.name).toBeDefined();
    expect(workflow.version).toBeDefined();
    expect(workflow.steps).toBeDefined();
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.triggers).toBeDefined();
    expect(workflow.config).toBeDefined();
  });

  it("should have required fields in each step", () => {
    mockWorkflowDefinition.steps.forEach((step) => {
      expect(step.id).toBeDefined();
      expect(step.name).toBeDefined();
      expect(step.type).toBeDefined();
      expect(step.config).toBeDefined();
    });
  });

  it("should have valid step types", () => {
    const validTypes = ["skill", "condition", "wait", "parallel", "loop"];

    mockWorkflowDefinition.steps.forEach((step) => {
      expect(validTypes).toContain(step.type);
    });
  });

  it("should have valid trigger configuration", () => {
    const validTriggerTypes = ["manual", "event", "schedule", "conversation"];

    mockWorkflowDefinition.triggers.forEach((trigger) => {
      expect(validTriggerTypes).toContain(trigger.type);
    });
  });
});

describe("Execution State Transitions", () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.__resetMockResponses();
    executionEngineMock.__resetMocks();

    supabaseMock.__setMockResponse("workflows.select.single", {
      data: {
        id: mockWorkflowDbId,
        definition: mockWorkflowDefinition,
      },
      error: null,
    });

    stateManagerMock.__mockStateManager.createExecution.mockResolvedValue(
      createMockExecution(),
    );
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      createMockExecution(),
    );
    stateManagerMock.__mockStateManager.updateStatus.mockResolvedValue(
      undefined,
    );

    orchestrator = new WorkflowOrchestrator();
  });

  it("should track pending to running transition", async () => {
    stateManagerMock.__mockStateManager.getExecution
      .mockResolvedValueOnce(createMockExecution({ status: "pending" }))
      .mockResolvedValueOnce(createMockExecution({ status: "running" }));

    const pending = await orchestrator.getExecution(mockExecutionId);
    expect(pending?.status).toBe("pending");

    const running = await orchestrator.getExecution(mockExecutionId);
    expect(running?.status).toBe("running");
  });

  it("should track step progress", async () => {
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      createMockExecution({
        status: "running",
        currentStepIndex: 1,
        progress: 50,
        steps: [
          {
            stepId: "check_links",
            stepName: "检查链接",
            status: "completed",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
      }),
    );

    const execution = await orchestrator.getExecution(mockExecutionId);

    expect(execution?.currentStepIndex).toBe(1);
    expect(execution?.progress).toBe(50);
    expect(execution?.steps).toHaveLength(1);
    expect(execution?.steps[0].status).toBe("completed");
  });

  it("should handle workflow completion", async () => {
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      createMockExecution({
        status: "completed",
        currentStepIndex: 2,
        progress: 100,
        completedAt: new Date().toISOString(),
        steps: [
          {
            stepId: "check_links",
            stepName: "检查链接",
            status: "completed",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          {
            stepId: "generate_report",
            stepName: "生成报告",
            status: "completed",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
      }),
    );

    const execution = await orchestrator.getExecution(mockExecutionId);

    expect(execution?.status).toBe("completed");
    expect(execution?.progress).toBe(100);
    expect(execution?.completedAt).toBeDefined();
  });

  it("should handle workflow failure", async () => {
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      createMockExecution({
        status: "failed",
        errorMessage: "Step execution failed: Network timeout",
        steps: [
          {
            stepId: "check_links",
            stepName: "检查链接",
            status: "failed",
            error: "Network timeout",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
      }),
    );

    const execution = await orchestrator.getExecution(mockExecutionId);

    expect(execution?.status).toBe("failed");
    expect(execution?.errorMessage).toContain("Network timeout");
  });
});

describe("Error Handling", () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.__resetMockResponses();
    executionEngineMock.__resetMocks();

    supabaseMock.__setMockResponse("workflows.select.single", {
      data: {
        id: mockWorkflowDbId,
        definition: mockWorkflowDefinition,
      },
      error: null,
    });

    stateManagerMock.__mockStateManager.createExecution.mockResolvedValue(
      createMockExecution(),
    );
    stateManagerMock.__mockStateManager.getExecution.mockResolvedValue(
      createMockExecution(),
    );

    orchestrator = new WorkflowOrchestrator();
  });

  it("should handle state manager errors gracefully", async () => {
    stateManagerMock.__mockStateManager.getExecution.mockRejectedValueOnce(
      new Error("Database connection failed"),
    );

    await expect(orchestrator.getExecution(mockExecutionId)).rejects.toThrow(
      "Database connection failed",
    );
  });

  it("should handle execution engine errors gracefully", async () => {
    executionEngineMock.__mockExecutionEngine.execute.mockRejectedValueOnce(
      new Error("Skill execution failed"),
    );

    // Start workflow - this should not throw because execution is async
    const execution = await orchestrator.startWorkflow(
      mockWorkflowDefinition.id,
      testUserId,
    );

    expect(execution).toBeDefined();
    // The error would be logged, but startWorkflow returns the initial execution
  });
});
