# 技术债务 - GitHub Issues 模板

**生成日期**: 2025-12-25
**基于文档**: TECH_DEBT_20251225.md

---

## Issue 1: AI Provider 扩展

**标题**: `[Feature] 支持更多 AI Provider（阿里云百炼、Ollama）`

**标签**: `enhancement`, `ai`, `P2`

**描述**:
扩展 AI Provider 支持，增加以下提供商：

1. **阿里云百炼** - 国内主流云服务商的大模型服务
2. **Ollama** - 本地模型支持，适合隐私敏感场景

**相关文件**:

- `src/lib/ai-providers/provider-router.ts:50-52`
- `src/lib/summary/providers/provider.factory.ts:127`
- `src/lib/summary/summary.config.ts:216, 234, 252`

**验收标准**:

- [ ] 实现 AliyunBailianProvider
- [ ] 实现 OllamaProvider
- [ ] 添加配置项和环境变量支持
- [ ] 编写单元测试
- [ ] 更新文档

---

## Issue 2: Agent Memory 持久化

**标题**: `[Feature] Agent Memory 数据库持久化`

**标签**: `enhancement`, `ai-agent`, `P2`

**描述**:
实现 Agent 对话记忆的数据库持久化功能，支持：

1. 从数据库加载历史记忆
2. 保存新记忆到数据库
3. 清理过期记忆

**相关文件**:

- `src/lib/ai-agent/core/agent-memory.ts:108, 192`

**验收标准**:

- [ ] 设计 agent_memories 数据库表结构
- [ ] 实现持久化 adapter
- [ ] 添加内存与数据库同步机制
- [ ] 编写单元测试

---

## Issue 3: LLM 意图分类增强

**标题**: `[Enhancement] 意图分类器增加 LLM 辅助`

**标签**: `enhancement`, `ai-skills`, `P2`

**描述**:
为意图分类器添加可选的 LLM 辅助分类能力，用于处理规则难以覆盖的复杂意图。

**相关文件**:

- `src/lib/ai-skills/router/intent-classifier.ts:328`

**验收标准**:

- [ ] 实现 LLM 分类 fallback 逻辑
- [ ] 添加 feature flag 控制
- [ ] 添加分类结果缓存
- [ ] 编写单元测试

---

## Issue 4: 确认系统通知分组

**标题**: `[Enhancement] 过期确认通知按用户分组发送`

**标签**: `enhancement`, `notification`, `P3`

**描述**:
优化过期确认的通知机制，按用户分组发送，避免产生过多通知。

**相关文件**:

- `src/lib/confirmation/confirmation-expiry.cron.ts:163`

**验收标准**:

- [ ] 实现用户级通知聚合
- [ ] 添加通知频率限制
- [ ] 优化通知内容模板

---

## Issue 5: 确认详情关联加载

**标题**: `[Enhancement] 确认记录加载关联书签/文件夹详情`

**标签**: `enhancement`, `confirmation`, `P2`

**描述**:
在获取确认记录时，同时加载关联的书签和文件夹信息。

**相关文件**:

- `src/lib/confirmation/confirmation.service.ts:650`

**验收标准**:

- [ ] 实现关联数据的预加载
- [ ] 添加可选的 include 参数
- [ ] 优化查询性能（避免 N+1）

---

## Issue 6: 分类指标外发服务集成

**标题**: `[Enhancement] 分类指标数据发送到外部收集服务`

**标签**: `enhancement`, `metrics`, `monitoring`, `P3`

**描述**:
集成外部指标收集服务（如 Prometheus、DataDog），将分类指标数据上报。

**相关文件**:

- `src/lib/metrics/classification-metrics.ts:542`

**验收标准**:

- [ ] 设计指标数据格式
- [ ] 实现 Prometheus exporter
- [ ] 添加配置项
- [ ] 编写文档

---

## Issue 7: 性能告警外部监控集成

**标题**: `[Enhancement] 性能告警对接外部监控服务`

**标签**: `enhancement`, `monitoring`, `P3`

**描述**:
将性能告警发送到外部监控服务，实现告警通知和历史追踪。

**相关文件**:

- `src/lib/monitoring/performance-alerts.ts:280`

**验收标准**:

- [ ] 设计告警数据格式
- [ ] 实现 webhook 通知
- [ ] 支持多渠道配置

---

## Issue 8: Summary Prompt 构建器

**标题**: `[Feature] Summary 模块专用 Prompt 构建器`

**标签**: `enhancement`, `summary`, `P1`

**描述**:
为 Summary 模块实现专用的 Prompt 构建器，支持：

1. 多语言模板
2. 动态上下文注入
3. Token 限制处理

**相关文件**:

- `src/lib/summary/prompts/index.ts:87`

**验收标准**:

- [ ] 设计 Prompt 构建器 API
- [ ] 实现模板引擎
- [ ] 添加 token 计数
- [ ] 编写单元测试

---

## Issue 9: 微信文章抓取服务升级

**标题**: `[Feature] 集成 browserless 抓取微信文章`

**标签**: `enhancement`, `crawler`, `P2`

**描述**:
升级微信文章抓取服务，集成 browserless 或类似服务处理复杂页面。

**相关文件**:

- `src/lib/wechat-article/wechat-article.service.ts:312`

**验收标准**:

- [ ] 调研 browserless 集成方案
- [ ] 实现抓取服务 adapter
- [ ] 添加重试和错误处理
- [ ] 编写集成测试

---

## Issue 10: 导出功能埋点集成

**标题**: `[Enhancement] 导出功能埋点系统集成`

**标签**: `enhancement`, `analytics`, `P3`

**描述**:
为导出功能添加埋点，追踪用户使用情况。

**相关文件**:

- `src/lib/export/analytics.ts:19`

**验收标准**:

- [ ] 定义导出相关事件
- [ ] 实现埋点上报
- [ ] 添加用户隐私保护

---

## 优先级说明

| 优先级 | 数量 | 建议时间 |
| ------ | ---- | -------- |
| P1     | 1    | 当前迭代 |
| P2     | 5    | 下一迭代 |
| P3     | 4    | 后续规划 |

---

## 创建 Issue 命令（需要 gh CLI）

```bash
# P1: Summary Prompt 构建器
gh issue create --title "[Feature] Summary 模块专用 Prompt 构建器" \
  --body "..." --label "enhancement,summary,P1"

# P2 Issues
gh issue create --title "[Feature] 支持更多 AI Provider" \
  --body "..." --label "enhancement,ai,P2"

# ... 更多 Issues
```
