# 智能分类 v5.0 - 合成用户实验室测试框架

## 📋 概述

合成用户实验室（Synthetic User Lab）是一套完整的智能分类性能测试框架，用于科学地评估 v5.0 相比 v4.1 的性能提升。

### 核心特性

- ✅ **四类典型用户画像**：硬核开发者、知识杂食者、极简主义者、混乱囤积者
- ✅ **黄金评估集生成**：自动生成包含标准答案的测试数据
- ✅ **多维度评估指标**：准确率、冷启动、语义漂移、置信度校准
- ✅ **对比测试框架**：V4.1 vs V5.0 自动化对比
- ✅ **Markdown 报告生成**：详细的测试报告和失败案例分析

### 设计理念

基于 CTO 的建议，本测试框架遵循以下原则：

1. **数据驱动**：使用真实的测试数据，而非主观判断
2. **科学评估**：多维度量化指标，全面评估性能
3. **可重复性**：标准化的测试流程，确保结果可重复
4. **失败分析**：深度分析失败案例，找出根本原因

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试

```typescript
import { SyntheticLabRunner } from './run-synthetic-lab';
import { v4Engine, v5Engine } from './your-engines';

const runner = new SyntheticLabRunner({
  outputDir: './test-results',
  saveDataset: true,
  saveReport: true,
});

await runner.runFullTest(v4Engine, v5Engine);
```

### 3. 查看报告

测试完成后，在 `./test-results` 目录下会生成：

- `dataset-{persona-type}.json` - 测试数据集
- `report-{persona-type}.md` - Markdown 格式报告
- `report-{persona-type}.json` - JSON 格式报告

## 📊 用户画像

### A：硬核开发者（hardcore-dev）

**特征**：垂直度极高，语义细微差别大

**文件夹示例**：
- React/Hooks
- React/Server Components
- Next.js/App Router
- Next.js/Pages Router

**测试重点**：考察 v5.0 对细粒度语义的区分能力

### B：知识杂食者（knowledge-omnivore）

**特征**：领域跨度极大，文件夹多且杂

**文件夹示例**：
- 美食/烹饪技巧
- 装修/家居设计
- 理财/个人财务
- AI/行业动态

**测试重点**：考察 v5.0 在多主题干扰下的召回率

### C：极简主义者（minimalist）

**特征**：文件夹极少，依赖"影子分拣"

**文件夹示例**：
- 待处理
- 归档

**测试重点**：考察 v5.0 的置信度阈值和影子分拣体验

### D：混乱囤积者（chaotic-hoarder）

**特征**：文件夹命名模糊，冷启动多

**文件夹示例**：
- 新建文件夹1
- 那个项目
- 一些东西

**测试重点**：考察 Gardener 园丁系统的新建文件夹能力

## 📈 评估指标

### 1. 准确率指标

| 指标 | 说明 | 目标 |
|------|------|------|
| **Top-1 准确率** | 首选就对的比例 | V5.0 > V4.1 + 4% |
| **Top-3 召回率** | 前三个建议里包含正确答案 | V5.0 > 95% |

### 2. 冷启动指标

| 指标 | 说明 | 目标 |
|------|------|------|
| **成功率** | 前5篇准确率 ≥ 80% 的文件夹比例 | V5.0 > V4.1 + 20% |
| **平均前5篇准确率** | 所有文件夹前5篇的平均准确率 | V5.0 > 85% |

### 3. 置信度校准指标

| 指标 | 说明 | 目标 |
|------|------|------|
| **高置信度误判率** | 置信度 > 0.9 时的错误率 | V5.0 < 10% |
| **校准得分** | 1 - 高置信度误判率 | V5.0 > 90% |

### 4. 语义漂移指标

| 指标 | 说明 | 目标 |
|------|------|------|
| **稳定性得分** | 质心偏移距离的倒数 | V5.0 > V4.1 |
| **平均质心偏移** | 文件夹质心的平均偏移距离 | V5.0 < 0.2 |

## 🔧 配置说明

### DatasetGenerator 配置

```typescript
const generator = new DatasetGenerator({
  bookmarksPerFolder: 20,        // 每个文件夹生成的书签数量
  includeEdgeCases: true,        // 是否包含边缘案例
  includeSimilarContent: true,   // 是否包含相似内容
  groundTruthConfidenceThreshold: 0.95, // 标准答案置信度阈值
});
```

### ComparisonRunner 配置

```typescript
const runner = new ComparisonRunner({
  parallel: false,    // 是否并行运行
  timeoutMs: 300000,  // 超时时间（毫秒）
  verbose: true,      // 是否详细日志
});
```

### SyntheticLabRunner 配置

```typescript
const labRunner = new SyntheticLabRunner({
  outputDir: './test-results',     // 输出目录
  saveDataset: true,               // 是否保存数据集
  saveReport: true,                // 是否保存报告
  personaTypes: ['hardcore-dev'],  // 测试的用户画像（不指定则测试所有）
});
```

## 📝 使用示例

### 示例 1：测试单个用户画像

```typescript
import { SyntheticLabRunner } from './run-synthetic-lab';
import { v4Engine, v5Engine } from './your-engines';

const runner = new SyntheticLabRunner({
  outputDir: './test-results',
  personaTypes: ['hardcore-dev'], // 只测试硬核开发者
});

await runner.runFullTest(v4Engine, v5Engine);
```

### 示例 2：测试所有用户画像

```typescript
const runner = new SyntheticLabRunner({
  outputDir: './test-results',
  // 不指定 personaTypes，默认测试所有画像
});

await runner.runFullTest(v4Engine, v5Engine);
```

### 示例 3：自定义分类引擎

```typescript
import { ClassificationEngine } from './comparison-runner';

const customV5Engine: ClassificationEngine = {
  version: 'v5.0',
  async classify(request) {
    // 调用实际的 V5.0 分类服务
    const result = await classificationPipelineService.classify({
      userId: request.userId,
      bookmarkId: request.bookmarkId,
      title: request.title,
      url: request.url,
      description: request.description,
      summary: request.summary,
      tags: request.tags,
    });

    return {
      bookmarkId: request.bookmarkId,
      predictedFolderId: result.folderId,
      predictedFolderName: result.folderName,
      confidence: result.confidence,
      topCandidates: result.candidates,
      usedT1: result.usedT1,
      latencyMs: result.totalLatencyMs,
    };
  },
};
```

## 📊 测试结果解读

### 成功标准

V5.0 达到以下标准即可推向生产环境：

1. ✅ **准确率提升 > 4%**：Top-1 准确率相比 V4.1 提升超过 4%
2. ✅ **冷启动提升 > 20%**：冷启动成功率相比 V4.1 提升超过 20%
3. ✅ **高置信度可靠**：高置信度段（>0.9）误判率低于 10%
4. ✅ **失败案例可控**：失败案例有明确的原因和改进方向

### 报告示例

```markdown
# 智能分类 v5.0 对比测试报告

**用户画像**: 硬核开发者
**测试版本**: V4.1 vs V5.0

## 📊 执行摘要

| 指标 | V4.1 | V5.0 | 提升 |
|------|------|------|------|
| **Top-1 准确率** | 92.00% | 96.50% | **+4.89%** |
| **冷启动成功率** | 70.00% | 90.00% | **+28.57%** |
| **置信度校准得分** | 85.00% | 92.00% | **+8.24%** |

### 关键发现

- ✅ **准确率显著提升**: V5.0 相比 V4.1 提升了 4.89%，达到了设计目标
- ✅ **冷启动能力大幅提升**: V5.0 在新文件夹场景下表现优异
- ✅ **高置信度预测可靠**: 当 V5.0 给出 >0.9 的置信度时，误判率低于 10%
```

## 🔍 失败案例分析

测试报告会自动提取 Top 10 失败案例，并分析失败原因：

### 失败类型

| 类型 | 说明 | 可能原因 |
|------|------|---------|
| **语义混淆** | 相似内容被分到错误文件夹 | T1 摘要不准确、文件夹边界模糊 |
| **冷启动** | 新文件夹前几篇分类错误 | 仅靠名称向量不足以判断 |
| **低置信度** | 系统不确定，置信度 < 0.7 | 内容与所有文件夹都不匹配 |
| **边缘案例** | 完全不相关的内容 | 应该触发新建文件夹建议 |

## 🛠️ 下一步行动

基于测试结果，推荐以下优化方向：

1. **失败案例深度分析**：重点分析高置信度但预测错误的案例
2. **T1 摘要质量检查**：检查 T1 摘要抓取是否准确
3. **HNSW 参数调优**：调整 ef_search 参数，平衡召回率和性能
4. **边缘案例测试**：增加更多边缘案例测试，确保系统鲁棒性

## 📚 参考文档

- [智能分类 v5.0 完整设计文档](../../../../../../docs/specs/smart-classification-v5-complete.md)
- [智能分类 v5.0 架构重构路线图](../../../../../../智能分类总结0118.md)
