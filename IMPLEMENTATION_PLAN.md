# 智能分类 v5.0 实施计划

**项目**: AnyKeep 智能分类系统升级到 v5.0
**参考文档**: `_bmad-output/IMPLEMENTATION_GUIDE_v5.md`
**开始日期**: 2026-01-18
**预计完成**: 2026-02-28 (6 周)

---

## 实施阶段概览

| 阶段 | 名称 | 预计时间 | 状态 |
|------|------|----------|------|
| Stage 1 | 数据层准备 | Week 1 | Not Started |
| Stage 2 | 共享服务层 | Week 1-2 | Not Started |
| Stage 3 | 核心模块实施 | Week 2-4 | Not Started |
| Stage 4 | API 层 + UI 层 | Week 4 | Not Started |
| Stage 5 | Edge Functions + 后台任务 | Week 5 | Not Started |
| Stage 6 | 灰度发布与监控 | Week 5-6 | Not Started |

---

## Stage 1: 数据层准备 (Week 1)

**目标**: 创建 3 张新表 + IVFFlat 索引 + RLS 策略

**成功标准**:
- [x] 3 张表创建成功
- [x] 6 个 IVFFlat/常规索引创建成功
- [x] 3 个 RLS 策略启用成功
- [x] RPC 函数部署成功

**任务清单**:
- [x] 创建迁移文件 `20260116000001_add_classification_v5_tables.sql`
- [x] 编写表结构 SQL（3 张表）
- [x] 编写索引 SQL（6 个索引）
- [x] 编写 RLS 策略 SQL（3 个策略）
- [x] 编写触发器 SQL（自动更新 updated_at）
- [x] 编写 RPC 函数 SQL（match_folder_profiles_v5）
- [x] 执行迁移（本地测试）
- [x] 验证表结构

**状态**: ✅ Complete

---

## Stage 2: 共享服务层 (Week 1-2)

**目标**: 实施 5 个共享服务（Logger, Embedding, LLM, VectorSearch, FeatureFlag）

**成功标准**:
- [ ] 5 个共享服务实施完成
- [ ] 每个服务有对应测试文件（覆盖率 ≥80%）
- [ ] 环境变量配置完成
- [ ] RPC 函数部署到 Supabase

**任务清单**:
- [ ] 创建目录结构 `src/lib/classification/v5/shared/`
- [ ] 实施 Logger Service
- [ ] 实施 Embedding Service（OpenAI）
- [ ] 实施 LLM Service（DeepSeek）
- [ ] 实施 VectorSearch Service（pgvector）
- [ ] 实施 FeatureFlag Service
- [ ] 编写单元测试（每个服务）
- [ ] 配置环境变量

**状态**: In Progress

---

## Stage 3: 核心模块实施 (Week 2-4)

**目标**: 并行实施 3 个核心模块（Module A/B/C）

**成功标准**:
- [ ] Module A 实施完成（7 个文件）
- [ ] Module B 实施完成（12 个文件）
- [ ] Module C 实施完成（9 个文件）
- [ ] 单元测试覆盖率 ≥80%
- [ ] 集成测试通过

**任务清单**:
- [ ] Module A: FolderProfiler（文件夹画像）
- [ ] Module B: ClassificationPipeline（分类流水线）
- [ ] Module C: Gardener（文件夹园丁）

**状态**: Not Started

---

## Stage 4: API 层 + UI 层 (Week 4)

**目标**: 5 个 API 端点 + 6 个 UI 组件

**成功标准**:
- [ ] 5 个 API 端点实施完成
- [ ] 6 个 UI 组件实施完成
- [ ] SSE 流式推送正常工作
- [ ] Feature Flag 路由正确执行

**任务清单**:
- [ ] API: POST /api/classification/v5/classify
- [ ] API: GET /api/classification/v5/folder-profiles
- [ ] API: GET /api/classification/v5/t1-stream (SSE)
- [ ] API: GET /api/classification/v5/metrics
- [ ] API: POST /api/classification/v5/gardener
- [ ] UI: classification-card-v5.tsx
- [ ] UI: t1-notification.tsx
- [ ] UI: confidence-indicator.tsx
- [ ] UI: folder-profile-list.tsx
- [ ] UI: gardener-suggestions.tsx
- [ ] UI: metrics-dashboard.tsx

**状态**: Not Started

---

## Stage 5: Edge Functions + 后台任务 (Week 5)

**目标**: 2 个 Edge Functions + 1 个迁移脚本

**成功标准**:
- [ ] 2 个 Edge Functions 部署成功
- [ ] 定时任务配置完成
- [ ] 数据迁移脚本执行成功（所有用户文件夹已初始化）

**任务清单**:
- [ ] Edge Function: update-folder-profiles-v5
- [ ] Edge Function: process-t1-corrections
- [ ] 迁移脚本: migrate-v4-to-v5.ts
- [ ] 配置 Supabase Cron 定时任务

**状态**: Not Started

---

## Stage 6: 灰度发布与监控 (Week 5-6)

**目标**: 6 步灰度发布 + 实时监控

**成功标准**:
- [ ] 6 阶段灰度发布全部完成
- [ ] 所有监控指标稳定
- [ ] 用户反馈积极（NPS ≥70）
- [ ] 100% 用户已使用 v5.0

**任务清单**:
- [ ] 阶段 1: 内部测试（0% → 1%）
- [ ] 阶段 2: 早期用户（1% → 5%）
- [ ] 阶段 3: 小范围（5% → 20%）
- [ ] 阶段 4: 半数用户（20% → 50%）
- [ ] 阶段 5: 大多数用户（50% → 100%）
- [ ] 阶段 6: 完全上线（100%）
- [ ] 配置监控指标
- [ ] 配置告警规则

**状态**: Not Started

---

## 关键决策记录

| 决策编号 | 决策内容 | 关键参数 |
|---------|---------|---------|
| 决策 1 | 双源向量 + 动态 α 系数 | α = f(时间衰减, 数量比例, 多样性, 新鲜度) |
| 决策 2 | IVFFlat 向量索引 | `lists = 10` (适用 <100 文件夹) |
| 决策 3 | 混合检索（向量 + 行为） | 内容向量 70% + 行为向量 30% |
| 决策 4 | T0/T1 两阶段生成 | T0 <500ms, T1 <5s, SSE 流式推送 |
| 决策 5 | Feature Flag 灰度发布 | 0% → 1% → 5% → 20% → 50% → 100% |
| 决策 6 | 三级降级策略 | v5.0 → v4.1 → 规则匹配 |

---

## 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| IVFFlat 索引构建失败 | 高 | 确保 pgvector 扩展版本 ≥0.5.0 |
| T0 延迟 >500ms | 中 | 添加 LRU 缓存，优化向量检索 |
| LLM 调用率 >30% | 中 | 调整置信度阈值和向量冲突阈值 |
| Edge Function 超时 | 中 | 减少批量处理数量 |
| 数据迁移失败 | 高 | 先在开发环境测试，备份生产数据 |

---

## 进度更新日志

### 2026-01-18
- ✅ 创建实施计划文档
- ✅ Stage 1 完成：数据层准备
  - 创建迁移文件 `20260118000001_add_classification_v5_tables.sql`
  - 3 张表创建成功（classification_folder_profiles_v5, classification_t1_queue_v5, classification_metrics_v5）
  - 7 个索引创建成功（2个IVFFlat + 5个常规索引）
  - 3 个 RLS 策略启用成功
  - 触发器创建成功（自动更新 updated_at）
  - RPC 函数部署成功（match_folder_profiles_v5）
  - 修复类型兼容性问题（UUID → BIGINT）
- 🚧 Stage 2 开始：共享服务层
  - 创建目录结构 `src/lib/classification/v5/shared/`
