/**
 * 待办事项追踪服务测试
 *
 * @module @/lib/ai-memory/__tests__/pending-tasks.test
 */

import {
  PendingTasksService,
  getPendingTasksService,
  resetPendingTasksService,
  getPendingTasks,
  completePendingTask,
  hasPendingTasks,
} from "../pending-tasks";

// =============================================================================
// Mock 设置
// =============================================================================

// Mock Supabase
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

// =============================================================================
// 测试
// =============================================================================

describe("PendingTasksService", () => {
  const TEST_USER_ID = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    resetPendingTasksService();
  });

  describe("getTasks", () => {
    it("应该返回待办事项列表", async () => {
      const mockTasks = ["整理B站收藏", "导出本周收藏"];
      mockRpc.mockResolvedValue({ data: mockTasks, error: null });

      const service = new PendingTasksService();
      const tasks = await service.getTasks(TEST_USER_ID);

      expect(tasks).toEqual(mockTasks);
      expect(mockRpc).toHaveBeenCalledWith("get_pending_intents", {
        p_user_id: TEST_USER_ID,
      });
    });

    it("应该处理空列表", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const service = new PendingTasksService();
      const tasks = await service.getTasks(TEST_USER_ID);

      expect(tasks).toEqual([]);
    });

    it("应该处理 null 数据", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const service = new PendingTasksService();
      const tasks = await service.getTasks(TEST_USER_ID);

      expect(tasks).toEqual([]);
    });

    it("应该处理数据库错误", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const service = new PendingTasksService();
      const tasks = await service.getTasks(TEST_USER_ID);

      expect(tasks).toEqual([]);
    });

    it("应该限制返回数量", async () => {
      const mockTasks = Array.from({ length: 20 }, (_, i) => `任务 ${i + 1}`);
      mockRpc.mockResolvedValue({ data: mockTasks, error: null });

      const service = new PendingTasksService({ maxTasks: 5 });
      const tasks = await service.getTasks(TEST_USER_ID);

      expect(tasks.length).toBe(5);
    });

    it("应该处理异常", async () => {
      mockRpc.mockRejectedValue(new Error("Network error"));

      const service = new PendingTasksService();
      const tasks = await service.getTasks(TEST_USER_ID);

      expect(tasks).toEqual([]);
    });
  });

  describe("completeTask", () => {
    it("应该成功完成任务", async () => {
      mockRpc.mockResolvedValue({ error: null });

      const service = new PendingTasksService();
      const result = await service.completeTask(TEST_USER_ID, "整理收藏");

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("remove_pending_intent", {
        p_user_id: TEST_USER_ID,
        p_intent: "整理收藏",
      });
    });

    it("应该处理完成失败", async () => {
      mockRpc.mockResolvedValue({
        error: { message: "Task not found" },
      });

      const service = new PendingTasksService();
      const result = await service.completeTask(TEST_USER_ID, "不存在的任务");

      expect(result).toBe(false);
    });

    it("应该处理异常", async () => {
      mockRpc.mockRejectedValue(new Error("Network error"));

      const service = new PendingTasksService();
      const result = await service.completeTask(TEST_USER_ID, "任务");

      expect(result).toBe(false);
    });
  });

  describe("completeTasks", () => {
    it("应该批量完成任务", async () => {
      mockRpc.mockResolvedValue({ error: null });

      const service = new PendingTasksService();
      const tasks = ["任务1", "任务2", "任务3"];
      const count = await service.completeTasks(TEST_USER_ID, tasks);

      expect(count).toBe(3);
      expect(mockRpc).toHaveBeenCalledTimes(3);
    });

    it("应该处理部分失败", async () => {
      mockRpc
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: "Failed" } })
        .mockResolvedValueOnce({ error: null });

      const service = new PendingTasksService();
      const tasks = ["任务1", "任务2", "任务3"];
      const count = await service.completeTasks(TEST_USER_ID, tasks);

      expect(count).toBe(2);
    });

    it("应该处理空列表", async () => {
      const service = new PendingTasksService();
      const count = await service.completeTasks(TEST_USER_ID, []);

      expect(count).toBe(0);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("hasTasks", () => {
    it("应该返回 true 当有任务时", async () => {
      mockRpc.mockResolvedValue({
        data: ["任务1"],
        error: null,
      });

      const service = new PendingTasksService();
      const result = await service.hasTasks(TEST_USER_ID);

      expect(result).toBe(true);
    });

    it("应该返回 false 当无任务时", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const service = new PendingTasksService();
      const result = await service.hasTasks(TEST_USER_ID);

      expect(result).toBe(false);
    });
  });

  describe("getTaskCount", () => {
    it("应该返回正确的任务数量", async () => {
      mockRpc.mockResolvedValue({
        data: ["任务1", "任务2", "任务3"],
        error: null,
      });

      const service = new PendingTasksService();
      const count = await service.getTaskCount(TEST_USER_ID);

      expect(count).toBe(3);
    });

    it("应该返回 0 当无任务时", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const service = new PendingTasksService();
      const count = await service.getTaskCount(TEST_USER_ID);

      expect(count).toBe(0);
    });
  });

  describe("completeTaskByMatch", () => {
    it("应该匹配并完成任务（完全匹配）", async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: ["整理B站收藏", "导出数据"],
          error: null,
        })
        .mockResolvedValueOnce({ error: null });

      const service = new PendingTasksService();
      const result = await service.completeTaskByMatch(
        TEST_USER_ID,
        "整理B站收藏",
      );

      expect(result).toBe("整理B站收藏");
    });

    it("应该匹配并完成任务（部分匹配 - 描述包含任务）", async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: ["B站", "导出数据"],
          error: null,
        })
        .mockResolvedValueOnce({ error: null });

      const service = new PendingTasksService();
      const result = await service.completeTaskByMatch(
        TEST_USER_ID,
        "整理B站收藏",
      );

      expect(result).toBe("B站");
    });

    it("应该匹配并完成任务（部分匹配 - 任务包含描述）", async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: ["整理B站收藏到技术文件夹", "导出数据"],
          error: null,
        })
        .mockResolvedValueOnce({ error: null });

      const service = new PendingTasksService();
      const result = await service.completeTaskByMatch(TEST_USER_ID, "B站收藏");

      expect(result).toBe("整理B站收藏到技术文件夹");
    });

    it("应该在无匹配时返回 null", async () => {
      mockRpc.mockResolvedValueOnce({
        data: ["整理B站收藏", "导出数据"],
        error: null,
      });

      const service = new PendingTasksService();
      const result = await service.completeTaskByMatch(
        TEST_USER_ID,
        "删除所有内容",
      );

      expect(result).toBeNull();
    });

    it("应该在无任务时返回 null", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const service = new PendingTasksService();
      const result = await service.completeTaskByMatch(
        TEST_USER_ID,
        "任何任务",
      );

      expect(result).toBeNull();
    });

    it("应该忽略大小写匹配", async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: ["React学习", "Vue教程"],
          error: null,
        })
        .mockResolvedValueOnce({ error: null });

      const service = new PendingTasksService();
      const result = await service.completeTaskByMatch(TEST_USER_ID, "react");

      expect(result).toBe("React学习");
    });
  });
});

// =============================================================================
// 单例和便捷函数测试
// =============================================================================

describe("单例和便捷函数", () => {
  const TEST_USER_ID = "test-user-456";

  beforeEach(() => {
    jest.clearAllMocks();
    resetPendingTasksService();
  });

  describe("getPendingTasksService", () => {
    it("应该返回单例实例", () => {
      const instance1 = getPendingTasksService();
      const instance2 = getPendingTasksService();

      expect(instance1).toBe(instance2);
    });

    it("应该在重置后创建新实例", () => {
      const instance1 = getPendingTasksService();
      resetPendingTasksService();
      const instance2 = getPendingTasksService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("getPendingTasks", () => {
    it("应该使用单例获取任务", async () => {
      mockRpc.mockResolvedValue({ data: ["任务1"], error: null });

      const tasks = await getPendingTasks(TEST_USER_ID);

      expect(tasks).toEqual(["任务1"]);
    });
  });

  describe("completePendingTask", () => {
    it("应该使用单例完成任务", async () => {
      mockRpc.mockResolvedValue({ error: null });

      const result = await completePendingTask(TEST_USER_ID, "任务1");

      expect(result).toBe(true);
    });
  });

  describe("hasPendingTasks", () => {
    it("应该使用单例检查任务", async () => {
      mockRpc.mockResolvedValue({ data: ["任务1"], error: null });

      const result = await hasPendingTasks(TEST_USER_ID);

      expect(result).toBe(true);
    });
  });
});

// =============================================================================
// 配置测试
// =============================================================================

describe("配置", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPendingTasksService();
  });

  it("应该使用默认配置", async () => {
    const tasks = Array.from({ length: 15 }, (_, i) => `任务 ${i + 1}`);
    mockRpc.mockResolvedValue({ data: tasks, error: null });

    const service = new PendingTasksService();
    const result = await service.getTasks("user");

    // 默认最大 10 个
    expect(result.length).toBe(10);
  });

  it("应该使用自定义配置", async () => {
    const tasks = Array.from({ length: 15 }, (_, i) => `任务 ${i + 1}`);
    mockRpc.mockResolvedValue({ data: tasks, error: null });

    const service = new PendingTasksService({ maxTasks: 3 });
    const result = await service.getTasks("user");

    expect(result.length).toBe(3);
  });
});
