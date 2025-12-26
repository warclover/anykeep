/**
 * UndoService 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { UndoService, getUndoService, resetUndoService } from "../undo-service";
import type { OperationSnapshot, OperationType } from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("UndoService", () => {
  let service: UndoService;

  // Test helpers
  const createTestSnapshot = (
    overrides?: Partial<OperationSnapshot>,
  ): OperationSnapshot => ({
    bookmarkIds: ["b1", "b2", "b3"],
    data: { originalFolders: { b1: "folder-1", b2: "folder-2", b3: null } },
    snapshotAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetUndoService();
    service = new UndoService({
      undoWindowMs: 5 * 60 * 1000, // 5 minutes
      maxCachedOperations: 100,
      enablePersistence: false,
    });
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  describe("recordOperation()", () => {
    it("应记录可撤销操作", async () => {
      const snapshot = createTestSnapshot();

      const result = await service.recordOperation(
        "user-123",
        "tu_test_1",
        "move_bookmarks",
        snapshot,
      );

      expect(result.undoId).toMatch(/^undo_\d+_[a-z0-9]+$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("应为不同操作生成唯一 ID", async () => {
      const snapshot = createTestSnapshot();

      const result1 = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );
      const result2 = await service.recordOperation(
        "user-123",
        "tu_2",
        "move_bookmarks",
        snapshot,
      );

      expect(result1.undoId).not.toBe(result2.undoId);
    });

    it("应正确设置过期时间", async () => {
      const now = Date.now();
      jest.setSystemTime(now);

      const snapshot = createTestSnapshot();
      const result = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      expect(result.expiresAt.getTime()).toBe(now + 5 * 60 * 1000);
    });

    it("应在缓存满时删除最旧的操作", async () => {
      const smallService = new UndoService({
        undoWindowMs: 5 * 60 * 1000,
        maxCachedOperations: 3,
        enablePersistence: false,
      });

      const snapshot = createTestSnapshot();

      // 记录 4 个操作（超过限制）
      const result1 = await smallService.recordOperation(
        "user-1",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );
      jest.advanceTimersByTime(100);
      await smallService.recordOperation(
        "user-1",
        "tu_2",
        "move_bookmarks",
        snapshot,
      );
      jest.advanceTimersByTime(100);
      await smallService.recordOperation(
        "user-1",
        "tu_3",
        "move_bookmarks",
        snapshot,
      );
      jest.advanceTimersByTime(100);
      await smallService.recordOperation(
        "user-1",
        "tu_4",
        "move_bookmarks",
        snapshot,
      );

      // 最旧的应被删除
      expect(smallService.isUndoAvailable(result1.undoId, "user-1")).toBe(
        false,
      );

      smallService.destroy();
    });
  });

  describe("executeUndo()", () => {
    it("应成功执行撤销", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      const result = await service.executeUndo(undoId, "user-123");

      expect(result.success).toBe(true);
      expect(result.message).toBe("操作已撤销");
      expect(result.restoredCount).toBe(3);
    });

    it("应拒绝不存在的撤销 ID", async () => {
      const result = await service.executeUndo("non-existent", "user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNDO_NOT_FOUND");
      expect(result.message).toContain("不存在");
    });

    it("应拒绝错误用户的撤销请求", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      const result = await service.executeUndo(undoId, "user-wrong");

      expect(result.success).toBe(false);
      expect(result.error).toBe("PERMISSION_DENIED");
    });

    it("应拒绝已过期的撤销请求", async () => {
      // 创建一个短窗口的 service 来测试过期
      const shortWindowService = new UndoService({
        undoWindowMs: 1000, // 1 秒窗口
        maxCachedOperations: 100,
        enablePersistence: false,
      });

      const snapshot = createTestSnapshot();
      const { undoId } = await shortWindowService.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      // 快进 2 秒（超过窗口期，但不触发清理定时器 - 清理间隔是 60 秒）
      jest.advanceTimersByTime(2000);

      const result = await shortWindowService.executeUndo(undoId, "user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNDO_EXPIRED");
      expect(result.message).toContain("过期");

      shortWindowService.destroy();
    });

    it("应拒绝重复撤销", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      // 第一次撤销
      await service.executeUndo(undoId, "user-123");

      // 第二次撤销
      const result = await service.executeUndo(undoId, "user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("ALREADY_UNDONE");
    });

    it("应支持所有操作类型的撤销", async () => {
      const operationTypes: OperationType[] = [
        "move_bookmarks",
        "batch_tags_add",
        "batch_tags_remove",
        "batch_organize",
        "classify",
      ];

      for (const opType of operationTypes) {
        const snapshot = createTestSnapshot({
          data: { originalFolders: {}, addedTags: [], removedTags: [] },
        });
        const { undoId } = await service.recordOperation(
          "user-123",
          `tu_${opType}`,
          opType,
          snapshot,
        );

        const result = await service.executeUndo(undoId, "user-123");
        expect(result.success).toBe(true);
      }
    });

    it("应拒绝删除操作的撤销", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_delete",
        "delete_bookmarks",
        snapshot,
      );

      const result = await service.executeUndo(undoId, "user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNDO_FAILED");
      expect(result.message).toContain("删除操作不支持撤销");
    });
  });

  describe("getUserUndoableOperations()", () => {
    it("应返回用户的可撤销操作列表", async () => {
      const snapshot = createTestSnapshot();

      await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );
      await service.recordOperation(
        "user-123",
        "tu_2",
        "batch_tags_add",
        snapshot,
      );

      const operations = service.getUserUndoableOperations("user-123");

      expect(operations).toHaveLength(2);
      expect(operations[0].operationType).toBeDefined();
      expect(operations[0].bookmarkCount).toBe(3);
    });

    it("应不包含其他用户的操作", async () => {
      const snapshot = createTestSnapshot();

      await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );
      await service.recordOperation(
        "user-456",
        "tu_2",
        "batch_tags_add",
        snapshot,
      );

      const operations = service.getUserUndoableOperations("user-123");

      expect(operations).toHaveLength(1);
    });

    it("应不包含已撤销的操作", async () => {
      const snapshot = createTestSnapshot();

      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );
      await service.recordOperation(
        "user-123",
        "tu_2",
        "batch_tags_add",
        snapshot,
      );

      // 撤销第一个操作
      await service.executeUndo(undoId, "user-123");

      const operations = service.getUserUndoableOperations("user-123");

      expect(operations).toHaveLength(1);
    });

    it("应不包含已过期的操作", async () => {
      const snapshot = createTestSnapshot();

      await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      // 时间快进超过窗口期
      jest.advanceTimersByTime(6 * 60 * 1000);

      await service.recordOperation(
        "user-123",
        "tu_2",
        "batch_tags_add",
        snapshot,
      );

      const operations = service.getUserUndoableOperations("user-123");

      expect(operations).toHaveLength(1);
    });
  });

  describe("isUndoAvailable()", () => {
    it("有效操作应返回 true", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      expect(service.isUndoAvailable(undoId, "user-123")).toBe(true);
    });

    it("不存在的操作应返回 false", () => {
      expect(service.isUndoAvailable("non-existent", "user-123")).toBe(false);
    });

    it("错误用户应返回 false", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      expect(service.isUndoAvailable(undoId, "user-wrong")).toBe(false);
    });

    it("已撤销的操作应返回 false", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      await service.executeUndo(undoId, "user-123");

      expect(service.isUndoAvailable(undoId, "user-123")).toBe(false);
    });

    it("过期的操作应返回 false", async () => {
      const snapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(service.isUndoAvailable(undoId, "user-123")).toBe(false);
    });
  });

  describe("updateAfterState()", () => {
    it("应更新操作后状态", async () => {
      const beforeSnapshot = createTestSnapshot();
      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        beforeSnapshot,
      );

      const afterSnapshot = createTestSnapshot({
        data: { newFolders: { b1: "folder-new" } },
      });
      service.updateAfterState(undoId, afterSnapshot);

      // 验证状态已更新（通过间接方式）
      expect(service.isUndoAvailable(undoId, "user-123")).toBe(true);
    });
  });

  describe("cleanup()", () => {
    it("应清理过期操作", async () => {
      const snapshot = createTestSnapshot();

      const { undoId: oldId } = await service.recordOperation(
        "user-123",
        "tu_old",
        "move_bookmarks",
        snapshot,
      );

      // 快进超过窗口期
      jest.advanceTimersByTime(6 * 60 * 1000);

      await service.recordOperation(
        "user-123",
        "tu_new",
        "move_bookmarks",
        snapshot,
      );

      // 手动清理
      service.cleanup();

      expect(service.isUndoAvailable(oldId, "user-123")).toBe(false);
    });

    it("应清理已撤销操作", async () => {
      const snapshot = createTestSnapshot();

      const { undoId } = await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );
      await service.executeUndo(undoId, "user-123");

      service.cleanup();

      // 操作应被清理
      const operations = service.getUserUndoableOperations("user-123");
      expect(operations).toHaveLength(0);
    });

    it("应定期自动清理", async () => {
      const snapshot = createTestSnapshot();

      await service.recordOperation(
        "user-123",
        "tu_1",
        "move_bookmarks",
        snapshot,
      );

      // 快进超过窗口期 + 清理间隔
      jest.advanceTimersByTime(7 * 60 * 1000);

      // 清理定时器应已执行
      const operations = service.getUserUndoableOperations("user-123");
      expect(operations).toHaveLength(0);
    });
  });

  describe("destroy()", () => {
    it("应清理所有数据和定时器", () => {
      const localService = new UndoService();

      localService.destroy();

      // 不应抛出错误
      expect(localService.getUserUndoableOperations("any-user")).toEqual([]);
    });
  });
});

describe("getUndoService()", () => {
  beforeEach(() => {
    resetUndoService();
  });

  afterEach(() => {
    resetUndoService();
  });

  it("应返回单例实例", () => {
    const instance1 = getUndoService();
    const instance2 = getUndoService();

    expect(instance1).toBe(instance2);
  });

  it("应接受配置参数", () => {
    const instance = getUndoService({ undoWindowMs: 10 * 60 * 1000 });

    expect(instance).toBeInstanceOf(UndoService);
  });
});

describe("resetUndoService()", () => {
  it("应重置单例实例", () => {
    const instance1 = getUndoService();
    resetUndoService();
    const instance2 = getUndoService();

    expect(instance1).not.toBe(instance2);
  });
});
