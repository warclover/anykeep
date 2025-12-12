# Trust Mode V4.2 发布文档

## 概述

Trust Mode（托管模式）是 AnyKeep V4.2 智能分类系统的核心功能，提供三种用户控制级别，让用户根据个人偏好选择 AI 自动化程度。

## 发布版本

- **版本号**: V4.2.0
- **发布日期**: 2025-12-11
- **代码分支**: `feature/classification-v4.2`

## 功能概述

### 三种托管模式

| 模式        | 中文名   | 描述                                    |
| ----------- | -------- | --------------------------------------- |
| `full_auto` | 完全托管 | AI 全权负责分类和整理，无需用户干预     |
| `semi_auto` | 半托管   | AI 处理大部分工作，不确定时询问用户意见 |
| `manual`    | 不托管   | 用户完全控制，AI 仅在请求时提供辅助     |

### 核心功能

1. **智能分类路由**
   - 快速路径：来源匹配、标签匹配、标题相似度
   - 慢速路径：向量相似度、AI 推理

2. **待确认消息系统**
   - 低置信度分类需用户确认
   - 支持批量确认/拒绝
   - 7天自动过期处理

3. **用户偏好学习**
   - 从手动移动中学习
   - 从用户纠正中学习
   - 智能调整置信度阈值

4. **A/B 测试框架**
   - 支持灰度发布
   - 用户分组实验
   - 指标追踪

## 技术架构

### 目录结构

```
src/lib/
├── trust-mode/                 # 托管模式核心
│   ├── config.ts              # 配置中心
│   ├── trust-mode.service.ts  # 服务层
│   ├── trust-mode.repository.ts # 数据访问层
│   ├── ab-test.config.ts      # A/B 测试配置
│   └── __tests__/             # 单元测试
├── confirmation/              # 待确认消息
│   ├── confirmation.service.ts
│   ├── confirmation.repository.ts
│   ├── confirmation-expiry.cron.ts
│   └── __tests__/
├── metrics/                   # 监控指标
│   └── classification-metrics.ts
└── classification/            # 分类核心
    ├── v3/                    # V3 分类引擎
    ├── learning/              # 学习模块
    └── services/              # 服务层
```

### 数据库表

| 表名                         | 用途             |
| ---------------------------- | ---------------- |
| `user_trust_mode`            | 用户托管模式配置 |
| `pending_confirmations`      | 待确认消息队列   |
| `classification_suggestions` | 分类建议历史     |
| `user_preferences`           | 用户偏好学习数据 |

### API 端点

| 端点                              | 方法    | 描述              |
| --------------------------------- | ------- | ----------------- |
| `/api/user/trust-mode`            | GET/PUT | 获取/更新托管模式 |
| `/api/user/trust-mode/stats`      | GET     | 获取统计数据      |
| `/api/classification/[id]/reason` | GET     | 获取分类决策理由  |
| `/api/classification/history`     | GET     | 获取分类历史      |
| `/api/classification/trace`       | GET     | 获取分类追踪      |

## 部署清单

### 前置条件

- [ ] 数据库迁移完成（`user_trust_mode` 表）
- [ ] 环境变量配置完成
- [ ] 依赖安装完成

### 环境变量

```bash
# 托管模式配置
TRUST_MODE_HIGH_CONFIDENCE_THRESHOLD=80    # 可选，覆盖默认高置信度阈值
TRUST_MODE_MEDIUM_CONFIDENCE_THRESHOLD=60  # 可选，覆盖默认中置信度阈值
TRUST_MODE_LOW_CONFIDENCE_THRESHOLD=40     # 可选，覆盖默认低置信度阈值

# A/B 测试
NEXT_PUBLIC_AB_TEST_ENABLED=false          # 是否启用 A/B 测试
NEXT_PUBLIC_AB_TEST_FORCE_VARIANT=         # 强制指定变体（调试用）

# 监控指标
NEXT_PUBLIC_METRICS_ENABLED=false          # 是否启用指标收集
```

### 数据库迁移

```sql
-- 执行迁移脚本
-- supabase/migrations/20251211_trust_mode.sql
```

### 部署步骤

1. **代码部署**

   ```bash
   git checkout feature/classification-v4.2
   npm install
   npm run build
   ```

2. **数据库迁移**

   ```bash
   npm run supabase:db:push
   ```

3. **验证部署**
   ```bash
   npm run test -- --testPathPattern="trust-mode|confirmation"
   ```

## 回滚方案

### 代码回滚

```bash
git checkout <previous-commit>
npm run build
```

### 数据库回滚

```sql
-- 备份数据
CREATE TABLE user_trust_mode_backup AS SELECT * FROM user_trust_mode;

-- 如需回滚
DROP TABLE IF EXISTS user_trust_mode;
ALTER TABLE user_trust_mode_backup RENAME TO user_trust_mode;
```

### 功能降级

1. 设置所有用户为 `full_auto` 模式
2. 禁用待确认消息功能
3. 禁用 A/B 测试

```sql
UPDATE user_trust_mode SET trust_mode = 'full_auto';
```

## 监控指标

### 关键指标

| 指标名                          | 类型      | 描述         | 告警阈值     |
| ------------------------------- | --------- | ------------ | ------------ |
| `classification_latency_ms`     | Histogram | 分类延迟     | P99 > 5000ms |
| `user_corrections_total`        | Counter   | 用户纠正次数 | 日增长 > 20% |
| `pending_confirmations_gauge`   | Gauge     | 待确认消息数 | > 100/用户   |
| `classification_failures_total` | Counter   | 分类失败数   | > 5/分钟     |

### 仪表盘

建议监控以下指标组合：

1. **分类质量**
   - 分类准确率 = 1 - (user_corrections / auto_decisions)
   - 置信度分布
   - 各来源匹配成功率

2. **用户体验**
   - 待确认消息平均处理时间
   - 确认接受率
   - 模式切换频率

3. **系统性能**
   - 分类延迟 P50/P95/P99
   - AI 调用成功率
   - 向量搜索延迟

## 灰度发布计划

### 第一阶段：内测 (Day 1-3)

- 目标用户：开发团队、内部测试用户
- 流量比例：1%
- 验证重点：
  - 基本功能正确性
  - API 稳定性
  - 数据库性能

### 第二阶段：小范围测试 (Day 4-7)

- 目标用户：活跃用户（书签数 > 100）
- 流量比例：5%
- 验证重点：
  - 分类准确率
  - 用户满意度
  - 性能表现

### 第三阶段：扩大测试 (Day 8-14)

- 目标用户：所有现有用户
- 流量比例：20%
- 验证重点：
  - 规模效应
  - 边缘情况
  - 用户反馈

### 第四阶段：全量发布 (Day 15+)

- 目标用户：所有用户
- 流量比例：100%
- 验证重点：
  - 稳定性
  - 长期效果

## 已知问题

1. **性能优化待定**
   - 大量书签用户的分类延迟可能较高
   - 计划：实现批量分类优化

2. **多向量迁移**
   - 历史书签需要迁移到多向量格式
   - 计划：后台异步迁移

## 支持联系

- **技术负责人**: [开发团队]
- **产品负责人**: [产品团队]
- **紧急联系**: [值班电话]

## 更新记录

| 日期       | 版本  | 变更内容 |
| ---------- | ----- | -------- |
| 2025-12-11 | 1.0.0 | 初始版本 |
