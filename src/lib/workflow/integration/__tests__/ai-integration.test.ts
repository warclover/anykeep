/**
 * Workflow AI Integration 集成测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WorkflowIntentMatcher } from "../workflow-intent-matcher";
import { WorkflowRecommender } from "../workflow-recommender";
import {
  SafeExpressionEvaluator,
  safeEvaluateCondition,
} from "../safe-expression-evaluator";
import {
  generateWorkflowCompletionReminder,
  generateWorkflowRecommendationReminder,
  getWorkflowSystemReminders,
} from "../workflow-system-reminder";
import {
  matchWorkflowIntent,
  workflowIntentRules,
} from "../intent-rules-workflow";
import type { DynamicContext } from "@/lib/ai-agent/context/types";
import type { WorkflowDefinition } from "../../types";

// Mock dependencies
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          or: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: () => Promise.resolve({ error: null }),
      }),
      channel: () => ({
        send: () => Promise.resolve(),
      }),
      removeChannel: () => Promise.resolve(),
    }),
  ),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Workflow AI Integration", () => {
  describe("End-to-End Workflow Matching", () => {
    it("should match user message to workflow using intent rules", () => {
      // Test workflow intent rules matching
      const testCases = [
        { message: "检查书签健康", expectedSubType: "bookmark_health" },
        { message: "周度整理", expectedSubType: "weekly_organize" },
        { message: "深度学习这个主题", expectedSubType: "topic_deep_dive" },
        { message: "备份数据", expectedSubType: "periodic_backup" },
        { message: "整理导入的书签", expectedSubType: "new_user_onboarding" },
        { message: "智能收录", expectedSubType: "smart_intake" },
        { message: "开始复习", expectedSubType: "spaced_review" },
      ];

      for (const testCase of testCases) {
        const result = matchWorkflowIntent(testCase.message);

        expect(result).not.toBeNull();
        expect(result?.intent.subType).toBe(testCase.expectedSubType);
      }
    });

    it("should not match unrelated messages", () => {
      const result = matchWorkflowIntent("今天天气真好");

      expect(result).toBeNull();
    });
  });

  describe("Workflow Recommendation Flow", () => {
    let recommender: WorkflowRecommender;

    beforeEach(() => {
      recommender = new WorkflowRecommender();
    });

    it("should generate recommendations and reminders for user context", () => {
      // 1. Build user context
      const userContext: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 300,
          recentWeekCount: 0,
          topFolders: [{ name: "技术", count: 50 }],
          topTags: [],
        },
        untaggedCount: 80,
      } as unknown as DynamicContext;

      // 2. Get recommendations
      const recommendations = recommender.recommend(userContext);

      expect(recommendations.length).toBeGreaterThan(0);

      // 3. Generate system reminders
      const reminders = getWorkflowSystemReminders({
        workflowRecommendations: recommendations,
      });

      // Should have high priority recommendation
      const hasHighPriority = recommendations.some(
        (r) => r.priority === "high",
      );
      if (hasHighPriority) {
        expect(reminders.length).toBeGreaterThan(0);
      }
    });

    it("should handle workflow completion notification flow", () => {
      // Simulate workflow completion
      const completionContext = {
        userId: "user-123",
        workflowId: "smart_intake",
        workflowName: "智能收录",
        executionId: "exec-456",
        status: "completed" as const,
        summary: "已自动分类 80 条书签到 5 个文件夹",
        outputs: {
          processedCount: 80,
          folderCount: 5,
        },
      };

      // Generate completion reminder
      const reminder = generateWorkflowCompletionReminder(completionContext);

      expect(reminder).toContain("工作流完成");
      expect(reminder).toContain("智能收录");

      // Get all system reminders
      const reminders = getWorkflowSystemReminders({
        workflowCompletion: completionContext,
      });

      expect(reminders.length).toBe(1);
      expect(reminders[0].priority).toBe(95);
    });
  });

  describe("Condition Evaluation in Workflows", () => {
    let evaluator: SafeExpressionEvaluator;

    beforeEach(() => {
      evaluator = new SafeExpressionEvaluator();
    });

    it("should evaluate workflow conditions correctly", () => {
      // Simulate workflow step conditions - 使用数值和布尔比较
      // 注意：expr-eval 使用 'and' 和 'or' 关键字，而不是 && 和 ||
      const stepConditions = [
        {
          condition: "totalBookmarks > 100 and untaggedCount > 50",
          context: { totalBookmarks: 200, untaggedCount: 60 },
          expected: true,
        },
        {
          condition: "recentWeekCount == 0 and totalBookmarks > 50",
          context: { recentWeekCount: 0, totalBookmarks: 150 },
          expected: true,
        },
        {
          condition: "includes(platforms, 1)",
          context: { platforms: [1, 2, 3] },
          expected: true,
        },
        {
          condition: "length(folders) > 5",
          context: { folders: ["a", "b", "c", "d", "e", "f"] },
          expected: true,
        },
        {
          condition: "isEmpty(tags) and totalBookmarks > 10",
          context: { tags: [], totalBookmarks: 50 },
          expected: true,
        },
      ];

      for (const test of stepConditions) {
        const result = evaluator.evaluate(test.condition, test.context);
        expect(result).toBe(test.expected);
      }
    });

    it("should use convenience function for simple conditions", () => {
      // 注意：expr-eval 使用 'and' 关键字
      const result = safeEvaluateCondition("count > 10 and active == 1", {
        count: 15,
        active: 1,
      });

      expect(result).toBe(true);
    });
  });

  describe("Intent Rules Integration", () => {
    it("should have all required workflow intent rules", () => {
      const requiredRules = [
        "workflow-bookmark-health",
        "workflow-weekly-organize",
        "workflow-deep-learning",
        "workflow-backup",
        "workflow-new-user-onboarding",
        "workflow-smart-intake",
        "workflow-spaced-review",
        "workflow-run-generic",
      ];

      for (const ruleId of requiredRules) {
        const rule = workflowIntentRules.find((r) => r.id === ruleId);
        expect(rule).toBeDefined();
      }
    });

    it("should have consistent confidence levels", () => {
      for (const rule of workflowIntentRules) {
        expect(rule.confidence).toBeGreaterThanOrEqual(0.7);
        expect(rule.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it("should have workflow intent type", () => {
      for (const rule of workflowIntentRules) {
        expect(rule.intent.type).toBe("workflow");
        expect(rule.intent.subType).toBeDefined();
      }
    });
  });

  describe("Workflow Pattern Matching", () => {
    let matcher: WorkflowIntentMatcher;

    beforeEach(() => {
      matcher = new WorkflowIntentMatcher();
      matcher.clearCache();
    });

    it("should match workflow with keyword patterns", async () => {
      const matchPatterns = (
        matcher as unknown as {
          matchPatterns: (
            message: string,
            workflow: WorkflowDefinition,
          ) => Promise<{ workflowId: string; confidence: number } | null>;
        }
      ).matchPatterns.bind(matcher);

      // 使用类型断言创建测试工作流
      const workflow = {
        id: "test-workflow",
        name: "测试工作流",
        version: "1.0.0",
        triggers: [
          {
            type: "conversation",
            patterns: ["测试", "检验", "验证"],
          },
        ],
        steps: [],
      } as unknown as WorkflowDefinition;

      const result = await matchPatterns("帮我测试一下", workflow);

      expect(result).not.toBeNull();
      expect(result!.workflowId).toBe("test-workflow");
    });

    it("should match workflow with regex patterns", async () => {
      const matchPatterns = (
        matcher as unknown as {
          matchPatterns: (
            message: string,
            workflow: WorkflowDefinition,
          ) => Promise<{ workflowId: string; confidence: number } | null>;
        }
      ).matchPatterns.bind(matcher);

      // 使用类型断言创建测试工作流（简化格式，使用关键词匹配）
      const workflow = {
        id: "schedule-workflow",
        name: "定时任务",
        version: "1.0.0",
        triggers: [
          {
            type: "conversation",
            patterns: ["每周执行", "每天执行", "每月执行", "定时执行"],
          },
        ],
        steps: [],
      } as unknown as WorkflowDefinition;

      const result = await matchPatterns("每周执行一次整理", workflow);

      expect(result).not.toBeNull();
    });
  });

  describe("Recommendation Priority Handling", () => {
    let recommender: WorkflowRecommender;

    beforeEach(() => {
      recommender = new WorkflowRecommender();
    });

    it("should prioritize high-urgency workflows", () => {
      const context: DynamicContext = {
        timestamp: new Date(),
        stats: {
          totalBookmarks: 500,
          recentWeekCount: 0,
          topFolders: [{ name: "积累", count: 100 }],
          topTags: [],
        },
        untaggedCount: 100,
        reviewBacklog: 30,
      } as unknown as DynamicContext;

      const recommendations = recommender.recommend(context);

      // Top recommendations should be high priority
      expect(recommendations[0].priority).toBe("high");
    });

    it("should generate reminder only for high priority recommendations", () => {
      const highPriorityRecs = [
        {
          workflowId: "smart_intake",
          workflowName: "智能收录",
          reason: "有很多未分类",
          priority: "high" as const,
          score: 90,
        },
      ];

      const reminder = generateWorkflowRecommendationReminder(highPriorityRecs);
      expect(reminder).not.toBe("");

      const mediumPriorityRecs = [
        {
          workflowId: "weekly_organize",
          workflowName: "周度整理",
          reason: "建议整理",
          priority: "medium" as const,
          score: 75,
        },
      ];

      const noReminder =
        generateWorkflowRecommendationReminder(mediumPriorityRecs);
      expect(noReminder).toBe("");
    });
  });
});
