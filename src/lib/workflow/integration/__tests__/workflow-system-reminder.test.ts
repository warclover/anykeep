/**
 * WorkflowSystemReminder 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect } from "@jest/globals";
import {
  generateWorkflowCompletionReminder,
  generateWorkflowRecommendationReminder,
  workflowSystemReminders,
  getWorkflowSystemReminders,
  type SystemReminderContext,
} from "../workflow-system-reminder";
import type {
  WorkflowNotificationContext,
  WorkflowRecommendation,
} from "../types";

describe("WorkflowSystemReminder", () => {
  describe("generateWorkflowCompletionReminder", () => {
    it("should generate reminder for completed workflow", () => {
      const context: WorkflowNotificationContext = {
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "周度整理",
        executionId: "exec-123",
        status: "completed",
        summary: "已整理 50 条书签",
      };

      const reminder = generateWorkflowCompletionReminder(context);

      expect(reminder).toContain("工作流完成");
      expect(reminder).toContain("周度整理");
      expect(reminder).toContain("已整理 50 条书签");
    });

    it("should generate reminder for failed workflow", () => {
      const context: WorkflowNotificationContext = {
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "链接检查",
        executionId: "exec-123",
        status: "failed",
        summary: "执行失败",
        error: "网络连接超时",
      };

      const reminder = generateWorkflowCompletionReminder(context);

      expect(reminder).toContain("工作流异常");
      expect(reminder).toContain("链接检查");
      expect(reminder).toContain("网络连接超时");
    });

    it("should generate reminder for waiting_confirmation workflow", () => {
      const context: WorkflowNotificationContext = {
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "重复清理",
        executionId: "exec-123",
        status: "waiting_confirmation",
        summary: "发现 10 条重复，是否删除？",
      };

      const reminder = generateWorkflowCompletionReminder(context);

      expect(reminder).toContain("等待确认");
      expect(reminder).toContain("重复清理");
      expect(reminder).toContain("发现 10 条重复");
    });

    it("should use default error message when error is undefined", () => {
      const context: WorkflowNotificationContext = {
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "测试",
        executionId: "exec-123",
        status: "failed",
        summary: "失败",
      };

      const reminder = generateWorkflowCompletionReminder(context);

      expect(reminder).toContain("未知错误");
    });

    it("should return empty string for unknown status", () => {
      const context: WorkflowNotificationContext = {
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "测试",
        executionId: "exec-123",
        status: "unknown" as "completed",
        summary: "未知",
      };

      const reminder = generateWorkflowCompletionReminder(context);

      expect(reminder).toBe("");
    });
  });

  describe("generateWorkflowRecommendationReminder", () => {
    it("should generate reminder for high priority recommendation", () => {
      const recommendations: WorkflowRecommendation[] = [
        {
          workflowId: "smart_intake",
          workflowName: "智能收录",
          reason: "您有 60 条书签尚未分类",
          priority: "high",
          score: 90,
        },
      ];

      const reminder = generateWorkflowRecommendationReminder(recommendations);

      expect(reminder).toContain("推荐工作流");
      expect(reminder).toContain("60 条书签尚未分类");
      expect(reminder).toContain("智能收录");
    });

    it("should return empty string for medium priority", () => {
      const recommendations: WorkflowRecommendation[] = [
        {
          workflowId: "weekly_organize",
          workflowName: "周度整理",
          reason: "本周尚未整理",
          priority: "medium",
          score: 75,
        },
      ];

      const reminder = generateWorkflowRecommendationReminder(recommendations);

      expect(reminder).toBe("");
    });

    it("should return empty string for low priority", () => {
      const recommendations: WorkflowRecommendation[] = [
        {
          workflowId: "topic_deep_dive",
          workflowName: "主题深挖",
          reason: "建议学习",
          priority: "low",
          score: 60,
        },
      ];

      const reminder = generateWorkflowRecommendationReminder(recommendations);

      expect(reminder).toBe("");
    });

    it("should return empty string for empty recommendations", () => {
      const reminder = generateWorkflowRecommendationReminder([]);

      expect(reminder).toBe("");
    });

    it("should only consider top recommendation", () => {
      const recommendations: WorkflowRecommendation[] = [
        {
          workflowId: "medium_one",
          workflowName: "中优先级",
          reason: "理由1",
          priority: "medium",
          score: 80,
        },
        {
          workflowId: "high_one",
          workflowName: "高优先级",
          reason: "理由2",
          priority: "high",
          score: 70,
        },
      ];

      const reminder = generateWorkflowRecommendationReminder(recommendations);

      // Only top (first) recommendation is considered
      expect(reminder).toBe("");
    });
  });

  describe("workflowSystemReminders", () => {
    it("should have workflow-completion trigger", () => {
      const completionTrigger = workflowSystemReminders.find(
        (t) => t.id === "workflow-completion",
      );

      expect(completionTrigger).toBeDefined();
      expect(completionTrigger?.priority).toBe(95);
    });

    it("should have workflow-recommendation trigger", () => {
      const recommendationTrigger = workflowSystemReminders.find(
        (t) => t.id === "workflow-recommendation",
      );

      expect(recommendationTrigger).toBeDefined();
      expect(recommendationTrigger?.priority).toBe(50);
    });
  });

  describe("getWorkflowSystemReminders", () => {
    it("should return completion reminder when context has workflowCompletion", () => {
      const context: SystemReminderContext = {
        workflowCompletion: {
          userId: "user-123",
          workflowId: "workflow-1",
          workflowName: "测试工作流",
          executionId: "exec-123",
          status: "completed",
          summary: "测试完成",
        },
      };

      const reminders = getWorkflowSystemReminders(context);

      expect(reminders.length).toBe(1);
      expect(reminders[0].id).toBe("workflow-completion");
      expect(reminders[0].content).toContain("测试工作流");
    });

    it("should return recommendation reminder for high priority", () => {
      const context: SystemReminderContext = {
        workflowRecommendations: [
          {
            workflowId: "smart_intake",
            workflowName: "智能收录",
            reason: "有很多未分类书签",
            priority: "high",
            score: 90,
          },
        ],
      };

      const reminders = getWorkflowSystemReminders(context);

      expect(reminders.length).toBe(1);
      expect(reminders[0].id).toBe("workflow-recommendation");
    });

    it("should return multiple reminders sorted by priority", () => {
      const context: SystemReminderContext = {
        workflowCompletion: {
          userId: "user-123",
          workflowId: "workflow-1",
          workflowName: "完成的工作流",
          executionId: "exec-123",
          status: "completed",
          summary: "完成",
        },
        workflowRecommendations: [
          {
            workflowId: "smart_intake",
            workflowName: "智能收录",
            reason: "推荐",
            priority: "high",
            score: 90,
          },
        ],
      };

      const reminders = getWorkflowSystemReminders(context);

      expect(reminders.length).toBe(2);
      // Completion has priority 95, recommendation has priority 50
      expect(reminders[0].id).toBe("workflow-completion");
      expect(reminders[1].id).toBe("workflow-recommendation");
    });

    it("should return empty array when no triggers match", () => {
      const context: SystemReminderContext = {};

      const reminders = getWorkflowSystemReminders(context);

      expect(reminders).toEqual([]);
    });

    it("should not return reminder for medium priority recommendations", () => {
      const context: SystemReminderContext = {
        workflowRecommendations: [
          {
            workflowId: "weekly_organize",
            workflowName: "周度整理",
            reason: "建议整理",
            priority: "medium",
            score: 75,
          },
        ],
      };

      const reminders = getWorkflowSystemReminders(context);

      expect(reminders).toEqual([]);
    });
  });

  describe("trigger generators", () => {
    it("should handle null workflowCompletion", () => {
      const completionTrigger = workflowSystemReminders.find(
        (t) => t.id === "workflow-completion",
      );

      const result = completionTrigger?.generator({});

      expect(result).toBeNull();
    });

    it("should handle null workflowRecommendations", () => {
      const recommendationTrigger = workflowSystemReminders.find(
        (t) => t.id === "workflow-recommendation",
      );

      const result = recommendationTrigger?.generator({});

      expect(result).toBeNull();
    });
  });
});
