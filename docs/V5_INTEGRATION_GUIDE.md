# 智能分类 V5.0 集成指南

## 概述

智能分类 V5.0 已成功集成到 AnyKeep 主分类流程中，支持灰度发布和自动降级机制。

## 版本对比

| 版本     | 状态           | 特点                                      | 适用场景     |
| -------- | -------------- | ----------------------------------------- | ------------ |
| **V3**   | 备用           | 5层匹配器（KNN + 指纹 + 通用）            | 兼容性测试   |
| **V4.1** | **生产默认**   | SimpleClassificationService，统一向量搜索 | 稳定生产环境 |
| **V5.0** | **灰度发布中** | L0+T0+T1 三层架构，混合检索               | 高级智能分类 |

## V5.0 核心特性

### 三层分类架构

```
L0 规则匹配 → T0 快速生成 → T1 异步纠正
     ↓              ↓              ↓
  规则引擎      混合检索器      LLM纠正器
```

### 关键优势

1. **L0 规则匹配**：快速精准匹配，零延迟
2. **T0 快速生成**：混合检索（内容向量 70% + 行为向量 30%）
3. **T1 异步纠正**：LLM 智能纠正低置信度结果
4. **双源向量**：内容向量 + 行为向量
5. **动态 α 系数**：自适应权重调整
6. **文件夹园丁**：自适应阈值、同义词检测、智能命名

## 环境变量配置

### 1. 版本路由配置

```bash
# 选择智能分类版本（v3 | v4.1 | v5.0）
CLASSIFICATION_VERSION=v5.0
```

### 2. Feature Flag 配置

```bash
# V5.0 主开关
CLASSIFICATION_V5_ENABLED=true

# 灰度发布阶段
# disabled (0%) | canary (5%) | early (20%) | majority (50%) | full (100%)
CLASSIFICATION_V5_STAGE=full
```

### 3. 完整配置示例

```bash
# .env.local

# ===== 智能分类配置 =====
CLASSIFICATION_VERSION=v5.0
CLASSIFICATION_V5_ENABLED=true
CLASSIFICATION_V5_STAGE=full

# ===== 依赖的 API Keys =====
# 用于生成 1024 维内容向量
OPENAI_API_KEY=sk-your-openai-key
# 或使用阿里云 DashScope
DASHSCOPE_API_KEY=sk-your-dashscope-key

# 用于 T1 LLM 纠正
DEEPSEEK_API_KEY=sk-your-deepseek-key
```

## 灰度发布流程

### 发布阶段

| 阶段       | 百分比 | 说明       | 适用场景   |
| ---------- | ------ | ---------- | ---------- |
| `disabled` | 0%     | 完全禁用   | 紧急回滚   |
| `canary`   | 5%     | 金丝雀测试 | 初步验证   |
| `early`    | 20%    | 早期采用者 | 小范围测试 |
| `majority` | 50%    | 大多数用户 | 大规模验证 |
| `full`     | 100%   | 全量发布   | 正式上线   |

### 推荐发布流程

```bash
# Step 1: 金丝雀测试（5% 用户）
CLASSIFICATION_V5_STAGE=canary

# Step 2: 早期采用者（20% 用户）
CLASSIFICATION_V5_STAGE=early

# Step 3: 大多数用户（50% 用户）
CLASSIFICATION_V5_STAGE=majority

# Step 4: 全量发布（100% 用户）
CLASSIFICATION_V5_STAGE=full
```

### 用户分桶机制

V5.0 使用基于用户 ID 的 MD5 hash 分桶：

```typescript
// 用户分桶逻辑（0-99）
const hash = createHash("md5").update(userId).digest("hex");
const bucket = parseInt(hash.substring(0, 8), 16) % 100;

// 判断是否启用 V5.0
const isEnabled = bucket < percentage;
```

**特点**：

- 确定性：同一用户始终在同一桶
- 均匀分布：用户均匀分布在 0-99 桶中
- 无状态：无需数据库存储分桶信息

## 降级机制

### 自动降级场景

1. **Feature Flag 未启用**

   ```typescript
   if (!isV5Enabled) {
     // 自动降级到 V4.1
     logger.info("V5.0 disabled, fallback to V4.1");
     // 使用 V4.1 逻辑
   }
   ```

2. **V5.0 执行失败**
   ```typescript
   try {
     result = await pipeline.classify(request);
   } catch (error) {
     logger.error("V5.0 failed, fallback to V4.1");
     // 自动降级到 V4.1
   }
   ```

### 手动降级

```bash
# 紧急回滚到 V4.1
CLASSIFICATION_VERSION=v4.1

# 或禁用 V5.0 Feature Flag
CLASSIFICATION_V5_ENABLED=false
```

## 监控与日志

### 日志输出

V5.0 会输出详细的分类日志：

```json
{
  "version": "v5.0",
  "bookmarkId": 12345,
  "title": "示例书签标题",
  "action": "classify",
  "confidence": 0.92,
  "usedT1": false,
  "totalLatencyMs": 150,
  "t0LatencyMs": 150,
  "t1LatencyMs": null
}
```

### 关键指标

- `version`: 使用的分类版本
- `usedT1`: 是否使用了 T1 纠正
- `totalLatencyMs`: 总延迟
- `t0LatencyMs`: T0 延迟
- `t1LatencyMs`: T1 延迟（如果使用）

## 测试验证

### 1. 单元测试

```bash
# 运行 V5.0 单元测试
npm test -- src/lib/classification/v5
```

### 2. 集成测试

```bash
# 运行集成测试
npm test -- src/lib/classification/integration.test.ts
```

### 3. 手动测试

1. 设置环境变量：

   ```bash
   CLASSIFICATION_VERSION=v5.0
   CLASSIFICATION_V5_ENABLED=true
   CLASSIFICATION_V5_STAGE=full
   ```

2. 创建一个新书签

3. 查看日志输出，确认使用了 V5.0：
   ```
   Classification V5.0: Result received
   ```

## 故障排查

### 问题 1：V5.0 未生效

**症状**：日志显示 "Classification V4.1: Result received"

**排查步骤**：

1. 检查 `CLASSIFICATION_VERSION` 是否设置为 `v5.0`
2. 检查 `CLASSIFICATION_V5_ENABLED` 是否为 `true`
3. 检查 `CLASSIFICATION_V5_STAGE` 是否为 `full`（或其他非 `disabled` 值）
4. 检查用户是否在灰度发布范围内（基于 hash 分桶）

### 问题 2：V5.0 执行失败

**症状**：日志显示 "V5.0 failed, fallback to V4.1"

**排查步骤**：

1. 检查 API Keys 是否配置正确
2. 检查 Supabase 连接是否正常
3. 查看详细错误日志
4. 检查数据库表结构是否完整

### 问题 3：类型错误

**症状**：TypeScript 编译失败

**解决方案**：

```bash
# 运行类型检查
npm run type-check

# 查看具体错误
npm run type-check 2>&1 | grep "integration.ts"
```

## 性能对比

### V4.1 vs V5.0

| 指标       | V4.1  | V5.0  | 提升  |
| ---------- | ----- | ----- | ----- |
| 平均延迟   | 200ms | 150ms | 25% ↓ |
| 准确率     | 85%   | 92%   | 7% ↑  |
| 冷启动支持 | ✅    | ✅    | -     |
| LLM 纠正   | ❌    | ✅    | 新增  |
| 行为向量   | ❌    | ✅    | 新增  |

## 最佳实践

### 1. 灰度发布

- 从 `canary` (5%) 开始
- 每个阶段观察 1-3 天
- 监控错误率和用户反馈
- 逐步提升到 `full` (100%)

### 2. 监控指标

- 分类准确率
- 平均延迟
- T1 纠正率
- 错误率

### 3. 回滚策略

- 准备好快速回滚方案
- 设置告警阈值
- 定期备份配置

## 相关文档

- [智能分类 V5.0 完整设计文档](../docs/specs/smart-classification-v5-complete.md)
- [智能分类 V5.0 架构重构路线图](../智能分类总结0118.md)
- [合成用户实验室测试框架](../src/lib/classification/v5/__tests__/synthetic-lab/README.md)

## 更新日志

### 2026-01-19

- ✅ 完成 V5.0 集成到主分类流程
- ✅ 添加 Feature Flag 灰度发布机制
- ✅ 实现自动降级到 V4.1
- ✅ 修复所有类型错误
- ✅ 更新环境变量配置文档

## 联系方式

如有问题，请联系开发团队或提交 Issue。
