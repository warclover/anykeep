/**
 * InsightReportSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import {
  InsightReportSkill,
  insightReportSkill,
} from "../insight-report.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import { REPORT_TYPE_CONFIG, DEFAULT_REPORT_CONFIG } from "../types";
import type { ReportType } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() =>
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

describe("InsightReportSkill", () => {
  let skill: InsightReportSkill;

  beforeEach(() => {
    skill = new InsightReportSkill();
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("insight_report");
      expect(skill.metadata.name).toBe("洞察报告助手");
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should have deliverable types", () => {
      expect(skill.metadata.deliverableTypes).toBeDefined();
      expect(skill.metadata.deliverableTypes).toContain("report");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(5);
      expect(skill.metadata.steps![0].id).toBe("collect");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("activity-analysis");
      expect(skill.metadata.capabilities).toContain("content-analysis");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse report type from message", async () => {
      const weeklyResult = await skill.parseInput("生成周报告", mockContext);
      expect(weeklyResult.reportType).toBe("weekly");

      const monthlyResult = await skill.parseInput("月度总结", mockContext);
      expect(monthlyResult.reportType).toBe("monthly");

      const trendsResult = await skill.parseInput("趋势分析", mockContext);
      expect(trendsResult.reportType).toBe("trends");
    });

    it("should use default report type when not specified", async () => {
      const result = await skill.parseInput("生成报告", mockContext);
      expect(result.reportType).toBeDefined();
    });

    it("should parse time range from message", async () => {
      const weekResult = await skill.parseInput("最近一周的报告", mockContext);
      expect(weekResult.timeRange).toBe("week");

      const quarterResult = await skill.parseInput(
        "最近三个月的趋势",
        mockContext,
      );
      expect(quarterResult.timeRange).toBe("quarter");

      // 默认时间范围测试
      const defaultResult = await skill.parseInput("生成报告", mockContext);
      expect(defaultResult.timeRange).toBeDefined();
    });

    it("should include details by default", async () => {
      const result = await skill.parseInput("生成报告", mockContext);
      expect(result.includeDetails).toBe(true);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(insightReportSkill).toBeInstanceOf(InsightReportSkill);
      expect(insightReportSkill.metadata.id).toBe("insight_report");
    });
  });

  describe("schemas", () => {
    it("should have valid input schema", () => {
      expect(skill.inputSchema).toBeDefined();
    });

    it("should have valid output schema", () => {
      expect(skill.outputSchema).toBeDefined();
    });
  });
});

describe("REPORT_TYPE_CONFIG", () => {
  it("should have all required report types", () => {
    const types: ReportType[] = [
      "weekly",
      "monthly",
      "usage",
      "content",
      "trends",
    ];
    types.forEach((type) => {
      expect(REPORT_TYPE_CONFIG[type]).toBeDefined();
      expect(REPORT_TYPE_CONFIG[type].name).toBeDefined();
      expect(REPORT_TYPE_CONFIG[type].description).toBeDefined();
    });
  });

  it("should have icons for each report type", () => {
    const types: ReportType[] = [
      "weekly",
      "monthly",
      "usage",
      "content",
      "trends",
    ];
    types.forEach((type) => {
      expect(REPORT_TYPE_CONFIG[type].icon).toBeDefined();
    });
  });
});

describe("DEFAULT_REPORT_CONFIG", () => {
  it("should have required fields", () => {
    expect(DEFAULT_REPORT_CONFIG.reportType).toBeDefined();
    expect(DEFAULT_REPORT_CONFIG.timeRange).toBeDefined();
    expect(DEFAULT_REPORT_CONFIG.includeDetails).toBeDefined();
  });
});
