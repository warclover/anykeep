# AnyKeep AI 能力全面测试方案

> **版本**: 1.0.0
> **创建日期**: 2026-01-10
> **目标**: 系统性验证 AI 功能的真实能力，识别问题并制定优化方案

---

## 一、测试目标

基于代码探索发现的问题，本测试方案聚焦于验证：

1. **意图分类准确率** - 规则覆盖度、口语化表达识别、消歧机制
2. **Skill 调用链路** - 意图到 Skill 的映射、参数解析、执行成功率
3. **工作流触发** - 工作流意图匹配、执行流程
4. **用户体验** - 响应延迟、流式输出流畅度、错误处理

---

## 二、测试架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI 能力测试金字塔                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         ┌─────────────────────────────────┐                 │
│         │    E2E 场景测试 (10 场景)         │  ← 真实用户流程  │
│         └─────────────────────────────────┘                 │
│                                                             │
│    ┌─────────────────────────────────────────────┐          │
│    │      集成测试 (30 用例)                       │  ← 链路验证 │
│    │   意图→Skill→执行→输出                        │          │
│    └─────────────────────────────────────────────┘          │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │           单元测试 (100+ 用例)                          │   │
│ │   意图分类 | Skill 解析 | 输出格式化                     │  ← 组件验证 │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、测试模块详细设计

### 模块 1: 意图分类准确率测试

#### 1.1 黄金数据集扩展

**现有覆盖**: `scripts/test-intent-mapping.ts` 包含 ~80 个测试用例

**需要扩展的场景**:

| 场景类别 | 当前覆盖 | 需新增 | 示例 |
|----------|----------|--------|------|
| 口语化表达 | 15 | +30 | "那个XX在哪"、"帮我弄一下" |
| 方言/变体 | 0 | +20 | "搞一下"、"瞅瞅"、"瞧瞧" |
| 英文混合 | 5 | +15 | "search AI"、"tag it" |
| 指代消解 | 3 | +10 | "这个"、"那些"、"刚才的" |
| 工作流触发 | 0 | +14 | 7个工作流 × 2种表达 |
| 多意图组合 | 3 | +10 | "找到后删掉"、"整理并导出" |

**新增测试用例** (共 99 条新增):

```typescript
// 口语化表达扩展
{ input: "帮我弄一下", expectedType: "organize", expectedSubType: "cleanup" },
{ input: "搞定那些重复的", expectedType: "organize", expectedSubType: "dedupe" },
{ input: "瞅瞅最近收藏", expectedType: "query", expectedSubType: "list" },
{ input: "瞧瞧有啥", expectedType: "query", expectedSubType: "list" },
{ input: "康康", expectedType: "query", expectedSubType: "list" },
{ input: "rua一下", expectedType: "query", expectedSubType: "search" }, // 网络用语

// 情感+意图
{ input: "烦死了找不到", expectedType: "query", expectedSubType: "search" },
{ input: "累了不想整理", expectedType: "chitchat", expectedSubType: "general" },
{ input: "开心，终于整理完了", expectedType: "chitchat", expectedSubType: "general" },

// 工作流触发（7个工作流）
{ input: "帮我整理下", expectedType: "workflow", expectedSubType: "new_user_onboarding" },
{ input: "检查一下链接是否有效", expectedType: "workflow", expectedSubType: "bookmark_health" },
{ input: "书签巡检", expectedType: "workflow", expectedSubType: "bookmark_health" },
{ input: "深度学习这个主题", expectedType: "workflow", expectedSubType: "topic_deep_dive" },
{ input: "主题深挖", expectedType: "workflow", expectedSubType: "topic_deep_dive" },
{ input: "备份我的数据", expectedType: "workflow", expectedSubType: "periodic_backup" },
{ input: "定期备份", expectedType: "workflow", expectedSubType: "periodic_backup" },
{ input: "今天看什么", expectedType: "workflow", expectedSubType: "daily_digest" },
{ input: "每日推荐", expectedType: "workflow", expectedSubType: "daily_digest" },
{ input: "清理文件夹", expectedType: "workflow", expectedSubType: "folder_cleanup" },
{ input: "整理目录", expectedType: "workflow", expectedSubType: "folder_cleanup" },

// 指代消解
{ input: "这个加个标签", expectedType: "action", expectedSubType: "tag", context: { selectedBookmarkId: 123 } },
{ input: "把那些删了", expectedType: "action", expectedSubType: "delete", context: { selectedBookmarkIds: [1,2,3] } },
{ input: "刚才那个怎么找不到了", expectedType: "query", expectedSubType: "search" },
```

#### 1.2 测试执行命令

```bash
# 运行全量意图测试
npx tsx scripts/test-intent-mapping.ts --verbose

# 按类别测试
npx tsx scripts/test-intent-mapping.ts --category workflow
npx tsx scripts/test-intent-mapping.ts --category edge

# 生成报告
npx tsx scripts/test-intent-mapping.ts --output reports/intent-accuracy.json
```

#### 1.3 验收指标

| 指标 | 当前值 | 目标值 | 说明 |
|------|--------|--------|------|
| 类型准确率 | ~85% | ≥92% | type 字段匹配 |
| 完全匹配率 | ~70% | ≥85% | type + subType 都匹配 |
| 工作流触发率 | 未知 | ≥90% | 工作流意图正确识别 |
| 边界场景 | ~60% | ≥75% | 口语化/省略/情感表达 |

---

### 模块 2: Skill 调用链路测试

#### 2.1 测试场景矩阵

| Skill ID | 触发表达 | 预期参数 | 验证点 |
|----------|----------|----------|--------|
| `search` | "搜索AI文章" | `{ query: "AI文章" }` | 搜索结果非空 |
| `classify` | "分类这些书签" | `{ bookmarkIds: [...] }` | 分类结果返回 |
| `data_export` | "导出为JSON" | `{ format: "json" }` | 文件生成 |
| `batch_organize` | "自动整理" | `{}` | 进度报告正确 |
| `knowledge_review` | "复习收藏" | `{}` | 复习卡片生成 |
| `duplicate_cleanup` | "去除重复" | `{}` | 重复检测结果 |
| `smart_tagging` | "自动打标签" | `{}` | 标签建议返回 |
| `tts_synthesis` | "朗读这个" | `{ bookmarkId: 123 }` | 音频生成 |
| `insight_report` | "生成洞察报告" | `{}` | 报告内容非空 |
| `thematic_synthesis` | "主题合成" | `{ bookmarkIds: [...] }` | 合成报告生成 |

#### 2.2 链路追踪测试

```typescript
// 测试用例结构
interface SkillChainTest {
  name: string;
  input: string;
  context?: EngineContext;
  expectedChain: {
    intentType: string;
    intentSubType?: string;
    mode: "atomic" | "orchestration";
    skillId?: string;
  };
  expectedOutput: {
    hasText: boolean;
    hasProgress?: boolean;
    hasDeliverable?: boolean;
    deliverableFormat?: string;
  };
  timeout: number;
}

// 示例测试
const skillChainTests: SkillChainTest[] = [
  {
    name: "搜索→搜索结果",
    input: "搜索 React 教程",
    expectedChain: {
      intentType: "query",
      intentSubType: "search",
      mode: "atomic",
    },
    expectedOutput: {
      hasText: true,
      hasDeliverable: false,
    },
    timeout: 5000,
  },
  {
    name: "导出→JSON文件",
    input: "把我的收藏导出为JSON",
    expectedChain: {
      intentType: "create",
      intentSubType: "export",
      mode: "orchestration",
      skillId: "data_export",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
      hasDeliverable: true,
      deliverableFormat: "json",
    },
    timeout: 30000,
  },
  {
    name: "整理→批量操作",
    input: "帮我整理一下收藏",
    expectedChain: {
      intentType: "organize",
      intentSubType: "cleanup",
      mode: "orchestration",
      skillId: "batch_organize",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
      hasDeliverable: true,
    },
    timeout: 60000,
  },
];
```

#### 2.3 执行脚本

```bash
# 运行 Skill 链路测试
npx tsx scripts/test-skill-chain.ts

# 单个 Skill 测试
npx tsx scripts/test-skill-chain.ts --skill data_export

# 生成链路追踪报告
npx tsx scripts/test-skill-chain.ts --trace --output reports/skill-chain-trace.json
```

---

### 模块 3: 工作流触发测试

#### 3.1 工作流覆盖矩阵

| 工作流 ID | 触发表达 | 预期行为 | 验证点 |
|-----------|----------|----------|--------|
| `new_user_onboarding` | "帮我整理" | 启动工作流 | `workflow_started` chunk |
| `bookmark_health` | "检查链接" | 启动工作流 | 健康报告生成 |
| `topic_deep_dive` | "深度学习AI" | 启动工作流 | 学习计划生成 |
| `periodic_backup` | "备份数据" | 启动工作流 | 备份文件生成 |
| `daily_digest` | "今天读什么" | 启动工作流 | 推荐列表返回 |
| `folder_cleanup` | "清理文件夹" | 启动工作流 | 清理建议返回 |

#### 3.2 工作流与 Skill 边界测试

```typescript
// 测试工作流和 Skill 的正确分流
const boundaryTests = [
  // 应该触发工作流
  { input: "帮我整理下书签", expected: "workflow:new_user_onboarding" },
  { input: "全面检查一下收藏", expected: "workflow:bookmark_health" },

  // 应该触发 Skill（不是工作流）
  { input: "去除重复", expected: "skill:duplicate_cleanup" },
  { input: "导出JSON", expected: "skill:data_export" },

  // 边界情况（可能误判）
  { input: "整理一下", expected: "workflow:new_user_onboarding", note: "简短表达" },
  { input: "整理这个文件夹", expected: "skill:batch_organize", note: "具体对象" },
];
```

---

### 模块 4: 用户体验测试

#### 4.1 响应延迟测试

```typescript
interface LatencyTest {
  name: string;
  input: string;
  metrics: {
    ttfb: number;      // Time To First Byte (ms)
    ttfc: number;      // Time To First Content (ms)
    tti: number;       // Time To Interactive (ms)
    total: number;     // Total Response Time (ms)
  };
  thresholds: {
    ttfb: number;      // 期望值
    ttfc: number;
    tti: number;
    total: number;
  };
}

const latencyTests: LatencyTest[] = [
  {
    name: "简单搜索",
    input: "搜索React",
    metrics: { ttfb: 0, ttfc: 0, tti: 0, total: 0 },
    thresholds: { ttfb: 200, ttfc: 500, tti: 1000, total: 3000 },
  },
  {
    name: "复杂报告生成",
    input: "生成本月洞察报告",
    metrics: { ttfb: 0, ttfc: 0, tti: 0, total: 0 },
    thresholds: { ttfb: 300, ttfc: 1000, tti: 5000, total: 30000 },
  },
  {
    name: "意图消歧",
    input: "整理",
    metrics: { ttfb: 0, ttfc: 0, tti: 0, total: 0 },
    thresholds: { ttfb: 200, ttfc: 800, tti: 2000, total: 5000 },
  },
];
```

#### 4.2 流式输出流畅度测试

```typescript
interface StreamingTest {
  name: string;
  input: string;
  metrics: {
    chunkCount: number;        // 总块数
    avgChunkInterval: number;  // 平均块间隔 (ms)
    maxChunkInterval: number;  // 最大块间隔 (ms)
    hasProgressGaps: boolean;  // 是否有进度卡顿
  };
  thresholds: {
    maxChunkInterval: number;  // 最大允许间隔
    progressGapAllowed: boolean;
  };
}
```

#### 4.3 错误恢复测试

| 场景 | 模拟方法 | 预期行为 | 验证点 |
|------|----------|----------|--------|
| 网络超时 | Mock fetch timeout | 友好错误提示 | 错误消息包含"网络" |
| API 限流 | Mock 429 response | 提示稍后重试 | 错误消息包含"频繁" |
| Skill 执行失败 | Mock skill throw | 优雅降级 | 有 fallback 响应 |
| 无效参数 | 发送空输入 | 引导用户 | 有帮助提示 |

---

## 四、测试执行计划

### 阶段 1: 意图分类测试 (Day 1)

```bash
# 1. 扩展黄金数据集
# 编辑 scripts/test-intent-mapping.ts 添加新用例

# 2. 运行基线测试
npx tsx scripts/test-intent-mapping.ts --verbose > reports/intent-baseline.txt

# 3. 记录当前准确率
```

### 阶段 2: Skill 链路测试 (Day 2)

```bash
# 1. 创建 Skill 链路测试脚本
# scripts/test-skill-chain.ts

# 2. 运行测试
npx tsx scripts/test-skill-chain.ts --trace

# 3. 分析链路追踪结果
```

### 阶段 3: 工作流测试 (Day 2)

```bash
# 1. 测试工作流触发
npx tsx scripts/test-workflow-trigger.ts

# 2. 测试工作流与 Skill 边界
```

### 阶段 4: 用户体验测试 (Day 3)

```bash
# 1. 运行延迟测试
npx tsx scripts/test-latency.ts

# 2. 运行流畅度测试
npx tsx scripts/test-streaming.ts

# 3. 运行错误恢复测试
npx tsx scripts/test-error-recovery.ts
```

### 阶段 5: 综合报告 (Day 3)

```bash
# 生成综合测试报告
npx tsx scripts/generate-test-report.ts \
  --intent reports/intent-baseline.txt \
  --skill reports/skill-chain-trace.json \
  --workflow reports/workflow-trigger.json \
  --latency reports/latency.json \
  --output reports/ai-capability-assessment.md
```

---

## 五、预期产出

1. **意图分类准确率报告** (`reports/intent-accuracy.json`)
   - 按类别准确率统计
   - 失败用例详情
   - 改进建议

2. **Skill 链路追踪报告** (`reports/skill-chain-trace.json`)
   - 每个 Skill 的调用成功率
   - 参数解析正确率
   - 执行时间分布

3. **工作流触发报告** (`reports/workflow-trigger.json`)
   - 工作流触发准确率
   - 与 Skill 的边界判断情况

4. **用户体验报告** (`reports/ux-metrics.json`)
   - 响应延迟分布
   - 流畅度指标
   - 错误恢复成功率

5. **综合评估报告** (`reports/ai-capability-assessment.md`)
   - 总体评分
   - 问题清单（按优先级）
   - 优化路线图

---

## 六、测试工具依赖

```json
{
  "devDependencies": {
    "tsx": "^4.x",
    "@types/node": "^20.x"
  }
}
```

**运行环境要求**:
- Node.js 20+
- 本地 Supabase 实例（用于数据库相关测试）
- 网络连接（用于 LLM 分类测试）

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM API 调用成本 | 测试费用 | 使用 Mock 或限制 Slow Track 调用 |
| 测试数据污染 | 生产数据混乱 | 使用独立测试用户和数据库 |
| 网络不稳定 | 测试失败 | 添加重试机制，记录网络相关失败 |
| 测试时间过长 | 效率低 | 并行执行，分批运行 |

---

## 八、后续步骤

1. [ ] 创建 `scripts/test-skill-chain.ts` 测试脚本
2. [ ] 创建 `scripts/test-workflow-trigger.ts` 测试脚本
3. [ ] 创建 `scripts/test-latency.ts` 测试脚本
4. [ ] 扩展 `scripts/test-intent-mapping.ts` 黄金数据集
5. [ ] 执行测试并收集数据
6. [ ] 生成综合评估报告
7. [ ] 制定优化路线图
