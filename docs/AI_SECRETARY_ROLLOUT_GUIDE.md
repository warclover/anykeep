# AI 秘书进化 - 灰度发布配置指南

> **文档版本**: 1.0.0  
> **创建日期**: 2025-12-30  
> **状态**: Phase 5 完成

---

## 1. 概述

本文档提供 AI 秘书进化功能的灰度发布配置指南，帮助团队安全、渐进地将新功能推向生产环境。

---

## 2. Feature Flags 配置

### 2.1 环境变量清单

```bash
# .env.local 或 .env.production

# ═══════════════════════════════════════════════════════════════════════════
# Phase 0: 主动简报（核心功能，建议首先启用）
# ═══════════════════════════════════════════════════════════════════════════

# 主动简报开关（默认启用）
ENABLE_PROACTIVE_BRIEFING=true

# ═══════════════════════════════════════════════════════════════════════════
# Phase 1: 上下文增强（建议第二批启用）
# ═══════════════════════════════════════════════════════════════════════════

# 全局洞察（默认关闭）
ENABLE_GLOBAL_INSIGHT=false

# 跨会话记忆（默认关闭）
ENABLE_CROSS_SESSION_MEMORY=false

# ═══════════════════════════════════════════════════════════════════════════
# Phase 2: 慢思考（建议第三批启用）
# ═══════════════════════════════════════════════════════════════════════════

# 慢思考开关（默认关闭）
ENABLE_SLOW_THINKING=false

# 慢思考过程用户可见（慢思考启用时有效，默认启用）
ENABLE_SLOW_THINKING_VISIBLE=true

# ═══════════════════════════════════════════════════════════════════════════
# Phase 3: 智能预测（建议第四批启用）
# ═══════════════════════════════════════════════════════════════════════════

# 意图预测（默认关闭）
ENABLE_INTENT_PREDICTION=false

# 规则学习（默认关闭）
ENABLE_RULE_LEARNING=false

# ═══════════════════════════════════════════════════════════════════════════
# Phase 4: 异步分析（建议最后启用）
# ═══════════════════════════════════════════════════════════════════════════

# 异步分析（默认关闭）
ENABLE_ASYNC_ANALYSIS=false
```

### 2.2 配置优先级

| 优先级 | Feature Flag                  | 风险等级 | 依赖     |
| ------ | ----------------------------- | -------- | -------- |
| 1      | `ENABLE_PROACTIVE_BRIEFING`   | 低       | 无       |
| 2      | `ENABLE_GLOBAL_INSIGHT`       | 低       | 无       |
| 3      | `ENABLE_CROSS_SESSION_MEMORY` | 中       | 无       |
| 4      | `ENABLE_SLOW_THINKING`        | 中       | 无       |
| 5      | `ENABLE_INTENT_PREDICTION`    | 中       | 全局洞察 |
| 6      | `ENABLE_RULE_LEARNING`        | 高       | 无       |
| 7      | `ENABLE_ASYNC_ANALYSIS`       | 中       | 无       |

---

## 3. 灰度发布策略

### 3.1 阶段一：内部测试（Week 1）

**目标**：内部团队验证核心功能

```bash
# 仅启用主动简报
ENABLE_PROACTIVE_BRIEFING=true
ENABLE_GLOBAL_INSIGHT=false
ENABLE_CROSS_SESSION_MEMORY=false
ENABLE_SLOW_THINKING=false
ENABLE_INTENT_PREDICTION=false
ENABLE_RULE_LEARNING=false
ENABLE_ASYNC_ANALYSIS=false
```

**验证项**：

- [ ] 简报卡片正常显示
- [ ] 洞察内容准确
- [ ] 操作按钮响应正常
- [ ] 关闭/忽略功能正常

### 3.2 阶段二：小范围灰度（Week 2-3）

**目标**：5% 用户测试上下文增强

```bash
ENABLE_PROACTIVE_BRIEFING=true
ENABLE_GLOBAL_INSIGHT=true
ENABLE_CROSS_SESSION_MEMORY=true
ENABLE_SLOW_THINKING=false
ENABLE_INTENT_PREDICTION=false
ENABLE_RULE_LEARNING=false
ENABLE_ASYNC_ANALYSIS=false
```

**验证项**：

- [ ] 全局洞察生成正确
- [ ] 跨会话记忆有效
- [ ] 无性能问题
- [ ] 用户反馈正面

### 3.3 阶段三：扩大灰度（Week 4-5）

**目标**：20% 用户测试慢思考

```bash
ENABLE_PROACTIVE_BRIEFING=true
ENABLE_GLOBAL_INSIGHT=true
ENABLE_CROSS_SESSION_MEMORY=true
ENABLE_SLOW_THINKING=true
ENABLE_SLOW_THINKING_VISIBLE=true
ENABLE_INTENT_PREDICTION=false
ENABLE_RULE_LEARNING=false
ENABLE_ASYNC_ANALYSIS=false
```

**验证项**：

- [ ] 思考过程展示流畅
- [ ] 任务执行质量提升
- [ ] 延迟在可接受范围内
- [ ] 无负面用户反馈

### 3.4 阶段四：高级功能灰度（Week 6-7）

**目标**：50% 用户测试智能预测

```bash
ENABLE_PROACTIVE_BRIEFING=true
ENABLE_GLOBAL_INSIGHT=true
ENABLE_CROSS_SESSION_MEMORY=true
ENABLE_SLOW_THINKING=true
ENABLE_SLOW_THINKING_VISIBLE=true
ENABLE_INTENT_PREDICTION=true
ENABLE_RULE_LEARNING=true
ENABLE_ASYNC_ANALYSIS=true
```

**验证项**：

- [ ] 意图预测准确率 > 70%
- [ ] 规则学习有效
- [ ] 异步分析完成率 > 90%
- [ ] 系统稳定性良好

### 3.5 阶段五：全量发布（Week 8+）

**目标**：100% 用户开放全部功能

```bash
ENABLE_PROACTIVE_BRIEFING=true
ENABLE_GLOBAL_INSIGHT=true
ENABLE_CROSS_SESSION_MEMORY=true
ENABLE_SLOW_THINKING=true
ENABLE_SLOW_THINKING_VISIBLE=true
ENABLE_INTENT_PREDICTION=true
ENABLE_RULE_LEARNING=true
ENABLE_ASYNC_ANALYSIS=true
```

---

## 4. 回滚策略

### 4.1 快速回滚

如遇严重问题，立即禁用相关功能：

```bash
# 紧急回滚所有新功能
ENABLE_PROACTIVE_BRIEFING=false
ENABLE_GLOBAL_INSIGHT=false
ENABLE_CROSS_SESSION_MEMORY=false
ENABLE_SLOW_THINKING=false
ENABLE_INTENT_PREDICTION=false
ENABLE_RULE_LEARNING=false
ENABLE_ASYNC_ANALYSIS=false
```

### 4.2 部分回滚

针对特定功能回滚：

```bash
# 仅回滚慢思考
ENABLE_SLOW_THINKING=false

# 仅回滚异步分析
ENABLE_ASYNC_ANALYSIS=false
```

### 4.3 回滚触发条件

| 条件       | 阈值       | 操作         |
| ---------- | ---------- | ------------ |
| 错误率上升 | > 5%       | 禁用相关功能 |
| 延迟增加   | > 200%     | 降级处理     |
| 用户投诉   | > 10 例/天 | 调查并决策   |
| 内存泄漏   | 持续增长   | 立即禁用     |

---

## 5. 监控配置

### 5.1 核心监控指标

```typescript
// 建议监控的指标
const monitoringMetrics = {
  // 主动简报
  "briefing.generation.latency": { p50: "<1s", p95: "<2s", p99: "<3s" },
  "briefing.generation.success_rate": { target: ">99%" },
  "briefing.user.engagement_rate": { target: ">50%" },

  // 全局洞察
  "insight.generation.latency": { p50: "<5s", p95: "<10s" },
  "insight.cache.hit_rate": { target: ">80%" },

  // 慢思考
  "slow_thinking.latency": { p50: "<2s", p95: "<3s" },
  "slow_thinking.route_change_rate": { monitor: true },

  // 异步分析
  "async_analysis.queue.size": { max: 50, alert: ">30" },
  "async_analysis.task.success_rate": { target: ">95%" },

  // 通用
  "ai_secretary.error_rate": { alert: ">1%" },
  "ai_secretary.memory_usage": { alert: ">500MB" },
};
```

### 5.2 告警配置

```yaml
# monitoring/alerts.yml

alerts:
  - name: briefing_high_latency
    condition: briefing.generation.latency.p95 > 3s
    duration: 5m
    severity: warning
    action: notify_oncall

  - name: insight_generation_failed
    condition: insight.generation.success_rate < 95%
    duration: 10m
    severity: critical
    action: [notify_oncall, page]

  - name: async_queue_backlog
    condition: async_analysis.queue.size > 30
    duration: 15m
    severity: warning
    action: notify_oncall

  - name: memory_leak_suspected
    condition: ai_secretary.memory_usage increasing for 1h
    severity: critical
    action: [notify_oncall, auto_restart]
```

---

## 6. 用户分群配置

### 6.1 基于用户 ID 的灰度

```typescript
// 基于用户 ID 哈希的灰度控制
function isFeatureEnabledForUser(
  userId: string,
  feature: string,
  percentage: number,
): boolean {
  const hash = hashCode(userId + feature);
  return hash % 100 < percentage;
}

// 示例：5% 用户启用
const enableSlowThinking = isFeatureEnabledForUser(userId, "slow_thinking", 5);
```

### 6.2 基于用户属性的灰度

```typescript
// 基于用户属性的灰度控制
function getFeatureFlags(user: User): FeatureFlags {
  const flags: FeatureFlags = {
    ENABLE_PROACTIVE_BRIEFING: true,
    ENABLE_GLOBAL_INSIGHT: false,
    ENABLE_SLOW_THINKING: false,
    // ...
  };

  // VIP 用户优先体验
  if (user.membershipType === "premium") {
    flags.ENABLE_GLOBAL_INSIGHT = true;
    flags.ENABLE_SLOW_THINKING = true;
  }

  // 高活跃用户
  if (user.bookmarkCount > 100) {
    flags.ENABLE_ASYNC_ANALYSIS = true;
  }

  return flags;
}
```

---

## 7. 数据库迁移

### 7.1 迁移前检查

```bash
# 检查迁移状态
npm run supabase:status

# 生成迁移 diff
npm run supabase:db:diff
```

### 7.2 执行迁移

```bash
# 推送迁移到远程
npm run supabase:db:push

# 或手动执行
supabase db push --linked
```

### 7.3 回滚迁移

```bash
# 查看迁移历史
supabase migration list

# 回滚到指定版本
supabase db reset --linked
```

---

## 8. 发布检查清单

### 8.1 发布前

- [ ] 所有测试通过
- [ ] Feature Flags 配置正确
- [ ] 数据库迁移已执行
- [ ] 监控告警已配置
- [ ] 回滚方案已准备

### 8.2 发布中

- [ ] 监控核心指标
- [ ] 检查错误日志
- [ ] 抽样验证功能
- [ ] 收集用户反馈

### 8.3 发布后

- [ ] 确认无异常
- [ ] 记录发布结果
- [ ] 更新文档
- [ ] 规划下一阶段

---

## 9. 常见问题

### Q1: 如何快速禁用某个功能？

修改环境变量并重启服务：

```bash
# 禁用慢思考
ENABLE_SLOW_THINKING=false

# 重启服务
npm run build && npm start
```

### Q2: 如何只对特定用户启用功能？

使用用户分群配置（见第 6 节），或在数据库中为用户设置特殊标记。

### Q3: 功能禁用后数据会丢失吗？

不会。禁用功能只是停止新数据生成，已有数据保留在数据库中。

### Q4: 如何监控灰度效果？

1. 查看 Supabase Dashboard 的 API 调用统计
2. 检查应用日志中的 feature flag 使用情况
3. 对比灰度组和对照组的用户行为数据

---

## 10. 联系方式

- **技术负责人**: Winston (System Architect)
- **告警接收**: oncall@anykeep.com
- **紧急联系**: +86-xxx-xxxx-xxxx

---

## 附录：Feature Flag 代码位置

```
src/lib/ai-agent/config/feature-flags.ts
```

所有 AI 秘书相关的 Feature Flags 定义在 `FeatureFlags` 对象中，支持环境变量覆盖。
