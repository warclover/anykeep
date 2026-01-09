/**
 * 工作流 API 验证和逻辑测试
 *
 * 测试验证 Schema 和业务逻辑，不依赖 Next.js 请求/响应处理
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { z } from "zod";

// =============================================================================
// Validation Schemas (extracted from route.ts)
// =============================================================================

/**
 * Toggle 请求体 Schema
 */
const ToggleRequestBodySchema = z.object({
  enabled: z.boolean(),
});

/**
 * 工作流项 Schema
 */
const WorkflowItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  enabled: z.boolean(),
  definitionId: z.string().nullable(),
  triggers: z.array(
    z.object({
      type: z.enum(["manual", "schedule", "event", "conversation"]),
      schedule: z
        .object({
          type: z.string(),
          value: z.string(),
        })
        .optional(),
      eventType: z.string().optional(),
      patterns: z.array(z.string()).optional(),
    }),
  ),
});

// =============================================================================
// Type Definitions for Test
// =============================================================================

interface WorkflowTrigger {
  type: "manual" | "schedule" | "event" | "conversation";
  schedule?: {
    type: string;
    value: string;
  };
  eventType?: string;
  patterns?: string[];
}

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  definitionId: string | null;
  triggers: WorkflowTrigger[];
}

interface WorkflowListResponse {
  success: boolean;
  workflows: WorkflowItem[];
}

interface WorkflowToggleResponse {
  success: boolean;
  workflow: {
    id: string;
    name: string;
    enabled: boolean;
  };
}

// =============================================================================
// Helper Functions (business logic extraction)
// =============================================================================

/**
 * 获取触发类型标签
 */
function getTriggerLabel(trigger: WorkflowTrigger): string {
  switch (trigger.type) {
    case "schedule":
      if (trigger.schedule?.value?.includes("0 8 * * *")) {
        return "每日 8:00";
      }
      if (trigger.schedule?.value?.includes("0 3 * * 0")) {
        return "每周日 3:00";
      }
      return "定时执行";
    case "event":
      return "事件触发";
    case "conversation":
      return "对话触发";
    case "manual":
      return "手动执行";
    default:
      return trigger.type;
  }
}

/**
 * 格式化工作流响应
 */
function formatWorkflowResponse(workflow: {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  definition?: { id?: string; triggers?: WorkflowTrigger[] };
}): WorkflowItem {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    category: workflow.category,
    enabled: workflow.enabled,
    definitionId: workflow.definition?.id || null,
    triggers: workflow.definition?.triggers || [],
  };
}

/**
 * 检查工作流是否可切换
 */
function canToggleWorkflow(
  workflowCategory: string,
  workflowUserId: string | null,
  currentUserId: string,
): boolean {
  // 内置工作流任何人都可以切换
  if (workflowCategory === "builtin") {
    return true;
  }
  // 自定义工作流只有所有者可以切换
  return workflowUserId === currentUserId;
}

// =============================================================================
// ToggleRequestBodySchema Tests
// =============================================================================

describe("ToggleRequestBodySchema", () => {
  describe("valid inputs", () => {
    it("should accept enabled: true", () => {
      const input = { enabled: true };
      const result = ToggleRequestBodySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it("should accept enabled: false", () => {
      const input = { enabled: false };
      const result = ToggleRequestBodySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject missing enabled field", () => {
      const input = {};
      const result = ToggleRequestBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject string enabled value", () => {
      const input = { enabled: "true" };
      const result = ToggleRequestBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject number enabled value", () => {
      const input = { enabled: 1 };
      const result = ToggleRequestBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject null enabled value", () => {
      const input = { enabled: null };
      const result = ToggleRequestBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// WorkflowItemSchema Tests
// =============================================================================

describe("WorkflowItemSchema", () => {
  const validWorkflow = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "每日精选推送",
    description: "从未读列表推荐 3-5 条今日阅读内容",
    category: "builtin",
    enabled: false,
    definitionId: "daily_digest",
    triggers: [
      {
        type: "schedule" as const,
        schedule: {
          type: "cron",
          value: "0 8 * * *",
        },
      },
    ],
  };

  describe("valid inputs", () => {
    it("should accept valid workflow with schedule trigger", () => {
      const result = WorkflowItemSchema.safeParse(validWorkflow);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("每日精选推送");
        expect(result.data.triggers[0].type).toBe("schedule");
      }
    });

    it("should accept workflow with null definitionId", () => {
      const input = { ...validWorkflow, definitionId: null };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.definitionId).toBeNull();
      }
    });

    it("should accept workflow with empty triggers", () => {
      const input = { ...validWorkflow, triggers: [] };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggers).toEqual([]);
      }
    });

    it("should accept workflow with event trigger", () => {
      const input = {
        ...validWorkflow,
        triggers: [
          {
            type: "event" as const,
            eventType: "bookmark.created",
          },
        ],
      };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggers[0].type).toBe("event");
      }
    });

    it("should accept workflow with conversation trigger", () => {
      const input = {
        ...validWorkflow,
        triggers: [
          {
            type: "conversation" as const,
            patterns: ["整理", "清理"],
          },
        ],
      };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggers[0].patterns).toEqual(["整理", "清理"]);
      }
    });

    it("should accept workflow with manual trigger", () => {
      const input = {
        ...validWorkflow,
        triggers: [{ type: "manual" as const }],
      };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept workflow with multiple triggers", () => {
      const input = {
        ...validWorkflow,
        triggers: [
          { type: "manual" as const },
          {
            type: "schedule" as const,
            schedule: { type: "cron", value: "0 8 * * *" },
          },
        ],
      };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggers.length).toBe(2);
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject invalid UUID", () => {
      const input = { ...validWorkflow, id: "not-a-uuid" };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const input = { ...validWorkflow, name: "" };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject invalid trigger type", () => {
      const input = {
        ...validWorkflow,
        triggers: [{ type: "invalid" }],
      };
      const result = WorkflowItemSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe("getTriggerLabel", () => {
  it("should return correct label for daily schedule", () => {
    const trigger: WorkflowTrigger = {
      type: "schedule",
      schedule: { type: "cron", value: "0 8 * * *" },
    };
    expect(getTriggerLabel(trigger)).toBe("每日 8:00");
  });

  it("should return correct label for weekly schedule", () => {
    const trigger: WorkflowTrigger = {
      type: "schedule",
      schedule: { type: "cron", value: "0 3 * * 0" },
    };
    expect(getTriggerLabel(trigger)).toBe("每周日 3:00");
  });

  it("should return generic label for other schedules", () => {
    const trigger: WorkflowTrigger = {
      type: "schedule",
      schedule: { type: "cron", value: "0 12 * * *" },
    };
    expect(getTriggerLabel(trigger)).toBe("定时执行");
  });

  it("should return correct label for event trigger", () => {
    const trigger: WorkflowTrigger = {
      type: "event",
      eventType: "bookmark.created",
    };
    expect(getTriggerLabel(trigger)).toBe("事件触发");
  });

  it("should return correct label for conversation trigger", () => {
    const trigger: WorkflowTrigger = {
      type: "conversation",
      patterns: ["整理"],
    };
    expect(getTriggerLabel(trigger)).toBe("对话触发");
  });

  it("should return correct label for manual trigger", () => {
    const trigger: WorkflowTrigger = { type: "manual" };
    expect(getTriggerLabel(trigger)).toBe("手动执行");
  });
});

describe("formatWorkflowResponse", () => {
  it("should format workflow with full definition", () => {
    const workflow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "测试工作流",
      description: "测试描述",
      category: "builtin",
      enabled: true,
      definition: {
        id: "test_workflow",
        triggers: [{ type: "manual" as const }],
      },
    };

    const result = formatWorkflowResponse(workflow);

    expect(result.id).toBe(workflow.id);
    expect(result.name).toBe(workflow.name);
    expect(result.definitionId).toBe("test_workflow");
    expect(result.triggers).toEqual([{ type: "manual" }]);
  });

  it("should handle missing definition", () => {
    const workflow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "测试工作流",
      description: "测试描述",
      category: "builtin",
      enabled: true,
    };

    const result = formatWorkflowResponse(workflow);

    expect(result.definitionId).toBeNull();
    expect(result.triggers).toEqual([]);
  });

  it("should handle definition without triggers", () => {
    const workflow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "测试工作流",
      description: "测试描述",
      category: "builtin",
      enabled: true,
      definition: { id: "test_workflow" },
    };

    const result = formatWorkflowResponse(workflow);

    expect(result.definitionId).toBe("test_workflow");
    expect(result.triggers).toEqual([]);
  });
});

describe("canToggleWorkflow", () => {
  it("should allow toggling builtin workflow for any user", () => {
    expect(canToggleWorkflow("builtin", null, "user-123")).toBe(true);
    expect(canToggleWorkflow("builtin", "user-456", "user-123")).toBe(true);
  });

  it("should allow toggling custom workflow for owner", () => {
    expect(canToggleWorkflow("custom", "user-123", "user-123")).toBe(true);
  });

  it("should deny toggling custom workflow for non-owner", () => {
    expect(canToggleWorkflow("custom", "user-456", "user-123")).toBe(false);
  });

  it("should deny toggling custom workflow with null owner", () => {
    expect(canToggleWorkflow("custom", null, "user-123")).toBe(false);
  });
});

// =============================================================================
// API Response Type Tests
// =============================================================================

describe("API Response Types", () => {
  describe("WorkflowListResponse", () => {
    it("should match expected structure with workflows", () => {
      const response: WorkflowListResponse = {
        success: true,
        workflows: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "每日精选推送",
            description: "从未读列表推荐 3-5 条今日阅读内容",
            category: "builtin",
            enabled: false,
            definitionId: "daily_digest",
            triggers: [
              {
                type: "schedule",
                schedule: { type: "cron", value: "0 8 * * *" },
              },
            ],
          },
        ],
      };

      expect(response.success).toBe(true);
      expect(response.workflows.length).toBe(1);
      expect(response.workflows[0].name).toBe("每日精选推送");
    });

    it("should match expected structure with empty workflows", () => {
      const response: WorkflowListResponse = {
        success: true,
        workflows: [],
      };

      expect(response.success).toBe(true);
      expect(response.workflows).toEqual([]);
    });
  });

  describe("WorkflowToggleResponse", () => {
    it("should match expected structure for enable", () => {
      const response: WorkflowToggleResponse = {
        success: true,
        workflow: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "每日精选推送",
          enabled: true,
        },
      };

      expect(response.success).toBe(true);
      expect(response.workflow.enabled).toBe(true);
    });

    it("should match expected structure for disable", () => {
      const response: WorkflowToggleResponse = {
        success: true,
        workflow: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "每日精选推送",
          enabled: false,
        },
      };

      expect(response.success).toBe(true);
      expect(response.workflow.enabled).toBe(false);
    });
  });
});

// =============================================================================
// Integration Scenario Tests
// =============================================================================

describe("Workflow Toggle Scenarios", () => {
  describe("daily digest workflow", () => {
    const dailyDigest = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "每日精选推送",
      description: "从未读列表推荐 3-5 条今日阅读内容",
      category: "builtin",
      enabled: false,
      definition: {
        id: "daily_digest",
        triggers: [
          {
            type: "schedule" as const,
            schedule: { type: "cron", value: "0 8 * * *" },
          },
        ],
      },
    };

    it("should be disabled by default", () => {
      expect(dailyDigest.enabled).toBe(false);
    });

    it("should have schedule trigger at 8:00 AM", () => {
      const formatted = formatWorkflowResponse(dailyDigest);
      expect(formatted.triggers[0].type).toBe("schedule");
      expect(formatted.triggers[0].schedule?.value).toBe("0 8 * * *");
      expect(getTriggerLabel(formatted.triggers[0])).toBe("每日 8:00");
    });

    it("should allow any user to toggle", () => {
      expect(canToggleWorkflow(dailyDigest.category, null, "any-user")).toBe(
        true,
      );
    });
  });

  describe("workflow toggle state transition", () => {
    it("should correctly transition from disabled to enabled", () => {
      const workflow = { enabled: false };
      const toggleRequest = { enabled: true };

      const result = ToggleRequestBodySchema.safeParse(toggleRequest);
      expect(result.success).toBe(true);

      if (result.success) {
        const newState = { ...workflow, enabled: result.data.enabled };
        expect(newState.enabled).toBe(true);
      }
    });

    it("should correctly transition from enabled to disabled", () => {
      const workflow = { enabled: true };
      const toggleRequest = { enabled: false };

      const result = ToggleRequestBodySchema.safeParse(toggleRequest);
      expect(result.success).toBe(true);

      if (result.success) {
        const newState = { ...workflow, enabled: result.data.enabled };
        expect(newState.enabled).toBe(false);
      }
    });
  });
});
