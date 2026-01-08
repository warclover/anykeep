/**
 * TriggerScheduler 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { TriggerScheduler } from "../trigger-scheduler";
import type { ScheduleTriggerConfig } from "../types";

// Mock Supabase
const mockEq = jest.fn().mockReturnThis();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({ data: [], error: null }),
                ),
              })),
            })),
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          in: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: "test-id",
                  workflow_id: "test-workflow",
                  user_id: "test-user",
                  scheduled_at: new Date().toISOString(),
                  status: "pending",
                },
                error: null,
              }),
            ),
          })),
        })),
        update: jest.fn(() => ({
          eq: mockEq.mockImplementation(() => ({
            eq: mockEq.mockImplementation(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        })),
      })),
      rpc: jest.fn(() => Promise.resolve({ data: true, error: null })),
    }),
  ),
}));

// Mock orchestrator
jest.mock("../../orchestrator", () => ({
  getWorkflowOrchestrator: jest.fn(() => ({
    startWorkflow: jest.fn(() =>
      Promise.resolve({
        id: "execution-id",
        status: "running",
      }),
    ),
  })),
}));

// Mock distributed lock
jest.mock("../distributed-lock", () => ({
  getDistributedLockManager: jest.fn(() => ({
    withLock: jest.fn((_key: string, operation: () => Promise<unknown>) =>
      operation(),
    ),
  })),
}));

describe("TriggerScheduler", () => {
  let scheduler: TriggerScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    scheduler = new TriggerScheduler();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("calculateNextExecutionTime", () => {
    it("should return null if not enabled", () => {
      const config: ScheduleTriggerConfig = {
        frequency: "daily",
        time: "08:00",
        enabled: false,
      };

      const result = scheduler.calculateNextExecutionTime(config);

      expect(result).toBeNull();
    });

    it("should calculate next daily execution time", () => {
      // 设置固定时间：2026-01-08 06:00:00
      const now = new Date("2026-01-08T06:00:00");
      jest.setSystemTime(now);

      const config: ScheduleTriggerConfig = {
        frequency: "daily",
        time: "08:00",
        enabled: true,
      };

      const result = scheduler.calculateNextExecutionTime(config);

      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(8);
      expect(result!.getMinutes()).toBe(0);
      // 今天 08:00 还没过，应该是今天
      expect(result!.getDate()).toBe(8);
    });

    it("should calculate next day for daily if time passed", () => {
      // 设置固定时间：2026-01-08 10:00:00（08:00 已过）
      const now = new Date("2026-01-08T10:00:00");
      jest.setSystemTime(now);

      const config: ScheduleTriggerConfig = {
        frequency: "daily",
        time: "08:00",
        enabled: true,
      };

      const result = scheduler.calculateNextExecutionTime(config);

      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(8);
      // 应该是明天
      expect(result!.getDate()).toBe(9);
    });

    it("should calculate next weekly execution time", () => {
      // 设置固定时间：2026-01-08（周三）
      const now = new Date("2026-01-08T06:00:00");
      jest.setSystemTime(now);

      const config: ScheduleTriggerConfig = {
        frequency: "weekly",
        time: "03:00",
        dayOfWeek: 0, // 周日
        enabled: true,
      };

      const result = scheduler.calculateNextExecutionTime(config);

      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(0); // 周日
    });

    it("should calculate next monthly execution time", () => {
      // 设置固定时间：2026-01-08
      const now = new Date("2026-01-08T06:00:00");
      jest.setSystemTime(now);

      const config: ScheduleTriggerConfig = {
        frequency: "monthly",
        time: "03:00",
        dayOfMonth: 1,
        enabled: true,
      };

      const result = scheduler.calculateNextExecutionTime(config);

      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(1);
      // 1月1日已过，应该是2月1日
      expect(result!.getMonth()).toBe(1); // February (0-indexed)
    });
  });

  describe("getPendingExecutions", () => {
    it("should return empty array when no pending executions", async () => {
      const result = await scheduler.getPendingExecutions();
      expect(result).toEqual([]);
    });
  });

  describe("scheduleNextExecution", () => {
    it("should create a scheduled execution", async () => {
      const config: ScheduleTriggerConfig = {
        frequency: "daily",
        time: "08:00",
        enabled: true,
      };

      const result = await scheduler.scheduleNextExecution(
        "workflow-id",
        "user-id",
        config,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe("test-id");
      expect(result!.status).toBe("pending");
    });

    it("should return null if config is disabled", async () => {
      const config: ScheduleTriggerConfig = {
        frequency: "daily",
        time: "08:00",
        enabled: false,
      };

      const result = await scheduler.scheduleNextExecution(
        "workflow-id",
        "user-id",
        config,
      );

      expect(result).toBeNull();
    });
  });

  describe("cancelSchedule", () => {
    it("should cancel a pending schedule", async () => {
      const result = await scheduler.cancelSchedule("schedule-id", "user-id");
      expect(result).toBe(true);
    });
  });
});
