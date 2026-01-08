/**
 * StateManager 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// Unmock the module we're testing (it's globally mocked in jest.setup.ts)
jest.unmock("../state-manager");

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { StateManager } from "../state-manager";
import type { WorkflowDefinition } from "../../types";

// 从全局 mock 导入配置函数
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = require("@/lib/supabase/server");

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("StateManager", () => {
  let stateManager: StateManager;

  const mockWorkflow: WorkflowDefinition = {
    id: "test_workflow",
    name: "Test Workflow",
    description: "A test workflow",
    version: "1.0.0",
    category: "builtin",
    triggers: [{ type: "manual" }],
    steps: [
      {
        id: "step1",
        name: "Step 1",
        type: "skill",
        config: {
          skillId: "test_skill",
          inputMapping: {},
        },
      },
    ],
    config: {
      timeout: 60000,
      notifyOnComplete: false,
      notifyOnFailure: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.__resetMockResponses();
    stateManager = new StateManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createExecution", () => {
    it("should create execution with pending status", async () => {
      // 配置 mock 响应
      supabaseMock.__setMockResponse("workflows.select.single", {
        data: { id: "workflow-uuid-123" },
        error: null,
      });

      supabaseMock.__setMockResponse("workflow_executions.insert.single", {
        data: {
          id: "exec-uuid-123",
          workflow_id: "workflow-uuid-123",
          user_id: "user-123",
          status: "pending",
          trigger_type: "manual",
          trigger_context: {},
          current_step_index: 0,
          step_results: [],
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const execution = await stateManager.createExecution(
        mockWorkflow,
        "user-123",
        "manual",
        {},
      );

      expect(execution.id).toBe("exec-uuid-123");
      expect(execution.status).toBe("pending");
      expect(execution.userId).toBe("user-123");
      expect(execution.triggerType).toBe("manual");
    });

    it("should throw error when workflow not found", async () => {
      supabaseMock.__setMockResponse("workflows.select.single", {
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });

      await expect(
        stateManager.createExecution(mockWorkflow, "user-123", "manual", {}),
      ).rejects.toThrow("Workflow not found in database");
    });

    it("should throw error when insert fails", async () => {
      supabaseMock.__setMockResponse("workflows.select.single", {
        data: { id: "workflow-uuid-123" },
        error: null,
      });

      supabaseMock.__setMockResponse("workflow_executions.insert.single", {
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(
        stateManager.createExecution(mockWorkflow, "user-123", "manual", {}),
      ).rejects.toThrow("Failed to create execution");
    });
  });

  describe("getExecution", () => {
    it("should return execution by id", async () => {
      supabaseMock.__setMockResponse("workflow_executions.select.single", {
        data: {
          id: "exec-123",
          workflow_id: "wf-123",
          user_id: "user-123",
          status: "running",
          trigger_type: "manual",
          trigger_context: {},
          current_step_index: 1,
          step_results: [],
          started_at: new Date().toISOString(),
          workflows: {
            definition: mockWorkflow,
            name: mockWorkflow.name,
          },
        },
        error: null,
      });

      const execution = await stateManager.getExecution("exec-123");

      expect(execution).toBeDefined();
      expect(execution?.id).toBe("exec-123");
      expect(execution?.status).toBe("running");
    });

    it("should return null for non-existent execution", async () => {
      supabaseMock.__setMockResponse("workflow_executions.select.single", {
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });

      const execution = await stateManager.getExecution("non-existent");

      expect(execution).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("should update execution status without error", async () => {
      supabaseMock.__setMockResponse("workflow_executions.update", {
        error: null,
      });

      await expect(
        stateManager.updateStatus("exec-123", "completed"),
      ).resolves.not.toThrow();
    });
  });

  describe("mapToExecution", () => {
    it("should calculate progress correctly", () => {
      const manager = stateManager as unknown as {
        mapToExecution: (
          row: Record<string, unknown>,
          workflow?: WorkflowDefinition,
        ) => unknown;
      };

      const row = {
        id: "exec-123",
        workflow_id: "wf-123",
        user_id: "user-123",
        status: "running",
        trigger_type: "manual",
        trigger_context: {},
        current_step_index: 1,
        step_results: [
          { stepId: "step1", stepName: "Step 1", status: "completed" },
        ],
        started_at: new Date().toISOString(),
      };

      const workflowWith2Steps: WorkflowDefinition = {
        ...mockWorkflow,
        steps: [
          {
            id: "step1",
            name: "Step 1",
            type: "skill",
            config: { skillId: "s1", inputMapping: {} },
          },
          {
            id: "step2",
            name: "Step 2",
            type: "skill",
            config: { skillId: "s2", inputMapping: {} },
          },
        ],
      };

      const execution = manager.mapToExecution(row, workflowWith2Steps);

      expect((execution as { progress: number }).progress).toBe(50);
    });

    it("should handle missing workflow gracefully", () => {
      const manager = stateManager as unknown as {
        mapToExecution: (
          row: Record<string, unknown>,
          workflow?: WorkflowDefinition,
        ) => unknown;
      };

      const row = {
        id: "exec-123",
        workflow_id: "wf-123",
        user_id: "user-123",
        status: "pending",
        trigger_type: "manual",
        trigger_context: {},
        current_step_index: 0,
        step_results: [],
        started_at: new Date().toISOString(),
      };

      const execution = manager.mapToExecution(row, undefined);

      expect((execution as { totalSteps: number }).totalSteps).toBe(0);
      expect((execution as { progress: number }).progress).toBe(0);
    });

    it("should extract workflow name from row when workflow is missing", () => {
      const manager = stateManager as unknown as {
        mapToExecution: (
          row: Record<string, unknown>,
          workflow?: WorkflowDefinition,
        ) => unknown;
      };

      const row = {
        id: "exec-123",
        workflow_id: "wf-123",
        user_id: "user-123",
        status: "pending",
        trigger_type: "manual",
        trigger_context: {},
        current_step_index: 0,
        step_results: [],
        started_at: new Date().toISOString(),
        workflows: { name: "Workflow From DB" },
      };

      const execution = manager.mapToExecution(row, undefined);

      expect((execution as { workflowName: string }).workflowName).toBe(
        "Workflow From DB",
      );
    });
  });

  describe("listExecutions", () => {
    it("should list user executions", async () => {
      supabaseMock.__setMockResponse("workflow_executions.select.list", {
        data: [
          {
            id: "exec-1",
            workflow_id: "wf-1",
            user_id: "user-123",
            status: "completed",
            trigger_type: "manual",
            trigger_context: {},
            current_step_index: 1,
            step_results: [],
            started_at: new Date().toISOString(),
            workflows: { definition: mockWorkflow },
          },
        ],
        error: null,
      });

      const executions = await stateManager.listExecutions("user-123");

      expect(executions).toBeDefined();
      expect(Array.isArray(executions)).toBe(true);
    });

    it("should return empty array on error", async () => {
      supabaseMock.__setMockResponse("workflow_executions.select.list", {
        data: null,
        error: { message: "Database error" },
      });

      const executions = await stateManager.listExecutions("user-123");

      expect(executions).toEqual([]);
    });
  });
});
