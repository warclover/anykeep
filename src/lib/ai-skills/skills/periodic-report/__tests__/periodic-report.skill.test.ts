/**
 * PeriodicReportSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import {
  PeriodicReportSkill,
  periodicReportSkill,
} from "../periodic-report.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import { PERIOD_CONFIG, DEFAULT_PERIODIC_REPORT_CONFIG } from "../types";
import type { PeriodicReportInput } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  in: jest.fn(() =>
                    Promise.resolve({
                      data: [],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("PeriodicReportSkill", () => {
  let skill: PeriodicReportSkill;

  beforeEach(() => {
    skill = new PeriodicReportSkill();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("periodic_report");
      expect(skill.metadata.name).toBe("周期报告助手");
      expect(skill.metadata.category).toBe("understanding");
      expect(skill.metadata.deliverableTypes).toContain("report");
      expect(skill.metadata.deliverableTypes).toContain("graph");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(5);
      expect(skill.metadata.steps![0].id).toBe("collect");
      expect(skill.metadata.steps![4].id).toBe("generate");
    });

    it("should have required capabilities", () => {
      expect(skill.metadata.capabilities).toContain("periodic-summary");
      expect(skill.metadata.capabilities).toContain("historical-comparison");
      expect(skill.metadata.capabilities).toContain("trend-charts");
      expect(skill.metadata.capabilities).toContain("highlight-selection");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse daily period from message", async () => {
      const dailyResult = await skill.parseInput("生成日报", mockContext);
      expect(dailyResult.period).toBe("daily");

      const todayResult = await skill.parseInput("今天的报告", mockContext);
      expect(todayResult.period).toBe("daily");
    });

    it("should parse weekly period from message", async () => {
      const weeklyResult = await skill.parseInput("生成周报", mockContext);
      expect(weeklyResult.period).toBe("weekly");

      const thisWeekResult = await skill.parseInput("这周的收藏", mockContext);
      expect(thisWeekResult.period).toBe("weekly");
    });

    it("should parse monthly period from message", async () => {
      const monthlyResult = await skill.parseInput("生成月报", mockContext);
      expect(monthlyResult.period).toBe("monthly");

      const thisMonthResult = await skill.parseInput("本月报告", mockContext);
      expect(thisMonthResult.period).toBe("monthly");
    });

    it("should parse quarterly period from message", async () => {
      const quarterlyResult = await skill.parseInput("生成季报", mockContext);
      expect(quarterlyResult.period).toBe("quarterly");

      const quarterResult = await skill.parseInput("季度报告", mockContext);
      expect(quarterResult.period).toBe("quarterly");
    });

    it("should default to weekly when no period specified", async () => {
      const defaultResult = await skill.parseInput("生成报告", mockContext);
      expect(defaultResult.period).toBe("weekly");
    });

    it("should parse report type from message", async () => {
      const activityResult = await skill.parseInput(
        "生成活跃度报告",
        mockContext,
      );
      expect(activityResult.reportType).toBe("activity");

      const trendResult = await skill.parseInput("趋势分析报告", mockContext);
      expect(trendResult.reportType).toBe("trends");

      const highlightResult = await skill.parseInput("精选亮点", mockContext);
      expect(highlightResult.reportType).toBe("highlights");
    });

    it("should default to summary report type", async () => {
      const defaultResult = await skill.parseInput("生成报告", mockContext);
      expect(defaultResult.reportType).toBe("summary");
    });

    it("should parse comparison option from message", async () => {
      const noCompareResult = await skill.parseInput(
        "生成周报，不需要对比",
        mockContext,
      );
      expect(noCompareResult.includeComparison).toBe(false);

      const defaultResult = await skill.parseInput("生成周报", mockContext);
      expect(defaultResult.includeComparison).toBe(true);
    });
  });

  describe("PERIOD_CONFIG", () => {
    it("should have correct daily config", () => {
      expect(PERIOD_CONFIG.daily.name).toBe("日报");
      expect(PERIOD_CONFIG.daily.icon).toBe("📅");
      expect(PERIOD_CONFIG.daily.days).toBe(1);
    });

    it("should have correct weekly config", () => {
      expect(PERIOD_CONFIG.weekly.name).toBe("周报");
      expect(PERIOD_CONFIG.weekly.icon).toBe("📊");
      expect(PERIOD_CONFIG.weekly.days).toBe(7);
    });

    it("should have correct monthly config", () => {
      expect(PERIOD_CONFIG.monthly.name).toBe("月报");
      expect(PERIOD_CONFIG.monthly.icon).toBe("📈");
      expect(PERIOD_CONFIG.monthly.days).toBe(30);
    });

    it("should have correct quarterly config", () => {
      expect(PERIOD_CONFIG.quarterly.name).toBe("季报");
      expect(PERIOD_CONFIG.quarterly.icon).toBe("📉");
      expect(PERIOD_CONFIG.quarterly.days).toBe(90);
    });

    it("should format labels correctly", () => {
      const testDate = new Date("2025-12-24");

      const dailyLabel = PERIOD_CONFIG.daily.labelFormat(testDate);
      expect(dailyLabel).toContain("2025");
      expect(dailyLabel).toContain("12");

      const weeklyLabel = PERIOD_CONFIG.weekly.labelFormat(testDate);
      expect(weeklyLabel).toMatch(/\d{4}年第\d+周/);

      const monthlyLabel = PERIOD_CONFIG.monthly.labelFormat(testDate);
      expect(monthlyLabel).toContain("2025");

      const quarterlyLabel = PERIOD_CONFIG.quarterly.labelFormat(testDate);
      expect(quarterlyLabel).toMatch(/\d{4}年Q[1-4]/);
    });
  });

  describe("DEFAULT_PERIODIC_REPORT_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_PERIODIC_REPORT_CONFIG.period).toBe("weekly");
      expect(DEFAULT_PERIODIC_REPORT_CONFIG.reportType).toBe("summary");
      expect(DEFAULT_PERIODIC_REPORT_CONFIG.includeComparison).toBe(true);
      expect(DEFAULT_PERIODIC_REPORT_CONFIG.comparisonPeriods).toBe(1);
      expect(DEFAULT_PERIODIC_REPORT_CONFIG.includeChartData).toBe(true);
    });
  });

  describe("inputSchema", () => {
    it("should validate valid input", () => {
      const validInput: PeriodicReportInput = {
        period: "weekly",
        reportType: "summary",
        includeComparison: true,
        comparisonPeriods: 2,
        includeChartData: true,
      };

      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should apply default values", () => {
      const minimalInput = {};
      const result = skill.inputSchema.safeParse(minimalInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe("weekly");
        expect(result.data.reportType).toBe("summary");
        expect(result.data.includeComparison).toBe(true);
        expect(result.data.comparisonPeriods).toBe(1);
        expect(result.data.includeChartData).toBe(true);
      }
    });

    it("should reject invalid period", () => {
      const invalidInput = { period: "yearly" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid comparison periods", () => {
      const tooLow = { comparisonPeriods: 0 };
      const tooHigh = { comparisonPeriods: 10 };

      expect(skill.inputSchema.safeParse(tooLow).success).toBe(false);
      expect(skill.inputSchema.safeParse(tooHigh).success).toBe(false);
    });

    it("should accept valid filter", () => {
      const inputWithFilter: PeriodicReportInput = {
        period: "monthly",
        reportType: "activity",
        filter: {
          folderId: 123,
          platforms: ["wechat", "bilibili"],
          tags: ["tech", "ai"],
        },
      };

      const result = skill.inputSchema.safeParse(inputWithFilter);
      expect(result.success).toBe(true);
    });
  });

  describe("singleton export", () => {
    it("should export a singleton instance", () => {
      expect(periodicReportSkill).toBeInstanceOf(PeriodicReportSkill);
      expect(periodicReportSkill.metadata.id).toBe("periodic_report");
    });
  });
});
