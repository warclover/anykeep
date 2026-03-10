/**
 * BatchClassificationCoordinator 单元测试
 *
 * 测试策略：Mock Supabase client，验证业务逻辑
 * startClassification 仅验证事务创建和异步调用启动，不测完整流程
 *
 * @module batch-classification/__tests__/coordinator
 */

import { BatchClassificationCoordinator } from "../coordinator";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { UserDecision } from "../types";

// ============================================
// Supabase Mock 工厂
// ============================================

/**
 * 创建可链式调用的 Supabase query builder mock
 * 支持 .select().eq().single() 等链式调用
 */
function createQueryBuilder(overrides: Record<string, unknown> = {}) {
  const builder: Record<string, jest.Mock> = {};

  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "in",
    "not",
    "is",
    "range",
    "single",
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  // 默认返回空数据
  builder.single.mockResolvedValue({ data: null, error: null });

  // 应用自定义覆盖
  for (const [key, value] of Object.entries(overrides)) {
    if (builder[key]) {
      if (typeof value === "function") {
        builder[key].mockImplementation(
          value as (...args: unknown[]) => unknown,
        );
      } else {
        builder[key].mockReturnValue(value);
      }
    }
  }

  return builder;
}

/**
 * 创建 Supabase client mock
 * 通过 tableBuilders 为不同表配置不同的返回数据
 */
function createSupabaseMock(
  tableBuilders: Record<string, ReturnType<typeof createQueryBuilder>> = {},
) {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (tableBuilders[table]) {
      return tableBuilders[table];
    }
    return createQueryBuilder();
  });

  return { from: fromMock } as unknown as SupabaseClient<Database>;
}

// ============================================
// 测试套件
// ============================================

describe("BatchClassificationCoordinator", () => {
  const TEST_USER_ID = "user-001";
  const TEST_TRANSACTION_ID = "txn-001";
  const TEST_BATCH_ID = "batch-001";

  // ============================================
  // startClassification
  // ============================================

  describe("startClassification", () => {
    it("正常流程：创建事务并返回 transactionId", async () => {
      // 事务表：insert → select → single 返回新事务 ID
      const transactionBuilder = createQueryBuilder();
      transactionBuilder.single.mockResolvedValue({
        data: { id: TEST_TRANSACTION_ID },
        error: null,
      });

      // 进度表：insert 成功
      const progressBuilder = createQueryBuilder();
      progressBuilder.insert.mockResolvedValue({ data: null, error: null });

      const supabase = createSupabaseMock({
        batch_import_transactions: transactionBuilder,
        batch_classification_progress: progressBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      const result = await coordinator.startClassification(
        { batchId: TEST_BATCH_ID },
        TEST_USER_ID,
      );

      expect(result).toBe(TEST_TRANSACTION_ID);

      // 验证事务表被正确调用
      expect(supabase.from).toHaveBeenCalledWith("batch_import_transactions");
      expect(transactionBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          batch_id: TEST_BATCH_ID,
          user_id: TEST_USER_ID,
          status: "pending",
        }),
      );
    });

    it("事务创建失败时抛出异常", async () => {
      const transactionBuilder = createQueryBuilder();
      transactionBuilder.single.mockResolvedValue({
        data: null,
        error: { message: "insert failed" },
      });

      const supabase = createSupabaseMock({
        batch_import_transactions: transactionBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.startClassification(
          { batchId: TEST_BATCH_ID },
          TEST_USER_ID,
        ),
      ).rejects.toThrow("Failed to create transaction");
    });

    it("使用 importSessionId 作为 batch_id 的 fallback", async () => {
      const transactionBuilder = createQueryBuilder();
      transactionBuilder.single.mockResolvedValue({
        data: { id: TEST_TRANSACTION_ID },
        error: null,
      });

      const progressBuilder = createQueryBuilder();

      const supabase = createSupabaseMock({
        batch_import_transactions: transactionBuilder,
        batch_classification_progress: progressBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await coordinator.startClassification(
        { importSessionId: "session-123" },
        TEST_USER_ID,
      );

      expect(transactionBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          batch_id: "session-123",
        }),
      );
    });
  });

  // ============================================
  // getProgress
  // ============================================

  describe("getProgress", () => {
    it("正常获取分类进度", async () => {
      const progressBuilder = createQueryBuilder();
      progressBuilder.single.mockResolvedValue({
        data: {
          transaction_id: TEST_TRANSACTION_ID,
          current_phase: "clustering",
          progress: 50,
          estimated_remaining_seconds: 30,
          phase_details: {
            sedimentation: { status: "completed" },
            clustering: { status: "in_progress" },
            mapping: { status: "pending" },
          },
          error_message: null,
          error_details: null,
        },
        error: null,
      });

      const supabase = createSupabaseMock({
        batch_classification_progress: progressBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);
      const progress = await coordinator.getProgress(TEST_TRANSACTION_ID);

      expect(progress.phase).toBe("clustering");
      expect(progress.progress).toBe(50);
      expect(progress.estimatedRemainingSeconds).toBe(30);
      expect(progress.error).toBeUndefined();
    });

    it("进度包含错误信息时正确返回 error 字段", async () => {
      const progressBuilder = createQueryBuilder();
      progressBuilder.single.mockResolvedValue({
        data: {
          current_phase: "failed",
          progress: 0,
          estimated_remaining_seconds: 0,
          phase_details: null,
          error_message: "Embedding service unavailable",
          error_details: { code: "EMBED_ERR" },
        },
        error: null,
      });

      const supabase = createSupabaseMock({
        batch_classification_progress: progressBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);
      const progress = await coordinator.getProgress(TEST_TRANSACTION_ID);

      expect(progress.phase).toBe("failed");
      expect(progress.error).toEqual({
        message: "Embedding service unavailable",
        details: { code: "EMBED_ERR" },
      });
    });

    it("进度不存在时抛出异常", async () => {
      const progressBuilder = createQueryBuilder();
      progressBuilder.single.mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });

      const supabase = createSupabaseMock({
        batch_classification_progress: progressBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.getProgress(TEST_TRANSACTION_ID),
      ).rejects.toThrow("Progress not found");
    });
  });

  // ============================================
  // getResults
  // ============================================

  describe("getResults", () => {
    it("正常获取含聚类信息的分类结果", async () => {
      // 需要多次调用 from()，使用 fromMock 精确控制
      const fromMock = jest.fn();

      // 第 1 次：获取事务
      const txnBuilder = createQueryBuilder();
      txnBuilder.single.mockResolvedValue({
        data: {
          id: TEST_TRANSACTION_ID,
          batch_id: TEST_BATCH_ID,
          total_bookmarks: 10,
        },
        error: null,
      });

      // 第 2 次：获取聚类
      const clusterBuilder = createQueryBuilder();
      clusterBuilder.eq.mockReturnValue({
        ...clusterBuilder,
        then: undefined,
        data: [
          {
            id: "cluster-1",
            cluster_index: 0,
            member_count: 3,
            suggested_name: "前端开发",
            suggested_name_confidence: 0.85,
            suggested_folder_id: 10,
            match_confidence: 0.9,
            match_type: "exact",
            conflict_type: "none",
            conflict_details: null,
            status: "pending",
            import_cluster_members: [
              {
                bookmark_id: 1,
                distance_to_centroid: 0.1,
                is_representative: true,
                representative_type: "core",
              },
              {
                bookmark_id: 2,
                distance_to_centroid: 0.5,
                is_representative: true,
                representative_type: "edge",
              },
              {
                bookmark_id: 3,
                distance_to_centroid: 0.3,
                is_representative: false,
                representative_type: null,
              },
            ],
            folders: { id: 10, name: "前端" },
          },
        ],
        error: null,
      });
      // 覆盖 select 让它直接跳到 eq（跳过 select 的链式）
      clusterBuilder.select.mockReturnValue(clusterBuilder);

      // 第 3 次：获取未聚类书签
      const unclusteredBuilder = createQueryBuilder();
      unclusteredBuilder.eq.mockImplementation(() => {
        // 第二个 eq（classification_status）返回结果
        return {
          data: [{ id: 99 }],
          error: null,
          eq: jest.fn().mockReturnValue({
            data: [{ id: 99 }],
            error: null,
          }),
        };
      });

      // 第 4 次：获取书签详情
      const bookmarkDetailBuilder = createQueryBuilder();
      bookmarkDetailBuilder.in.mockResolvedValue({
        data: [
          { id: 1, title: "React 教程", url: "https://react.dev" },
          { id: 2, title: "Vue 指南", url: "https://vuejs.org" },
        ],
        error: null,
      });

      // 按调用顺序返回不同 builder
      let callIndex = 0;
      const tableMap: Record<string, unknown> = {
        batch_import_transactions: txnBuilder,
        import_clusters: clusterBuilder,
        bookmarks: () => {
          // bookmarks 被调用两次：未聚类 + 书签详情
          callIndex++;
          return callIndex === 1 ? unclusteredBuilder : bookmarkDetailBuilder;
        },
      };

      fromMock.mockImplementation((table: string) => {
        const builder = tableMap[table];
        if (typeof builder === "function") return builder();
        return builder || createQueryBuilder();
      });

      const supabase = {
        from: fromMock,
      } as unknown as SupabaseClient<Database>;
      const coordinator = new BatchClassificationCoordinator(supabase);
      const results = await coordinator.getResults(TEST_TRANSACTION_ID);

      expect(results.transactionId).toBe(TEST_TRANSACTION_ID);
      expect(results.clusters).toHaveLength(1);
      expect(results.clusters[0].suggestedName).toBe("前端开发");
      expect(results.clusters[0].suggestedFolderName).toBe("前端");
      expect(results.clusters[0].memberCount).toBe(3);
      expect(results.clusters[0].matchType).toBe("exact");
      expect(results.stats.totalBookmarks).toBe(10);
    });

    it("事务不存在时抛出异常", async () => {
      const txnBuilder = createQueryBuilder();
      txnBuilder.single.mockResolvedValue({ data: null, error: null });

      const supabase = createSupabaseMock({
        batch_import_transactions: txnBuilder,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(coordinator.getResults(TEST_TRANSACTION_ID)).rejects.toThrow(
        "Transaction not found",
      );
    });
  });

  // ============================================
  // confirmResults
  // ============================================

  describe("confirmResults", () => {
    /**
     * 创建 confirmResults 测试所需的多表 mock
     */
    function createConfirmMocks(
      transactionData: Record<string, unknown> | null,
    ) {
      const fromMock = jest.fn();
      const updateCalls: Array<{ table: string; data: unknown }> = [];

      // 事务表 builder
      const txnBuilder = createQueryBuilder();
      txnBuilder.single.mockResolvedValue({
        data: transactionData,
        error: transactionData ? null : { message: "not found" },
      });
      // update 链
      const txnUpdateBuilder = createQueryBuilder();

      // 聚类表 builder（用于 processDecision）
      const clusterBuilder = createQueryBuilder();
      clusterBuilder.single.mockResolvedValue({
        data: {
          suggested_folder_id: 10,
          import_cluster_members: [{ bookmark_id: 1 }, { bookmark_id: 2 }],
        },
        error: null,
      });

      // 聚类更新 builder
      const clusterUpdateBuilder = createQueryBuilder();

      // 书签更新 builder
      const bookmarkUpdateBuilder = createQueryBuilder();
      bookmarkUpdateBuilder.in.mockResolvedValue({ error: null });

      // 根据表名和操作返回对应 builder
      let txnCallCount = 0;
      let clusterCallCount = 0;

      fromMock.mockImplementation((table: string) => {
        if (table === "batch_import_transactions") {
          txnCallCount++;
          // 第 1 次是 select（查询事务），后续是 update（更新状态）
          if (txnCallCount === 1) return txnBuilder;
          return txnUpdateBuilder;
        }
        if (table === "import_clusters") {
          clusterCallCount++;
          // 奇数次是 select（获取成员），偶数次是 update（更新状态）
          if (clusterCallCount % 2 === 1) return clusterBuilder;
          return clusterUpdateBuilder;
        }
        if (table === "bookmarks") {
          return bookmarkUpdateBuilder;
        }
        return createQueryBuilder();
      });

      return {
        supabase: { from: fromMock } as unknown as SupabaseClient<Database>,
        fromMock,
        updateCalls,
        bookmarkUpdateBuilder,
        clusterUpdateBuilder,
      };
    }

    it("accept 决策：移动书签到建议文件夹", async () => {
      const { supabase, bookmarkUpdateBuilder } = createConfirmMocks({
        id: TEST_TRANSACTION_ID,
        batch_id: TEST_BATCH_ID,
        user_id: TEST_USER_ID,
      });

      const decisions: UserDecision[] = [
        { clusterId: "cluster-1", action: "accept" },
      ];

      const coordinator = new BatchClassificationCoordinator(supabase);
      await coordinator.confirmResults(
        TEST_TRANSACTION_ID,
        decisions,
        TEST_USER_ID,
      );

      // 验证书签被更新为 confirmed 状态
      expect(bookmarkUpdateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          folder_id: 10,
          classification_status: "confirmed",
        }),
      );
    });

    it("modify 决策：移动书签到用户指定文件夹", async () => {
      const { supabase, bookmarkUpdateBuilder } = createConfirmMocks({
        id: TEST_TRANSACTION_ID,
        batch_id: TEST_BATCH_ID,
        user_id: TEST_USER_ID,
      });

      const decisions: UserDecision[] = [
        { clusterId: "cluster-1", action: "modify", targetFolderId: 99 },
      ];

      const coordinator = new BatchClassificationCoordinator(supabase);
      await coordinator.confirmResults(
        TEST_TRANSACTION_ID,
        decisions,
        TEST_USER_ID,
      );

      expect(bookmarkUpdateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          folder_id: 99,
          classification_status: "confirmed",
        }),
      );
    });

    it("reject 决策：仅更新簇状态为 rejected", async () => {
      const fromMock = jest.fn();
      const clusterUpdateData: unknown[] = [];

      let txnCallCount = 0;
      const txnSelectBuilder = createQueryBuilder();
      txnSelectBuilder.single.mockResolvedValue({
        data: {
          id: TEST_TRANSACTION_ID,
          batch_id: TEST_BATCH_ID,
          user_id: TEST_USER_ID,
        },
        error: null,
      });
      const txnUpdateBuilder = createQueryBuilder();

      fromMock.mockImplementation((table: string) => {
        if (table === "batch_import_transactions") {
          txnCallCount++;
          return txnCallCount === 1 ? txnSelectBuilder : txnUpdateBuilder;
        }
        if (table === "import_clusters") {
          // reject 路径：只有 update（不查询成员）
          const builder = createQueryBuilder();
          builder.update.mockImplementation((data: unknown) => {
            clusterUpdateData.push(data);
            return createQueryBuilder();
          });
          return builder;
        }
        return createQueryBuilder();
      });

      const supabase = {
        from: fromMock,
      } as unknown as SupabaseClient<Database>;

      const decisions: UserDecision[] = [
        { clusterId: "cluster-1", action: "reject" },
      ];

      const coordinator = new BatchClassificationCoordinator(supabase);
      await coordinator.confirmResults(
        TEST_TRANSACTION_ID,
        decisions,
        TEST_USER_ID,
      );

      // reject 不移动书签，只更新簇状态
      expect(clusterUpdateData).toContainEqual(
        expect.objectContaining({ status: "rejected" }),
      );
    });

    it("事务不存在时抛出异常", async () => {
      const { supabase } = createConfirmMocks(null);

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.confirmResults(
          TEST_TRANSACTION_ID,
          [{ clusterId: "c1", action: "accept" }],
          TEST_USER_ID,
        ),
      ).rejects.toThrow("Transaction not found");
    });
  });

  // ============================================
  // undoClassification
  // ============================================

  describe("undoClassification", () => {
    /**
     * 创建 undoClassification 测试所需的多表 mock
     */
    function createUndoMocks(
      transactionData: Record<string, unknown> | null,
      options: {
        bookmarkUpdateError?: string | null;
        folderBookmarkCount?: number;
        folderDeleteError?: string | null;
      } = {},
    ) {
      const fromMock = jest.fn();

      // 事务表
      const txnSelectBuilder = createQueryBuilder();
      txnSelectBuilder.single.mockResolvedValue({
        data: transactionData,
        error: transactionData ? null : { message: "not found" },
      });
      const txnUpdateBuilder = createQueryBuilder();

      // 书签更新 builder
      const bookmarkUpdateBuilder = createQueryBuilder();
      bookmarkUpdateBuilder.in.mockResolvedValue({
        error: options.bookmarkUpdateError
          ? { message: options.bookmarkUpdateError }
          : null,
      });

      // 书签 count builder（检查文件夹是否为空）
      const bookmarkCountBuilder = createQueryBuilder();
      bookmarkCountBuilder.is.mockResolvedValue({
        count: options.folderBookmarkCount ?? 0,
        error: null,
      });

      // 文件夹删除 builder
      const folderDeleteBuilder = createQueryBuilder();
      folderDeleteBuilder.eq.mockResolvedValue({
        error: options.folderDeleteError
          ? { message: options.folderDeleteError }
          : null,
      });

      let txnCallCount = 0;
      let bookmarkCallCount = 0;

      fromMock.mockImplementation((table: string) => {
        if (table === "batch_import_transactions") {
          txnCallCount++;
          return txnCallCount === 1 ? txnSelectBuilder : txnUpdateBuilder;
        }
        if (table === "bookmarks") {
          bookmarkCallCount++;
          // 奇数次是 update（恢复书签），偶数次是 select count（检查文件夹）
          // 但实际逻辑中先恢复所有书签，再检查文件夹
          // 根据调用链判断：update 有 .update()，count 有 .select("id", { count })
          // 简化处理：前面的是 update，后面的是 count
          if (bookmarkCallCount <= 1) return bookmarkUpdateBuilder;
          return bookmarkCountBuilder;
        }
        if (table === "folders") {
          return folderDeleteBuilder;
        }
        return createQueryBuilder();
      });

      return {
        supabase: { from: fromMock } as unknown as SupabaseClient<Database>,
        bookmarkUpdateBuilder,
        txnUpdateBuilder,
        folderDeleteBuilder,
      };
    }

    it("正常撤销流程：恢复书签并删除空文件夹", async () => {
      const snapshot = {
        bookmarkStates: {
          "1": { folder_id: null },
          "2": { folder_id: null },
          "3": { folder_id: 5 },
        },
        createdFolderIds: [10, 11],
      };

      const {
        supabase,
        bookmarkUpdateBuilder: _bookmarkUpdateBuilder,
        txnUpdateBuilder,
      } = createUndoMocks({
        id: TEST_TRANSACTION_ID,
        user_id: TEST_USER_ID,
        status: "confirmed",
        undo_available: true,
        undo_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pre_confirm_snapshot: snapshot,
      });

      const coordinator = new BatchClassificationCoordinator(supabase);
      const result = await coordinator.undoClassification(
        TEST_TRANSACTION_ID,
        TEST_USER_ID,
      );

      // 验证恢复了 3 个书签
      expect(result.restoredBookmarks).toBe(3);
      // 验证事务状态被更新为 undone
      expect(txnUpdateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "undone",
          undo_available: false,
        }),
      );
    });

    it("按 folder_id 分组批量恢复书签", async () => {
      // 3 个书签归属 2 个不同的 folder_id（null 和 5）
      const snapshot = {
        bookmarkStates: {
          "1": { folder_id: null },
          "2": { folder_id: null },
          "3": { folder_id: 5 },
        },
        createdFolderIds: [],
      };

      const fromMock = jest.fn();
      const bookmarkUpdateCalls: Array<{
        updateData: unknown;
        ids: number[];
      }> = [];

      let txnCallCount = 0;
      const txnSelectBuilder = createQueryBuilder();
      txnSelectBuilder.single.mockResolvedValue({
        data: {
          id: TEST_TRANSACTION_ID,
          user_id: TEST_USER_ID,
          status: "confirmed",
          undo_available: true,
          undo_deadline: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          pre_confirm_snapshot: snapshot,
        },
        error: null,
      });
      const txnUpdateBuilder = createQueryBuilder();

      fromMock.mockImplementation((table: string) => {
        if (table === "batch_import_transactions") {
          txnCallCount++;
          return txnCallCount === 1 ? txnSelectBuilder : txnUpdateBuilder;
        }
        if (table === "bookmarks") {
          // 每次 update 调用都记录参数
          const builder = createQueryBuilder();
          builder.update.mockImplementation((data: unknown) => {
            const innerBuilder = createQueryBuilder();
            innerBuilder.in.mockImplementation(
              (_col: string, ids: number[]) => {
                bookmarkUpdateCalls.push({ updateData: data, ids });
                return Promise.resolve({ error: null });
              },
            );
            return innerBuilder;
          });
          return builder;
        }
        return createQueryBuilder();
      });

      const supabase = {
        from: fromMock,
      } as unknown as SupabaseClient<Database>;
      const coordinator = new BatchClassificationCoordinator(supabase);
      await coordinator.undoClassification(TEST_TRANSACTION_ID, TEST_USER_ID);

      // 应该分 2 组更新：folder_id=null 的 [1,2] 和 folder_id=5 的 [3]
      expect(bookmarkUpdateCalls).toHaveLength(2);

      // 找到 folder_id=null 的那组
      const nullGroup = bookmarkUpdateCalls.find(
        (c) => (c.updateData as Record<string, unknown>).folder_id === null,
      );
      expect(nullGroup).toBeDefined();
      expect(nullGroup!.ids).toEqual(expect.arrayContaining([1, 2]));

      // 找到 folder_id=5 的那组
      const folder5Group = bookmarkUpdateCalls.find(
        (c) => (c.updateData as Record<string, unknown>).folder_id === 5,
      );
      expect(folder5Group).toBeDefined();
      expect(folder5Group!.ids).toEqual([3]);
    });

    it("事务不存在时抛出异常", async () => {
      const { supabase } = createUndoMocks(null);

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.undoClassification(TEST_TRANSACTION_ID, TEST_USER_ID),
      ).rejects.toThrow("Transaction not found");
    });

    it("撤销不可用时抛出异常（undo_available = false）", async () => {
      const { supabase } = createUndoMocks({
        id: TEST_TRANSACTION_ID,
        user_id: TEST_USER_ID,
        status: "confirmed",
        undo_available: false,
        undo_deadline: null,
        pre_confirm_snapshot: {},
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.undoClassification(TEST_TRANSACTION_ID, TEST_USER_ID),
      ).rejects.toThrow("Undo not available");
    });

    it("撤销不可用时抛出异常（status 非 confirmed）", async () => {
      const { supabase } = createUndoMocks({
        id: TEST_TRANSACTION_ID,
        user_id: TEST_USER_ID,
        status: "pending",
        undo_available: true,
        undo_deadline: null,
        pre_confirm_snapshot: {},
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.undoClassification(TEST_TRANSACTION_ID, TEST_USER_ID),
      ).rejects.toThrow("Undo not available");
    });

    it("撤销超时时抛出异常", async () => {
      const { supabase } = createUndoMocks({
        id: TEST_TRANSACTION_ID,
        user_id: TEST_USER_ID,
        status: "confirmed",
        undo_available: true,
        // 设置为过去的时间
        undo_deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        pre_confirm_snapshot: {},
      });

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.undoClassification(TEST_TRANSACTION_ID, TEST_USER_ID),
      ).rejects.toThrow("Undo deadline passed");
    });

    it("恢复书签失败时抛出异常并包含错误信息", async () => {
      const snapshot = {
        bookmarkStates: {
          "1": { folder_id: null },
        },
        createdFolderIds: [],
      };

      const { supabase } = createUndoMocks(
        {
          id: TEST_TRANSACTION_ID,
          user_id: TEST_USER_ID,
          status: "confirmed",
          undo_available: true,
          undo_deadline: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          pre_confirm_snapshot: snapshot,
        },
        { bookmarkUpdateError: "Database connection lost" },
      );

      const coordinator = new BatchClassificationCoordinator(supabase);

      await expect(
        coordinator.undoClassification(TEST_TRANSACTION_ID, TEST_USER_ID),
      ).rejects.toThrow(
        "Failed to restore bookmarks: Database connection lost",
      );
    });

    it("非空文件夹不被删除", async () => {
      const snapshot = {
        bookmarkStates: {},
        createdFolderIds: [10],
      };

      const { supabase, folderDeleteBuilder } = createUndoMocks(
        {
          id: TEST_TRANSACTION_ID,
          user_id: TEST_USER_ID,
          status: "confirmed",
          undo_available: true,
          undo_deadline: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          pre_confirm_snapshot: snapshot,
        },
        { folderBookmarkCount: 3 }, // 文件夹非空
      );

      const coordinator = new BatchClassificationCoordinator(supabase);
      const result = await coordinator.undoClassification(
        TEST_TRANSACTION_ID,
        TEST_USER_ID,
      );

      // 文件夹非空，不应被删除
      expect(result.deletedFolders).toBe(0);
      expect(folderDeleteBuilder.delete).not.toHaveBeenCalled();
    });

    it("snapshot 为空时正常返回零计数", async () => {
      const { supabase } = createUndoMocks({
        id: TEST_TRANSACTION_ID,
        user_id: TEST_USER_ID,
        status: "confirmed",
        undo_available: true,
        undo_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pre_confirm_snapshot: {},
      });

      const coordinator = new BatchClassificationCoordinator(supabase);
      const result = await coordinator.undoClassification(
        TEST_TRANSACTION_ID,
        TEST_USER_ID,
      );

      expect(result.restoredBookmarks).toBe(0);
      expect(result.deletedFolders).toBe(0);
    });
  });
});
