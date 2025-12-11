/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * V4.2 Trust Mode Performance Benchmark Tests
 * 验证 Trust Mode 决策流程的性能指标
 *
 * 目标：
 * - Trust Mode 决策延迟 < 50ms
 * - 配置获取延迟 < 30ms
 * - 统计更新延迟 < 20ms
 * - 批量操作吞吐量 > 100 ops/s
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

/* eslint-disable no-console */

import { TrustModeService } from "../trust-mode.service";
import { TrustModeRepository } from "../trust-mode.repository";
import type { UserTrustModeRecord, TrustMode } from "@/types/trust-mode";

// ============================================================================
// Mock 设置
// ============================================================================

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("../trust-mode.repository");

// ============================================================================
// 测试数据工厂
// ============================================================================

const createMockRecord = (
  mode: TrustMode = "semi_auto",
): UserTrustModeRecord => ({
  id: 1,
  user_id: "test-user-123",
  trust_mode: mode,
  overrides: {},
  mode_history: [],
  auto_decisions_count: 100,
  user_corrections_count: 5,
  pending_confirmations_count: 3,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
});

// ============================================================================
// 性能测试
// ============================================================================

describe("V4.2 Trust Mode Performance Benchmarks", () => {
  let service: TrustModeService;
  let mockRepository: jest.Mocked<TrustModeRepository>;

  // 性能指标收集
  const measurements: Record<string, number[]> = {
    getDecision: [],
    getConfig: [],
    updateStats: [],
    modeSwitch: [],
  };

  // 性能目标（毫秒）
  const TARGETS = {
    getDecision: 50,
    getConfig: 30,
    updateStats: 20,
    batchThroughput: 100, // ops/s
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateOverrides: jest.fn(),
      getOrCreate: jest.fn().mockResolvedValue(createMockRecord()),
      incrementStats: jest.fn().mockResolvedValue(undefined),
      resetPendingCount: jest.fn(),
      getModeHistory: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TrustModeRepository>;

    (TrustModeRepository as jest.Mock).mockImplementation(() => mockRepository);

    service = new TrustModeService();

    (service as any).getSupabase = jest.fn().mockResolvedValue({});
  });

  afterAll(() => {
    // 输出性能报告
    console.log("\n" + "=".repeat(60));
    console.log("📊 TRUST MODE PERFORMANCE BENCHMARK RESULTS");
    console.log("=".repeat(60));

    for (const [name, times] of Object.entries(measurements)) {
      if (times.length === 0) continue;

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const sorted = [...times].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(times.length * 0.95)] || max;
      const target = TARGETS[name as keyof typeof TARGETS];

      const status = avg <= target ? "✅" : "❌";

      console.log(`\n${status} ${name}:`);
      console.log(`   Average: ${avg.toFixed(2)}ms (target: < ${target}ms)`);
      console.log(`   Min/Max: ${min.toFixed(2)}ms / ${max.toFixed(2)}ms`);
      console.log(`   P95: ${p95.toFixed(2)}ms`);
      console.log(`   Samples: ${times.length}`);
    }

    console.log("\n" + "=".repeat(60) + "\n");
  });

  // ============================================================================
  // 决策性能测试
  // ============================================================================

  describe("Decision Performance", () => {
    it("should make classification decision within 50ms", async () => {
      const iterations = 100;
      const userId = "test-user-123";

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.getClassificationDecision({
          userId,
          confidence: Math.random() * 100,
        });
        const elapsed = performance.now() - start;
        measurements.getDecision.push(elapsed);
      }

      const avg =
        measurements.getDecision.reduce((a, b) => a + b, 0) / iterations;
      expect(avg).toBeLessThan(TARGETS.getDecision);
    });

    it("should handle varying confidence levels efficiently", async () => {
      const confidenceLevels = [10, 30, 50, 70, 90];
      const userId = "test-user-123";

      for (const confidence of confidenceLevels) {
        const times: number[] = [];

        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          await service.getClassificationDecision({ userId, confidence });
          times.push(performance.now() - start);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        expect(avg).toBeLessThan(TARGETS.getDecision);
      }
    });
  });

  // ============================================================================
  // 配置获取性能测试
  // ============================================================================

  describe("Config Retrieval Performance", () => {
    it("should retrieve effective config within 30ms", async () => {
      const iterations = 50;
      const userId = "test-user-123";

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.getEffectiveConfig(userId);
        const elapsed = performance.now() - start;
        measurements.getConfig.push(elapsed);
      }

      const avg =
        measurements.getConfig.reduce((a, b) => a + b, 0) / iterations;
      expect(avg).toBeLessThan(TARGETS.getConfig);
    });

    it("should handle config with complex overrides", async () => {
      mockRepository.getOrCreate.mockResolvedValue({
        ...createMockRecord(),
        overrides: {
          classification: {
            confirmationThreshold: 90,
            lowConfidenceAction: "pending_with_message",
          },
          folderManagement: {
            autoCreate: false,
            autoMerge: false,
            autoSplit: false,
            autoRename: false,
          },
          notification: {
            onClassification: true,
            onFolderCreate: true,
          },
        } as any,
      });

      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await service.getEffectiveConfig("test-user-123");
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avg).toBeLessThan(TARGETS.getConfig);
    });
  });

  // ============================================================================
  // 统计更新性能测试
  // ============================================================================

  describe("Stats Update Performance", () => {
    it("should update auto decision stats within 20ms", async () => {
      const iterations = 50;
      const userId = "test-user-123";

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.recordAutoDecision(userId);
        const elapsed = performance.now() - start;
        measurements.updateStats.push(elapsed);
      }

      const avg =
        measurements.updateStats.reduce((a, b) => a + b, 0) / iterations;
      expect(avg).toBeLessThan(TARGETS.updateStats);
    });

    it("should update correction stats within 20ms", async () => {
      const times: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await service.recordUserCorrection("test-user-123");
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avg).toBeLessThan(TARGETS.updateStats);
    });
  });

  // ============================================================================
  // 模式切换性能测试
  // ============================================================================

  describe("Mode Switch Performance", () => {
    it("should switch modes efficiently", async () => {
      const modes: TrustMode[] = ["full_auto", "semi_auto", "manual"];
      const userId = "test-user-123";

      mockRepository.update.mockImplementation(async (params) => ({
        ...createMockRecord(params.trustMode),
      }));

      for (const targetMode of modes) {
        const times: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await service.updateTrustMode(userId, targetMode);
          times.push(performance.now() - start);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        measurements.modeSwitch.push(avg);
        expect(avg).toBeLessThan(50); // 50ms target for mode switch
      }
    });
  });

  // ============================================================================
  // 吞吐量测试
  // ============================================================================

  describe("Throughput Tests", () => {
    it("should handle 100+ decisions per second", async () => {
      const targetOpsPerSecond = TARGETS.batchThroughput;
      const testDuration = 1000; // 1 second
      const userId = "test-user-123";

      const start = performance.now();
      let operations = 0;

      while (performance.now() - start < testDuration) {
        await service.getClassificationDecision({
          userId,
          confidence: Math.random() * 100,
        });
        operations++;
      }

      const elapsed = performance.now() - start;
      const opsPerSecond = (operations / elapsed) * 1000;

      console.log(`\n📈 Throughput: ${opsPerSecond.toFixed(0)} ops/s`);
      expect(opsPerSecond).toBeGreaterThan(targetOpsPerSecond);
    });

    it("should handle concurrent decisions efficiently", async () => {
      const concurrency = 10;
      const iterationsPerWorker = 10;
      const userId = "test-user-123";

      const start = performance.now();

      const workers = Array(concurrency)
        .fill(null)
        .map(async () => {
          for (let i = 0; i < iterationsPerWorker; i++) {
            await service.getClassificationDecision({
              userId,
              confidence: Math.random() * 100,
            });
          }
        });

      await Promise.all(workers);

      const elapsed = performance.now() - start;
      const totalOps = concurrency * iterationsPerWorker;
      const opsPerSecond = (totalOps / elapsed) * 1000;

      console.log(
        `\n📈 Concurrent Throughput: ${opsPerSecond.toFixed(0)} ops/s`,
      );
      expect(opsPerSecond).toBeGreaterThan(TARGETS.batchThroughput / 2);
    });
  });

  // ============================================================================
  // 内存效率测试
  // ============================================================================

  describe("Memory Efficiency", () => {
    it("should not leak memory during repeated operations", async () => {
      const iterations = 1000;
      const userId = "test-user-123";

      // 获取初始内存
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await service.getClassificationDecision({
          userId,
          confidence: Math.random() * 100,
        });
      }

      // 强制 GC（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);

      console.log(
        `\n💾 Memory Growth: ${memoryGrowth.toFixed(2)} MB after ${iterations} operations`,
      );

      // 允许最多 10MB 的内存增长
      expect(memoryGrowth).toBeLessThan(10);
    });
  });
});
