/**
 * RouteMetrics 测试
 *
 * 测试路由性能指标收集和聚合功能
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  RouteMetricsCollector,
  RouteMetricsAggregator,
  createRouteMetricsCollector,
  createRouteMetricsAggregator,
  getDefaultMetricsAggregator,
  type RouteMetrics,
} from "../metrics";

describe("RouteMetricsCollector", () => {
  let collector: RouteMetricsCollector;

  beforeEach(() => {
    collector = createRouteMetricsCollector();
  });

  describe("基础计时功能", () => {
    it("应正确记录总耗时", () => {
      collector.start();

      // 模拟一些处理时间
      const startTime = performance.now();
      while (performance.now() - startTime < 10) {
        // wait ~10ms
      }

      const metrics = collector.finalize();
      expect(metrics.totalDurationMs).toBeGreaterThanOrEqual(10);
    });

    it("应正确记录各阶段耗时", () => {
      collector.start();

      // 分类阶段
      collector.startStage("classification");
      const t1 = performance.now();
      while (performance.now() - t1 < 5) {}
      collector.endStage("classification");

      // 复杂度阶段
      collector.startStage("complexity");
      const t2 = performance.now();
      while (performance.now() - t2 < 3) {}
      collector.endStage("complexity");

      // 模式选择阶段
      collector.startStage("modeSelector");
      const t3 = performance.now();
      while (performance.now() - t3 < 2) {}
      collector.endStage("modeSelector");

      const metrics = collector.finalize();

      expect(metrics.classificationDurationMs).toBeGreaterThanOrEqual(5);
      expect(metrics.complexityDurationMs).toBeGreaterThanOrEqual(3);
      expect(metrics.modeSelectorDurationMs).toBeGreaterThanOrEqual(2);
    });

    it("对于未记录的阶段返回 0", () => {
      collector.start();
      const metrics = collector.finalize();

      expect(metrics.classificationDurationMs).toBe(0);
      expect(metrics.complexityDurationMs).toBe(0);
      expect(metrics.modeSelectorDurationMs).toBe(0);
    });

    it("endStage 对未开始的阶段返回 0", () => {
      collector.start();
      const duration = collector.endStage("nonexistent");
      expect(duration).toBe(0);
    });
  });

  describe("分类指标记录", () => {
    beforeEach(() => {
      collector.start();
    });

    it("应正确记录规则匹配数量", () => {
      collector.recordRuleMatchCount(5);
      const metrics = collector.finalize();
      expect(metrics.ruleMatchCount).toBe(5);
    });

    it("应正确记录消歧使用情况", () => {
      collector.recordDisambiguation(true);
      const metrics = collector.finalize();
      expect(metrics.disambiguationUsed).toBe(true);
    });

    it("应正确记录 LLM 兜底使用情况", () => {
      collector.recordLLMFallback(true);
      const metrics = collector.finalize();
      expect(metrics.llmFallbackUsed).toBe(true);
    });

    it("应正确记录分类来源", () => {
      collector.recordClassificationSource("llm");
      const metrics = collector.finalize();
      expect(metrics.classificationSource).toBe("llm");
    });

    it("应正确记录 LLM 缓存命中", () => {
      collector.recordLLMCacheHit(true);
      const metrics = collector.finalize();
      expect(metrics.llmCacheHit).toBe(true);
    });
  });

  describe("默认值", () => {
    it("应返回正确的默认指标", () => {
      collector.start();
      const metrics = collector.finalize();

      expect(metrics.ruleMatchCount).toBe(0);
      expect(metrics.disambiguationUsed).toBe(false);
      expect(metrics.llmFallbackUsed).toBe(false);
      expect(metrics.classificationSource).toBe("rule");
      expect(metrics.llmCacheHit).toBe(false);
    });
  });

  describe("reset 功能", () => {
    it("应正确重置收集器状态", () => {
      collector.start();
      collector.recordRuleMatchCount(10);
      collector.recordDisambiguation(true);
      collector.startStage("classification");
      collector.endStage("classification");

      collector.reset();
      collector.start();

      const metrics = collector.finalize();
      expect(metrics.ruleMatchCount).toBe(0);
      expect(metrics.disambiguationUsed).toBe(false);
      expect(metrics.classificationDurationMs).toBe(0);
    });
  });

  describe("getPartialMetrics", () => {
    it("应返回部分指标用于调试", () => {
      collector.start();
      collector.recordRuleMatchCount(3);
      collector.startStage("classification");
      collector.endStage("classification");

      const partial = collector.getPartialMetrics();

      expect(partial.ruleMatchCount).toBe(3);
      expect(partial.classificationDurationMs).toBeGreaterThanOrEqual(0);
      expect(partial.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("RouteMetricsAggregator", () => {
  let aggregator: RouteMetricsAggregator;

  const createSampleMetrics = (
    overrides: Partial<RouteMetrics> = {},
  ): RouteMetrics => ({
    classificationDurationMs: 10,
    complexityDurationMs: 5,
    modeSelectorDurationMs: 2,
    totalDurationMs: 20,
    ruleMatchCount: 2,
    disambiguationUsed: false,
    llmFallbackUsed: false,
    classificationSource: "rule",
    llmCacheHit: false,
    ...overrides,
  });

  beforeEach(() => {
    aggregator = createRouteMetricsAggregator();
  });

  describe("样本收集", () => {
    it("应正确添加样本", () => {
      aggregator.addSample(createSampleMetrics());
      expect(aggregator.getSampleCount()).toBe(1);
    });

    it("应遵循最大样本数限制", () => {
      const maxSamples = 10;
      const limitedAggregator = createRouteMetricsAggregator(maxSamples);

      for (let i = 0; i < 15; i++) {
        limitedAggregator.addSample(
          createSampleMetrics({ totalDurationMs: i * 10 }),
        );
      }

      expect(limitedAggregator.getSampleCount()).toBe(maxSamples);

      // 验证是滑动窗口（保留最新的）
      const recent = limitedAggregator.getRecentSamples(1);
      expect(recent[0].totalDurationMs).toBe(140); // 最后一个样本 14 * 10
    });
  });

  describe("聚合统计", () => {
    it("空样本应返回零值聚合", () => {
      const aggregation = aggregator.getAggregation();

      expect(aggregation.sampleCount).toBe(0);
      expect(aggregation.avgTotalDurationMs).toBe(0);
      expect(aggregation.p95TotalDurationMs).toBe(0);
      expect(aggregation.p99TotalDurationMs).toBe(0);
      expect(aggregation.maxTotalDurationMs).toBe(0);
      expect(aggregation.llmFallbackRate).toBe(0);
    });

    it("应正确计算平均值", () => {
      aggregator.addSample(createSampleMetrics({ totalDurationMs: 10 }));
      aggregator.addSample(createSampleMetrics({ totalDurationMs: 20 }));
      aggregator.addSample(createSampleMetrics({ totalDurationMs: 30 }));

      const aggregation = aggregator.getAggregation();
      expect(aggregation.avgTotalDurationMs).toBe(20);
    });

    it("应正确计算最大值", () => {
      aggregator.addSample(createSampleMetrics({ totalDurationMs: 10 }));
      aggregator.addSample(createSampleMetrics({ totalDurationMs: 100 }));
      aggregator.addSample(createSampleMetrics({ totalDurationMs: 50 }));

      const aggregation = aggregator.getAggregation();
      expect(aggregation.maxTotalDurationMs).toBe(100);
    });

    it("应正确计算 P95 百分位", () => {
      // 添加 100 个样本，值从 1 到 100
      for (let i = 1; i <= 100; i++) {
        aggregator.addSample(createSampleMetrics({ totalDurationMs: i }));
      }

      const aggregation = aggregator.getAggregation();
      // P95 应该是第 95 个值
      expect(aggregation.p95TotalDurationMs).toBe(95);
    });

    it("应正确计算 P99 百分位", () => {
      // 添加 100 个样本，值从 1 到 100
      for (let i = 1; i <= 100; i++) {
        aggregator.addSample(createSampleMetrics({ totalDurationMs: i }));
      }

      const aggregation = aggregator.getAggregation();
      // P99 应该是第 99 个值
      expect(aggregation.p99TotalDurationMs).toBe(99);
    });

    it("应正确计算 LLM 兜底使用率", () => {
      aggregator.addSample(createSampleMetrics({ llmFallbackUsed: true }));
      aggregator.addSample(createSampleMetrics({ llmFallbackUsed: false }));
      aggregator.addSample(createSampleMetrics({ llmFallbackUsed: true }));
      aggregator.addSample(createSampleMetrics({ llmFallbackUsed: false }));

      const aggregation = aggregator.getAggregation();
      expect(aggregation.llmFallbackRate).toBe(0.5);
    });

    it("应正确计算消歧使用率", () => {
      aggregator.addSample(createSampleMetrics({ disambiguationUsed: true }));
      aggregator.addSample(createSampleMetrics({ disambiguationUsed: false }));

      const aggregation = aggregator.getAggregation();
      expect(aggregation.disambiguationRate).toBe(0.5);
    });

    it("应正确计算 LLM 缓存命中率", () => {
      // 只计算使用了 LLM 的样本
      aggregator.addSample(
        createSampleMetrics({ llmFallbackUsed: true, llmCacheHit: true }),
      );
      aggregator.addSample(
        createSampleMetrics({ llmFallbackUsed: true, llmCacheHit: false }),
      );
      aggregator.addSample(
        createSampleMetrics({ llmFallbackUsed: false, llmCacheHit: false }),
      ); // 不计入

      const aggregation = aggregator.getAggregation();
      expect(aggregation.llmCacheHitRate).toBe(0.5);
    });

    it("当没有 LLM 使用时缓存命中率应为 0", () => {
      aggregator.addSample(createSampleMetrics({ llmFallbackUsed: false }));
      aggregator.addSample(createSampleMetrics({ llmFallbackUsed: false }));

      const aggregation = aggregator.getAggregation();
      expect(aggregation.llmCacheHitRate).toBe(0);
    });
  });

  describe("clear 功能", () => {
    it("应清空所有样本", () => {
      aggregator.addSample(createSampleMetrics());
      aggregator.addSample(createSampleMetrics());
      expect(aggregator.getSampleCount()).toBe(2);

      aggregator.clear();
      expect(aggregator.getSampleCount()).toBe(0);
    });
  });

  describe("getRecentSamples", () => {
    it("应返回最近 N 个样本", () => {
      for (let i = 1; i <= 10; i++) {
        aggregator.addSample(createSampleMetrics({ totalDurationMs: i * 10 }));
      }

      const recent = aggregator.getRecentSamples(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].totalDurationMs).toBe(80);
      expect(recent[1].totalDurationMs).toBe(90);
      expect(recent[2].totalDurationMs).toBe(100);
    });

    it("当请求数量超过样本数时返回所有样本", () => {
      aggregator.addSample(createSampleMetrics());
      aggregator.addSample(createSampleMetrics());

      const recent = aggregator.getRecentSamples(10);
      expect(recent).toHaveLength(2);
    });
  });
});

describe("工厂函数", () => {
  describe("createRouteMetricsCollector", () => {
    it("应创建新的收集器实例", () => {
      const collector1 = createRouteMetricsCollector();
      const collector2 = createRouteMetricsCollector();

      expect(collector1).not.toBe(collector2);
      expect(collector1).toBeInstanceOf(RouteMetricsCollector);
    });
  });

  describe("createRouteMetricsAggregator", () => {
    it("应创建新的聚合器实例", () => {
      const aggregator1 = createRouteMetricsAggregator();
      const aggregator2 = createRouteMetricsAggregator();

      expect(aggregator1).not.toBe(aggregator2);
      expect(aggregator1).toBeInstanceOf(RouteMetricsAggregator);
    });

    it("应支持自定义最大样本数", () => {
      const aggregator = createRouteMetricsAggregator(5);

      for (let i = 0; i < 10; i++) {
        aggregator.addSample({
          classificationDurationMs: 0,
          complexityDurationMs: 0,
          modeSelectorDurationMs: 0,
          totalDurationMs: i,
          ruleMatchCount: 0,
          disambiguationUsed: false,
          llmFallbackUsed: false,
          classificationSource: "rule",
          llmCacheHit: false,
        });
      }

      expect(aggregator.getSampleCount()).toBe(5);
    });
  });

  describe("getDefaultMetricsAggregator", () => {
    it("应返回全局单例", () => {
      const aggregator1 = getDefaultMetricsAggregator();
      const aggregator2 = getDefaultMetricsAggregator();

      expect(aggregator1).toBe(aggregator2);
    });
  });
});

describe("IntentRouter 集成", () => {
  // 这些测试验证 IntentRouter 正确使用 metrics
  // 实际集成测试在 intent-router.test.ts 中
  it("应导出所有需要的类型和函数", () => {
    expect(RouteMetricsCollector).toBeDefined();
    expect(RouteMetricsAggregator).toBeDefined();
    expect(createRouteMetricsCollector).toBeDefined();
    expect(createRouteMetricsAggregator).toBeDefined();
    expect(getDefaultMetricsAggregator).toBeDefined();
  });
});
